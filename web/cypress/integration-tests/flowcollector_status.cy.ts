import { Operator } from "@views/netobserv"
import { flowcollectorStatusPage, flowcollectorStatusSelectors } from "@views/flowcollector-status"

describe('Network_Observability FlowCollector status error scenario', { tags: ['Network_Observability'] }, function () {

    before('setup', function () {
        cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
        cy.uiLogin(Cypress.env('LOGIN_IDP'), Cypress.env('LOGIN_USERNAME'), Cypress.env('LOGIN_PASSWORD'))

        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector("WithLokiStack")
    })

    it("(OCP-88744, kapjain) Verify error status when Loki enabled without LokiStack", function () {
        // Visit status page and wait for Ready condition to show False (error state)
        flowcollectorStatusPage.visit()
        cy.get(flowcollectorStatusSelectors.readyRow, { timeout: 120000 }).should('exist')
            .should('have.attr', 'data-test-status', 'False')
        cy.get(flowcollectorStatusSelectors.readyRow)
            .should('have.attr', 'data-test-reason')
            .and('not.equal', 'Pending')
            .and('not.equal', 'Valid')

        // Verify WaitingFLPMonolith condition shows error about loki-gateway-ca-bundle
        cy.get(flowcollectorStatusSelectors.flpMonolithRow).should('exist')
            .should('have.attr', 'data-test-status', 'True')
        cy.get(flowcollectorStatusSelectors.flpMonolithRow).parent()
            .should('contain.text', 'loki-gateway-ca-bundle')

        // Verify Flowlogs Pipeline component shows error about loki-gateway-ca-bundle
        cy.contains('td', 'Flowlogs Pipeline').parent('tr')
            .should('contain.text', 'loki-gateway-ca-bundle')

        // Verify WaitingLokiStack condition shows LokiStack not found error
        cy.get(flowcollectorStatusSelectors.lokiStackRow).should('exist')
            .should('have.attr', 'data-test-status', 'True')
        cy.get(flowcollectorStatusSelectors.lokiStackRow)
            .should('contain.text', 'Loki is configured in LokiStack mode, but LokiStack API is missing')

        // Verify WaitingFLPParent condition shows FLP error
        cy.get(flowcollectorStatusSelectors.flpParentRow).should('exist')
            .should('have.attr', 'data-test-status', 'True')
            .and('have.attr', 'data-test-reason', 'FLPError')

        // Verify status icon tooltip shows error
        cy.get(flowcollectorStatusSelectors.statusButton)
            .find('span').first().trigger('mouseenter', { force: true })
        cy.get(flowcollectorStatusSelectors.statusTooltip, { timeout: 10000 })
            .should('contain.text', 'FlowCollector has errors')

        // Verify "Open Network Traffic page" button is disabled
        cy.byLegacyTestID('open-network-traffic').should('exist')
            .should('have.attr', 'aria-disabled', 'true')
    })

    after("all tests", function () {
        Operator.deleteFlowCollector()
        cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
    })
})
