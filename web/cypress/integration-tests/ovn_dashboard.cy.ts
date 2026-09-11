import { dashboard } from "@views/dashboards-page"

const OVNPanels = [
    "current-receive-bandwidth-chart",
    "current-transmit-bandwidth-chart",
    "current-drops-chart",
    "current-errors-chart"
]

const bytes = [
    "bytes-received,-by-node-chart",
    "bytes-sent,-by-node-chart",
    "bytes-received,-by-interface-chart",
    "bytes-sent,-by-interface-chart"
]

const packetsDropped = [
    "packets-received-dropped,-by-node-chart",
    "packets-sent-dropped,-by-node-chart",
    "packets-received-dropped,-by-interface-chart",
    "packets-sent-dropped,-by-interface-chart"
]

const packets = [
    "packets-received,-by-node-chart",
    "packets-sent,-by-node-chart",
    "packets-received,-by-interface-chart",
    "packets-sent,-by-interface-chart"
]


describe('Network_Observability networking dashboards tests', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
        cy.uiLogin(Cypress.env('LOGIN_IDP'), Cypress.env('LOGIN_USERNAME'), Cypress.env('LOGIN_PASSWORD'))
    })

    it('(OCP-69944, aramesha), should have OVN (Linux Subsystem Stats) dashboards', function () {
        // navigate to 'Networking / Linux Subsystem Stats' Dashboard page
        dashboard.visitDashboard("grafana-dashboard-network-stats")

        // verify that 'Current Receive Bandwidth', 'Current Transmit Bandwidth', 'Current Drops' and 'Current Errors' panels exist and are populated
        cy.checkDashboards(OVNPanels)

        // verify 'Network Utilisation' bytes sent and received by Node and Interface panels exists and are populated
        cy.byLegacyTestID('panel-network-utilisation').should('exist').within(networkUtilisation => {
            cy.checkDashboards(bytes)
        })

        // verify 'Network Saturation' packets sent and received Dropped by Node and Interface panels exists and are populated
        cy.byLegacyTestID('panel-network-saturation').should('exist').within(networkSaturation => {
            cy.checkDashboards(packetsDropped)
        })

        // verify 'Network Errors' packets sent and received per Node and Interface panels exists and are populated
        cy.byLegacyTestID('panel-network-errors').should('exist').within(networkErrors => {
            cy.checkDashboards(packets)
        })
    })

    after("all tests", function () {
        cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
    })
})
