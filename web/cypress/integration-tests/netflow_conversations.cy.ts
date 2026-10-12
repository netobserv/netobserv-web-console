import { Operator } from "@views/netobserv"
import { netflowPage, colSelectors, querySumSelectors } from "@views/netflow-page"

describe('(OCP-71787) Conversation tracking test', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.env(['LOGIN_IDP', 'LOGIN_USERNAME', 'LOGIN_PASSWORD']).then(({ LOGIN_IDP, LOGIN_USERNAME, LOGIN_PASSWORD }) => {
            cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${LOGIN_USERNAME}`)
            cy.uiLogin(LOGIN_IDP, LOGIN_USERNAME, LOGIN_PASSWORD)
        })

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
        let warningExists = false
        cy.get(querySumSelectors.queryStatsPanel).should('exist').then(qrySum => {
            if (Cypress.$(querySumSelectors.queryStatsPanel + ' svg.query-summary-warning').length > 0) {
                warningExists = true
            }
        })

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
        cy.env(['LOGIN_USERNAME']).then(({ LOGIN_USERNAME }) => {
            cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${LOGIN_USERNAME}`)
        })
    })
})
