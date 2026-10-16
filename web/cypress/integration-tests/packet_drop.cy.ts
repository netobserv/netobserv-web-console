import { Operator } from "@views/netobserv"
import { netflowPage, overviewSelectors } from "@views/netflow-page"

function getPacketDropURL(drop: string): RegExp {
    return new RegExp(`loki/flow/records.*packetLoss=${drop}`)
}

describe('(OCP-66141) PacketDrop test', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.env(['LOGIN_IDP', 'LOGIN_USERNAME', 'LOGIN_PASSWORD']).then(({ LOGIN_IDP, LOGIN_USERNAME, LOGIN_PASSWORD }) => {
            cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${LOGIN_USERNAME}`)
            cy.uiLogin(LOGIN_IDP, LOGIN_USERNAME, LOGIN_PASSWORD)
        })

        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector("PacketDrop")
    })

    beforeEach('any packetDrop test', function () {
        netflowPage.visit()
        netflowPage.selectView('pktdrop')
    })

    it("(OCP-66141, aramesha) Verify packetDrop panels", function () {
        // verify Packet Drops view preset panels are visible
        cy.checkPanel(overviewSelectors.defaultPacketDropPanels)
        cy.checkPanelsNum(overviewSelectors.defaultPacketDropPanels.length);

        // open panels modal and verify all relevant panels are listed
        cy.openPanelsModal();
        cy.checkPopItems(overviewSelectors.panelsModal, overviewSelectors.managePacketDropPanelsList);

        // select all panels and verify they are rendered
        cy.get(overviewSelectors.panelsModal).contains('Select all').click();
        cy.get(overviewSelectors.panelsModal).contains('Save').click();
        netflowPage.waitForLokiQuery()
        // 6 drop + 4 generic rate panels
        cy.checkPanelsNum(10);

        netflowPage.waitForLokiQuery()
        cy.checkPanel(overviewSelectors.allPacketDropPanels)

        // restore default panels and verify they are visible
        cy.openPanelsModal().byTestID(overviewSelectors.resetDefault).click().byTestID(overviewSelectors.save).click()
        netflowPage.waitForLokiQuery()
        cy.checkPanel(overviewSelectors.defaultPacketDropPanels)
        cy.checkPanelsNum(overviewSelectors.defaultPacketDropPanels.length);
    })

    it("(OCP-66141, aramesha) Verify packetDrop Query Options filters", function () {
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

    afterEach("test", function () {
        netflowPage.resetClearFilters()
    })

    after("all tests", function () {
        Operator.deleteFlowCollector()
        cy.env(['LOGIN_USERNAME']).then(({ LOGIN_USERNAME }) => {
            cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${LOGIN_USERNAME}`)
        })
    })
})
