import { dashboard, dashboardSelectors } from "@views/dashboards-page"

const ingressPanels = [
    "current-total-incoming-bandwidth-chart",
    "current-total-outgoing-bandwidth-chart",
    "http-error-rate-chart",
    "http-server-average-response-latency-chart"
]

const bytesHTTP = [
    "incoming-bytes-chart",
    "outgoing-bytes-chart",
    "http-server-response-error-rate-chart",
    "average-http-server-response-latency-(ms)-chart"
]

describe('Network_Observability networking dashboards tests', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
        cy.uiLogin(Cypress.env('LOGIN_IDP'), Cypress.env('LOGIN_USERNAME'), Cypress.env('LOGIN_PASSWORD'))

        // navigate to 'Networking / Ingress' Dashboard page (retry-with-reload until registered)
        dashboard.visitDashboard('grafana-dashboard-ingress-operator')
    })

    it('(OCP-69946, aramesha), should have ingress operator dashboards', function () {
        // verify that 'Current Total Incoming Bandwidth', 'Current Total Outgoing Bandwidth', 'HTTP Error Rate' and 'HTTP Server Average Response Latency' panels exist and are populated
        cy.checkDashboards(ingressPanels)

        cy.get(dashboardSelectors.top10PerRouteToggle).should('exist').click()
        cy.get(dashboardSelectors.top10PerNamespaceToggle).should('exist').click()
        cy.get(dashboardSelectors.top10PerShardToggle).should('exist').click()

        // verify 'Top 10 Per Route' bytes and HTTP panels exists and are populated
        cy.get(dashboardSelectors.top10PerRouteToggle).should('exist').click()
        cy.get('#content-scrollable').scrollTo('bottom')
        cy.byLegacyTestID('panel-top-10-per-route').should('exist').within(routes => {
            cy.checkDashboards(bytesHTTP)
        })

        // verify 'Top 10 Per Namespace' bytes and HTTP panels exists and are populated
        cy.get(dashboardSelectors.top10PerNamespaceToggle).should('exist').click()
        cy.get('#content-scrollable').scrollTo('bottom')
        cy.byLegacyTestID('panel-top-10-per-namespace').should('exist').within(namespace => {
            cy.checkDashboards(bytesHTTP)
        })

        // verify 'Top 10 Per Shard' bytes and HTTP panels exists and are populated
        cy.get(dashboardSelectors.top10PerShardToggle).should('exist').click()
        cy.get('#content-scrollable').scrollTo('bottom')
        cy.byLegacyTestID('panel-top-10-per-shard').should('exist').within(shard => {
            let bytesHTTPRoutes = bytesHTTP.concat('number-of-routes-chart')
            cy.checkDashboards(bytesHTTPRoutes)
        })
    })

    after("all tests", function () {
        cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
    })
})
