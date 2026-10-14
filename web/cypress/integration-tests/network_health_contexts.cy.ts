import { Operator } from "@views/netobserv"

const CONTEXT = 'qe'
const FIXTURE = 'cypress/fixtures/health_contexts.yaml'
const FIXTURE_ALERTS = ['NodeWithoutOVNKubeNodePodRunning', 'QEThirdPartyContextProbe']

const waitForFiring = (alerts: string[], attempt = 0): void => {
    const maxAttempts = 18
    cy.adminCLI(
        `oc exec -n openshift-monitoring -c prometheus prometheus-k8s-0 -- ` +
        `sh -c "curl -sf 'http://localhost:9090/api/v1/alerts' 2>/dev/null"`,
        { failOnNonZeroExit: false, timeout: 120000 }
    ).then((result: Cypress.Exec) => {
        const out = result.stdout || ''
        const pending = alerts.filter(a => !out.includes(`"alertname":"${a}"`))
        cy.log(`waiting on: ${pending.join(', ') || 'none'} (attempt ${attempt + 1}/${maxAttempts})`)
        if (pending.length === 0) {
            return
        }
        if (attempt < maxAttempts) {
            cy.wait(10000)
            waitForFiring(alerts, attempt + 1)
        } else {
            throw new Error(
                `${pending.join(', ')} not firing after 3 minutes. The PrometheusRule was never ` +
                'picked up by platform Prometheus - check gather-extra artifacts for the rule ' +
                'and Prometheus state.'
            )
        }
    })
}

describe('Network Health context tabs', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
        cy.uiLogin(Cypress.env('LOGIN_IDP'), Cypress.env('LOGIN_USERNAME'), Cypress.env('LOGIN_PASSWORD'))

        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector("LokiDisabled")

        cy.adminCLI(`oc apply -f ${FIXTURE}`)
        waitForFiring(FIXTURE_ALERTS)
    })

    beforeEach('test', function () {
        cy.clearNetobservLocalStorage()
    })

    it("should show the OVN platform context tab", function () {
        cy.visit('/network-health')
        cy.get('[data-test="health-context-tab-ovn"]', { timeout: 120000 }).should('be.visible').click()
        cy.get('[data-test="health-ovn-summary"]', { timeout: 60000 }).should('be.visible')
        // Read-only context: not scored, so the NetObserv score label must not leak into it.
        cy.get('[data-test="health-summary-netobserv-label"]').should('not.exist')
        cy.get('[data-test="health-ovn-tab-global"]').should('be.visible')
        cy.get('[data-test="health-ovn-tab-nodes"]').should('be.visible').click()
        cy.get('[data-test="health-ovn-content"]', { timeout: 120000 }).should('be.visible')
        cy.get('[data-test="health-card-qe-synthetic-node"]', { timeout: 120000 }).should('be.visible')
    })

    it("should show a third-party context tab from the netobserv_io_network_health annotation", function () {
        cy.visit('/network-health')
        cy.get(`[data-test="health-context-tab-${CONTEXT}"]`, { timeout: 120000 }).should('be.visible').click()
        // displayName from the annotation wins over the formatted context id.
        cy.contains('QE Platform').should('be.visible')
        cy.get(`[data-test="health-${CONTEXT}-content"]`, { timeout: 120000 }).should('be.visible')
        cy.contains('QE third-party context probe').should('be.visible')
    })

    after("all tests", function () {
        cy.adminCLI(`oc delete -f ${FIXTURE} --ignore-not-found`)
        Operator.deleteFlowCollector()
        cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
    })
})
