import { Operator } from "@views/netobserv"
import { netflowPage, overviewSelectors } from "@views/netflow-page"

function getPacketDropURL(drop: string): RegExp {
    return new RegExp(`loki/flow/records.*packetLoss=${drop}`)
}

describe('(OCP-66141 Network_Observability) PacketDrop test', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
        cy.uiLogin(Cypress.env('LOGIN_IDP'), Cypress.env('LOGIN_USERNAME'), Cypress.env('LOGIN_PASSWORD'))

        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector("PacketDrop")
    })

    beforeEach('any packetDrop test', function () {
        netflowPage.visit()
    })

    it("(OCP-66141, aramesha, Network_Observability) Verify packetDrop panels", function () {
        // verify default PacketDrop panels are visible
        cy.checkPanel(overviewSelectors.defaultPacketDropPanels)
        cy.checkPanelsNum(6);

        // open panels modal and verify all relevant panels are listed
        cy.openPanelsModal();
        cy.checkPopupItems(overviewSelectors.panelsModal, overviewSelectors.managePacketDropPanelsList);

        // select all panels and verify they are rendered
        cy.get(overviewSelectors.panelsModal).contains('Select all').click();
        cy.get(overviewSelectors.panelsModal).contains('Save').click();
        netflowPage.waitForLokiQuery()
        cy.checkPanelsNum(10);

        netflowPage.waitForLokiQuery()
        cy.checkPanel(overviewSelectors.allPacketDropPanels)

        // restore default panels and verify they are visible
        cy.openPanelsModal().byTestID(overviewSelectors.resetDefault).click().byTestID(overviewSelectors.save).click()
        netflowPage.waitForLokiQuery()
        cy.checkPanel(overviewSelectors.defaultPacketDropPanels)
        cy.checkPanelsNum(6);
    })

    it("(OCP-66141, aramesha, Network_Observability) Verify packetDrop Query Options filters", function () {
        cy.get('#tabs-container').contains('Traffic flows').click()
        cy.byTestID("table-composable").should('exist')

        // toggle between drops filter
        cy.intercept('GET', getPacketDropURL('dropped'), {
            fixture: 'flowmetrics/fully_dropped.json'
        }).as('fullyDropped')
        cy.changeQueryOption('Fully dropped')
        cy.wait('@fullyDropped', { timeout: 30000 })

        cy.intercept('GET', getPacketDropURL('sent'), {
            fixture: 'flowmetrics/without_drops.json'
        }).as('withoutDrops')
        cy.changeQueryOption('Without drops')
        cy.wait('@withoutDrops', { timeout: 30000 })

        cy.intercept('GET', getPacketDropURL('hasDrops'), {
            fixture: 'flowmetrics/containing_drops.json'
        }).as('containingDrops')
        cy.changeQueryOption('Containing drops')
        cy.wait('@containingDrops', { timeout: 30000 })
    })

    afterEach("each test", function () {
        netflowPage.resetClearFilters()
    })

    after("all tests", function () {
        Operator.deleteFlowCollector()
        cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
    })
})
