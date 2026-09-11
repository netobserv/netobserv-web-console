import { Operator } from "@views/netobserv"
import { networkHealthSelectors, healthRuleWizard } from "@views/network-health"

// The Review step's Monaco editor (SDK ResourceYAMLEditor) throws async on Back teardown
// (getValue() on a disposed model); benign, and correctness is still checked via DOM/`oc`.
// Scoped filter of the known signatures only - any other error still fails the test.
const BENIGN_EDITOR_TEARDOWN = ['Model is disposed', 'is not iterable', 'Script error']
Cypress.on('uncaught:exception', err => {
    const msg = err?.message || ''
    return !BENIGN_EDITOR_TEARDOWN.some(m => msg.includes(m))
})

const RULE_NS = "openshift-monitoring"
const CUSTOM_RULE_NAME = "netobserv-wizard-e2e-surge"
const CUSTOM_ALERT = "NetObservWizardE2ESurge"
const TEMPLATE = "DNSErrors" // defaults to Alert mode -> switching to Recording forces an override write

/** Poll an `oc` command until stdout satisfies `check`, or fail after `retries`. */
const waitForCLI = (command: string, check: (stdout: string) => boolean, retries = 20): Cypress.Chainable => {
    return cy.adminCLI(command, { failOnNonZeroExit: false }).then(result => {
        if (check(result.stdout)) {
            return cy.wrap(result.stdout)
        }
        if (retries <= 0) {
            throw new Error(`Timed out waiting for cluster state.\nCommand: ${command}\nLast stdout: ${result.stdout}`)
        }
        cy.wait(3000)
        return waitForCLI(command, check, retries - 1)
    })
}

describe('(OCP-90524) Network_Observability health rule wizard (write path)', { tags: ['Network_Observability'] }, function () {

    before('setup', function () {
        cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
        cy.uiLogin(Cypress.env('LOGIN_IDP'), Cypress.env('LOGIN_USERNAME'), Cypress.env('LOGIN_PASSWORD'))

        Operator.install()
        cy.checkStorageClass(this)
        // The wizard/rules feature is Prometheus-only (gated on CAN_LIST_NS, not Loki), so the
        // lightest sufficient FlowCollector is Loki-disabled - no Loki pod to deploy or wait on.
        Operator.createFlowcollector("LokiDisabled")

        // Clean up any leftover from a previous run so create/list assertions are deterministic.
        cy.adminCLI(`oc delete prometheusrule ${CUSTOM_RULE_NAME} -n ${RULE_NS} --ignore-not-found`)
    })

    beforeEach('any health rule wizard test', function () {
        cy.clearLocalStorage()
    })

    it('(OCP-90524, osmakal) creates a custom alert PrometheusRule and persists it on the cluster', function () {
        cy.visit('/network-health/rules/setup')
        cy.get(networkHealthSelectors.wizard, { timeout: 60000 }).should('exist')

        // Step 1 - choose custom alert.
        cy.get('#health-rule-source-alert').check({ force: true })
        healthRuleWizard.next()

        // Step 2 - configuration via DynamicForm.
        cy.get(networkHealthSelectors.dynamicForm, { timeout: 60000 }).should('exist')
        healthRuleWizard.fillCustomAlert({
            name: CUSTOM_RULE_NAME,
            namespace: RULE_NS,
            group: 'netobserv-wizard-e2e',
            alert: CUSTOM_ALERT
        })

        // Going forward to Review then back must preserve the entered configuration
        // (form state lives in the wizard, not the step DOM).
        healthRuleWizard.reviewRoundTrip()
        cy.get('[data-test="root_metadata_name"] input').should('have.value', CUSTOM_RULE_NAME)
        cy.get('[data-test="root_spec_groups_0_rules_0_alert"] input').should('have.value', CUSTOM_ALERT)

        // A value adjusted after visiting Review must also survive a Back/Next round-trip. The edit
        // is made on the form (not the Review YAML, which is regenerated from the form on each visit).
        const ADJUSTED_ALERT = `${CUSTOM_ALERT}V2`
        cy.get('[data-test="root_spec_groups_0_rules_0_alert"] input').clear().type(ADJUSTED_ALERT)
        healthRuleWizard.reviewRoundTrip()
        cy.get('[data-test="root_spec_groups_0_rules_0_alert"] input').should('have.value', ADJUSTED_ALERT)
        // Restore the canonical alert name so the create assertions below stay valid.
        cy.get('[data-test="root_spec_groups_0_rules_0_alert"] input').clear().type(CUSTOM_ALERT)

        // Canceling a dirty wizard must prompt before discarding; choose to keep editing.
        healthRuleWizard.cancel()
        cy.get(networkHealthSelectors.discardModal).should('be.visible')
        healthRuleWizard.continueEditing()
        cy.get(networkHealthSelectors.discardModal).should('not.exist')
        cy.get('[data-test="root_metadata_name"] input').should('have.value', CUSTOM_RULE_NAME)

        healthRuleWizard.next()

        // Step 3 - review + create (Monaco YAML editor in plugin mode).
        healthRuleWizard.submit()

        // UI confirms the save...
        cy.url({ timeout: 60000 }).should('include', 'ruleCreated=1')
        cy.get(networkHealthSelectors.createdAlert, { timeout: 60000 }).should('be.visible')

        // ...and the resource actually exists on the cluster with the expected shape.
        waitForCLI(
            `oc get prometheusrule ${CUSTOM_RULE_NAME} -n ${RULE_NS} -o jsonpath='{.metadata.labels.netobserv}{"|"}{.spec.groups[0].rules[0].alert}'`,
            stdout => stdout.includes('true') && stdout.includes(CUSTOM_ALERT)
        )
    })

    it('(OCP-90524, osmakal) lists the custom rule in the manager and opens it prefilled for edit', function () {
        cy.visit('/network-health')
        cy.get(networkHealthSelectors.manageRulesButton, { timeout: 60000 }).click()
        cy.get(networkHealthSelectors.rulesManager).should('be.visible')

        const rowActions = `[data-test="custom-health-rule-actions-${RULE_NS}/${CUSTOM_RULE_NAME}"]`
        cy.get(rowActions, { timeout: 60000 }).find('button').first().click()
        cy.contains('[role="menuitem"]', 'Edit').click()

        cy.get(networkHealthSelectors.wizard, { timeout: 60000 }).should('exist')
        cy.contains('Edit Network Health rule').should('exist')
        // Editing an existing rule skips the source step.
        cy.get(networkHealthSelectors.sourceTemplate).should('not.exist')
        cy.get('[data-test="root_metadata_name"] input').should('have.value', CUSTOM_RULE_NAME)
    })

    it('(OCP-90524, osmakal) deletes the custom rule from the wizard and removes it from the cluster', function () {
        cy.visit(`/network-health/rules/ns/${RULE_NS}/name/${CUSTOM_RULE_NAME}`)
        cy.get(networkHealthSelectors.wizard, { timeout: 60000 }).should('exist')
        cy.get(networkHealthSelectors.dynamicForm, { timeout: 60000 }).should('exist')

        // Config + Review footers both mount a Delete button; act on a visible one.
        cy.get(networkHealthSelectors.wizardDelete).filter(':visible').first().click()
        cy.get(networkHealthSelectors.wizardDeleteConfirm).should('be.visible').click()

        cy.url({ timeout: 60000 }).should('include', 'network-health')

        waitForCLI(
            `oc get prometheusrule ${CUSTOM_RULE_NAME} -n ${RULE_NS} --ignore-not-found -o name`,
            stdout => stdout.trim() === ''
        )
    })

    it('(OCP-90524, osmakal) writes a FlowCollector template override and resets it back to defaults', function () {
        // jsonpath scoped to the DNSErrors entry so "Recording" from another
        // template can't cause a false pass.
        const dnsErrorsMode =
            `oc get flowcollector cluster ` +
            `-o jsonpath='{.spec.processor.metrics.healthRules[?(@.template=="${TEMPLATE}")].mode}'`

        // Precondition: start from operator defaults (no override yet) so the write below
        // is what actually flips the mode. Fails loudly on a dirty start from a prior run.
        cy.adminCLI(dnsErrorsMode, { failOnNonZeroExit: false }).then(result => {
            expect(result.stdout, `no pre-existing ${TEMPLATE} override`).to.not.include('Recording')
        })

        // Edit the DNSErrors template and flip its mode to force an override into FlowCollector.
        cy.visit(`/network-health/rules/template/${TEMPLATE}`)
        cy.get(networkHealthSelectors.wizard, { timeout: 60000 }).should('exist')
        cy.get(networkHealthSelectors.dynamicForm, { timeout: 60000 }).should('exist')

        // SelectWidget mounts the interactive control on the MenuToggle (`${id}-toggle`).
        cy.get('#root_spec_mode-toggle').click()
        cy.get('#root_spec_mode-Recording').click()

        healthRuleWizard.next()
        healthRuleWizard.submit()

        cy.url({ timeout: 60000 }).should('include', 'ruleCreated=1')

        // The override is written into FlowCollector.spec.processor.metrics.healthRules.
        waitForCLI(dnsErrorsMode, stdout => stdout.includes('Recording'))

        // Reset the template back to operator defaults via the manager.
        cy.visit('/network-health')
        cy.get(networkHealthSelectors.manageRulesButton, { timeout: 60000 }).click()
        cy.get(networkHealthSelectors.rulesManager).should('be.visible')

        cy.get(`[data-test="template-health-rule-actions-${TEMPLATE}"]`, { timeout: 60000 })
            .find('button').first().click()
        cy.contains('[role="menuitem"]', 'Reset to defaults').click()
        // Confirmation modal.
        cy.get('#health-rules-manager-confirm').should('be.visible')
        cy.contains('#health-rules-manager-confirm button', 'Reset to defaults').click()

        // The override is removed from FlowCollector (DNSErrors is back to operator defaults).
        waitForCLI(dnsErrorsMode, stdout => !stdout.includes('Recording'))
    })

    after('all tests', function () {
        cy.adminCLI(`oc delete prometheusrule ${CUSTOM_RULE_NAME} -n ${RULE_NS} --ignore-not-found`)
        Operator.deleteFlowCollector()
        cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
    })
})
