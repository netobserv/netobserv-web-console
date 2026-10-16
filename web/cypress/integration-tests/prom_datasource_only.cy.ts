import { netflowPage } from "@views/netflow-page"
import { Operator } from "@views/netobserv"

describe('(OCP-74049, OCP-73875) Prometheus datasource only', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.env(['LOGIN_IDP', 'LOGIN_USERNAME', 'LOGIN_PASSWORD']).then(({ LOGIN_IDP, LOGIN_USERNAME, LOGIN_PASSWORD }) => {
            cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${LOGIN_USERNAME}`)
            cy.uiLogin(LOGIN_IDP, LOGIN_USERNAME, LOGIN_PASSWORD)
        })

        Operator.install()
        Operator.createFlowcollector("LokiDisabled")
    })

    it('(OCP-74049, aramesha), Verify Prom dataSource in Administrator view as cluster-admin user', function () {
        netflowPage.visit()

        cy.checkNetflowTraffic("Disabled")

        // verify only prom and auto dataSource is enabled in query options
        cy.byTestID('query-options-dropdown').click();
        cy.get('#query-options-popper').click();
        cy.get('#dataSource-loki').should('be.disabled')
        cy.get('#dataSource-prom').should('not.be.disabled')
        cy.get('#dataSource-auto').should('not.be.disabled')
        cy.byTestID('query-options-dropdown').click();

        // verify resource scope is not observed with prom dataSource
        cy.byTestID("show-view-options-button").should('exist').click().then(views => {
            cy.contains('Display options').should('exist').click()
            // set one display to test with
            cy.byTestID('scope-dropdown').click()
            cy.byTestID('resource').should('not.exist')
        })
    })
    after("after all tests", function () {
        Operator.deleteFlowCollector()
        cy.env(['LOGIN_USERNAME']).then(({ LOGIN_USERNAME }) => {
            cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${LOGIN_USERNAME}`)
        })
    })
})
