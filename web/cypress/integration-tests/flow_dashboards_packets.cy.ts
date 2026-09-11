import { Operator } from "@views/netobserv"
import { dashboard } from "@views/dashboards-page"

const overviewPanels = [
    "total-egress-traffic-chart",
    "total-ingress-traffic-chart",
]

const trafficRatesPanelsTop = [
    "top-egress-traffic-per-node-(pps)-chart",
    "top-ingress-traffic-per-node-(pps)-chart",
    "top-egress-traffic-per-infra-namespace-(pps)-chart",
]

const trafficRatesPanelsBottom = [
    "top-ingress-traffic-per-infra-namespace-(pps)-chart",
    "top-egress-traffic-per-infra-workload-(pps)-chart",
    "top-ingress-traffic-per-infra-workload-(pps)-chart"
]

describe('Network_Observability flow dashboards tests', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
        cy.uiLogin(Cypress.env('LOGIN_IDP'), Cypress.env('LOGIN_USERNAME'), Cypress.env('LOGIN_PASSWORD'))

        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector("PacketsMetrics")
    })

    it("(OCP-63790, memodi), should have flow dashboards for packets metrics", function () {
        // navigate to 'NetObserv / Main' Dashboard page
        dashboard.visitDashboard("netobserv-main")

        // verify that overview panels panels exist and are populated
        cy.checkDashboards(overviewPanels)

        cy.get('#content-scrollable').scrollTo('top')
        cy.wait(1000)

        // verify that Traffic Rates panels panels exist and are populated
        cy.checkDashboards(trafficRatesPanelsTop)

        cy.get('#content-scrollable').scrollTo('bottom')
        cy.wait(1000)
        cy.checkDashboards(trafficRatesPanelsBottom)
    })

    after("all tests", function () {
        Operator.deleteFlowCollector()
        cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
    })
})
