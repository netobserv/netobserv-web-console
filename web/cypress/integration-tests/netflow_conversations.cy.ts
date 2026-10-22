import { Operator } from "@views/netobserv"
import { netflowPage, colSelectors, querySumSelectors } from "@views/netflow-page"

describe('(OCP-71787) Conversation tracking test', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.setAsClusterAdmin();
        cy.uiLoginDefaultUser();
            
        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector("Conversations")
    })

    beforeEach('any conversation tracking test', function () {
        netflowPage.visit()
        cy.get('#tabs-container').contains('Traffic flows').click()
        cy.byTestID("table-composable").should('exist')
    })

    it("(OCP-71787, aramesha) should validate default conversation tracking columns", function () {
        cy.byTestID('table-composable').should('exist').within(() => {
            cy.get(colSelectors.recordType).should('exist')
            cy.get(colSelectors.conversationID).should('exist')
        })
    })

    it("(OCP-71787, aramesha) should verify Query Summary panel", function () {
        cy.changeQueryOption('Conversation')

        // validate Query Summary panel
        cy.get(querySumSelectors.queryStatsPanel).should('exist');

        cy.get(querySumSelectors.flowsCount).should('exist').then(ConversationsCnt => {
            // parseFloat handles formats: "123 Ended conversations", "123+ Ended conversations"
            const nflows = parseFloat(ConversationsCnt.text())
            cy.wait(10)
            expect(nflows).to.be.gte(0)
        })
    })

    afterEach("test", function () {
        netflowPage.resetClearFilters()
    })

    after("all tests", function () {
        Operator.deleteFlowCollector()
        cy.unsetAsClusterAdmin()
    })
})
