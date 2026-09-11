import { colSelectors, netflowPage, overviewSelectors, querySumSelectors } from "@views/netflow-page"
import { Operator } from "@views/netobserv"

describe('(OCP-68246) FlowRTT test', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
        cy.uiLogin(Cypress.env('LOGIN_IDP'), Cypress.env('LOGIN_USERNAME'), Cypress.env('LOGIN_PASSWORD'))

        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector("FlowRTT")
    })

    beforeEach('any flowRTT test', function () {
        netflowPage.visit()
    })

    it("(OCP-68246, aramesha) Verify flowRTT panels", function () {
        // verify default flowRTT panels are visible (2 bytes + 2 RTT = 4)
        cy.checkPanel(overviewSelectors.defaultFlowRTTPanels)
        cy.checkPanelsNum(4);

        // verify all relevant panels are listed
        cy.openPanelsModal()
        cy.checkPopItems(overviewSelectors.panelsModal, overviewSelectors.manageFlowRTTPanelsList);

        // select all panels and verify they are rendered
        cy.get(overviewSelectors.panelsModal).contains('Select all').click();
        cy.get(overviewSelectors.panelsModal).contains('Save').click();
        netflowPage.waitForLokiQuery()
        cy.checkPanelsNum(9);

        netflowPage.waitForLokiQuery()
        cy.checkPanel(overviewSelectors.allFlowRTTPanels)

        // restore default panels and verify they are visible
        cy.openPanelsModal();
        cy.byTestID(overviewSelectors.resetDefault).click().byTestID(overviewSelectors.save).click()
        netflowPage.waitForLokiQuery()
        cy.checkPanel(overviewSelectors.defaultFlowRTTPanels)
        cy.checkPanelsNum(4);

        // verify Query Summary stats for flowRTT
        // Use .should() callback so Cypress retries until RTT value is > 0 (up to 120s)
        cy.get(querySumSelectors.avgRTT, { timeout: 120000 }).should($el => {
            const num = parseFloat($el.text())
            expect(num).to.be.greaterThan(0)
        })
    })

    it("(OCP-68246, aramesha) Verify default flowRTT column", function () {
        cy.get('#tabs-container').contains('Traffic flows').click()
        cy.byTestID("table-composable").should('exist')
        netflowPage.stopAutoRefresh()

        // verify default FowRTT column
        cy.byTestID('table-composable').should('exist').within(() => {
            cy.get(colSelectors.flowRTT).should('exist')
        })
    })

    afterEach("test", function () {
        netflowPage.resetClearFilters()
    })

    after("all tests", function () {
        Operator.deleteFlowCollector()
        cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
    })
})
