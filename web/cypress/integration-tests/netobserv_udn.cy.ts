import { colSelectors, filterSelectors, netflowPage, topologyPage, topologySelectors } from "@views/netflow-page"
import { Operator } from "@views/netobserv"
describe('(OCP-81751) UDN test', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
        cy.uiLogin(Cypress.env('LOGIN_IDP'), Cypress.env('LOGIN_USERNAME'), Cypress.env('LOGIN_PASSWORD'))

        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector("UDNMapping")

        // deploy UDN and CUDN
        cy.adminCLI('oc create -f cypress/fixtures/test-udn.yaml')
    })

    beforeEach('any UDN test', function () {
        netflowPage.visit()
    })

    it("(OCP-81751, aramesha) should verify default UDN columns", function () {
        netflowPage.selectView('udn')
        cy.get('#tabs-container').contains('Traffic flows').click()
        cy.byTestID("table-composable").should('exist')
        netflowPage.stopAutoRefresh()

        // verify UDN view preset columns
        cy.byTestID('table-composable').should('exist').within(() => {
            cy.get(colSelectors.srcNetworkName).should('exist')
            cy.get(colSelectors.dstNetworkName).should('exist')
            cy.get(colSelectors.udns).should('exist')
            cy.get(colSelectors.bytes).should('exist')
            cy.get(colSelectors.packets).should('exist')
        })
    })

    it("(OCP-81751, aramesha) should verify network scope", function () {
        topologyPage.setupWithNamespaceFilter()

        const scope = 'network'
        topologyPage.selectScopeGroup(scope)
        topologyPage.isViewRendered()

        // Filter on empty CUDN
        cy.get(filterSelectors.filterInput).type("udns=netobserv-cudn-81751" + '{enter}')
        cy.get('#drawer', { timeout: 60000 }).contains('No results found')

        // Check Show empty checkbox and filter on empty UDN
        netflowPage.clearAllFilters()
        cy.contains('Display options').should('exist').click()
        cy.get(topologySelectors.emptyToggle).check()

        cy.get(filterSelectors.filterInput).type("udns=netobserv-cudn-81751" + '{enter}')
        cy.get('#drawer').should('not.be.empty')
        netflowPage.clearAllFilters()
    })

    afterEach("test", function () {
        netflowPage.resetClearFilters()
    })

    after("all tests", function () {
        cy.adminCLI('oc delete -f cypress/fixtures/test-udn.yaml --ignore-not-found')
        Operator.deleteFlowCollector()
        cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
    })
})
