import { Operator } from "@views/netobserv"
import { dashboard } from "@views/dashboards-page"
import { filterSelectors, netflowPage, topologyPage } from "@views/netflow-page"

const TLSPanels = [
    "flows-rate-per-tls-version-chart",
    "flows-rate-per-tls-group-chart",
]

describe('(OCP-88966) TLSTracking test', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
        cy.uiLogin(Cypress.env('LOGIN_IDP'), Cypress.env('LOGIN_USERNAME'), Cypress.env('LOGIN_PASSWORD'))

        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector("TLSTracking")

        // Deploy TLS test server and client
        cy.adminCLI('oc apply -f cypress/fixtures/test-tls-server-client.yaml')
        cy.wait(10000)
        cy.adminCLI('oc wait --for=condition=Available deployment/tls-server -n test-tls-server --timeout=180s')
        cy.adminCLI('oc wait --for=condition=Ready pod -n test-tls-client -l app=tls-client --timeout=120s')
    })

    describe('TLS Topology tests', function () {
        beforeEach('setup common topology filters', function () {
            topologyPage.setupWithNamespaceFilter('test-tls-server')
            cy.get(filterSelectors.filterInput).type("dst_namespace=test-tls-client{enter}")
            cy.get(filterSelectors.filterInput).type("protocol=TCP{enter}")
        })

        it("(OCP-88966, aramesha) Verify TLS lock icons", function () {
            // Add filters for TLS traffic (port 443)
            cy.get(filterSelectors.filterInput).type("src_port=443{enter}")

            netflowPage.waitForLokiQuery()

            // Wait for topology to render with edges
            cy.get('[data-kind="edge"]', { timeout: 60000 }).should('have.length.greaterThan', 0)

            // Verify yellow/legacy lock appears (worst case: TLS 1.2 shown when both 1.2 and 1.3 present)
            cy.byLegacyTestID('edge-handler').find('g.netobserv-topology-edge-lock--legacy').should('exist')

            // Click on an edge to open side panel
            cy.get('[data-kind="edge"]').first().click()
            cy.get('#elementPanel').should('be.visible')

            // Verify side panel shows TLS versions
            cy.get('#elementPanel').should('contain', 'TLS versions')
            cy.get('#elementPanel').should('contain', 'TLS 1.2')
            cy.get('#elementPanel').should('contain', 'TLS 1.3')

            // Click the TLS 1.3 quick filter
            cy.get('[data-test="quick-filter-tls_version-TLS 1.3"]').click()

            // Verify TLS 1.3 filter is applied
            cy.get('[id^="tls_version-"]').should('contain.text', 'TLS 1.3')

            netflowPage.waitForLokiQuery()

            // Now verify green/modern lock appears
            cy.byLegacyTestID('edge-handler').find('g.netobserv-topology-edge-lock--modern').should('exist')

            // Clear filters for next test
            netflowPage.clearAllFilters()
        })

        it("(OCP-88966, aramesha) Verify cleartext traffic display", function () {
            // Add filters for HTTP cleartext traffic (port 80)
            cy.get(filterSelectors.filterInput).type("src_port=80{enter}")

            netflowPage.waitForLokiQuery()

            // Verify edges with HTTP cleartext traffic
            cy.get('[data-kind="edge"]', { timeout: 30000 }).should('have.length.greaterThan', 0)

            // Verify no open lock appears before enabling cleartext display option
            cy.byLegacyTestID('edge-handler').find('g.netobserv-topology-edge-lock--cleartext').should('not.exist')

            // Open Display options and enable cleartext traffic display
            cy.contains('Display options').should('exist').click()

            // Verify "Cleartext traffic" checkbox exists
            cy.get('#edges-cleartext-lock-switch').should('exist')

            // Enable cleartext traffic display
            cy.get('#edges-cleartext-lock-switch').check()

            cy.contains('Display options').should('exist').click()
            netflowPage.waitForLokiQuery()

            // Verify open lock icons (cleartext) now appear on edges for HTTP traffic
            cy.byLegacyTestID('edge-handler').find('g.netobserv-topology-edge-lock--cleartext').should('exist')

            netflowPage.clearAllFilters()
        })

        afterEach('clear topology filters', function () {
            netflowPage.resetClearFilters()
        })
    })

    it("(OCP-88966, aramesha) Validate TLSTracking dashboards", function () {
        // Clear namespace context before navigating to dashboards
        cy.visit('/monitoring')

        // navigate to 'NetObserv / Main' Dashboard page
        dashboard.visit()
        dashboard.visitDashboard("netobserv-main")

        // verify 'TLS Traffic' panel
        cy.checkDashboards(['tls-traffic-chart'])

        cy.get('#content-scrollable').scrollTo('bottom')

        // verify TLS dashboard panels
        cy.checkDashboards(TLSPanels)
    })

    after("all tests", function () {
        cy.adminCLI('oc delete -f cypress/fixtures/test-tls-server-client.yaml --ignore-not-found')
        Operator.deleteFlowCollector()
        cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
    })
})
