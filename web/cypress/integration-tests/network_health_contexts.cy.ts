import { Operator } from "@views/netobserv"
import { waitForAlertsFiring } from "../support/prometheus"

const CONTEXT = 'qe'
const FIXTURE = 'cypress/fixtures/health_contexts.yaml'
const FIXTURE_ALERTS = ['NodeWithoutOVNKubeNodePodRunning', 'QEThirdPartyContextProbe']

describe('Network Health context tabs', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.setAsClusterAdmin();
        cy.uiLoginDefaultUser();

        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector("LokiDisabled")

        cy.adminCLI(`oc apply -f ${FIXTURE}`)
        waitForAlertsFiring(FIXTURE_ALERTS, {
            diagnostics: [{
                label: 'Fixture PrometheusRules in openshift-monitoring',
                command: `oc get prometheusrule -n openshift-monitoring -o name`,
                format: out => out.split('\n').filter(l => l.includes('qe-health-context')).join(' | ') || '(none)'
            }]
        })
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
        cy.unsetAsClusterAdmin()
    })
})
