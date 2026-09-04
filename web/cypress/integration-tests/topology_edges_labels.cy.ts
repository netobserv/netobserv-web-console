import { netflowPage, topologyPage, topologySelectors } from "@views/netflow-page"
import { Operator, project } from "@views/netobserv"

describe("(OCP-53591) Netflow Topology edges,labels, badges features", { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
        cy.uiLogin(Cypress.env('LOGIN_IDP'), Cypress.env('LOGIN_USERNAME'), Cypress.env('LOGIN_PASSWORD'))

        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector()
    })

    beforeEach("run before each test", function () {
        topologyPage.setupWithNamespaceFilter()
    })

    it("(OCP-53591, memodi) should verify group owners", function () {
        cy.intercept('GET', topologyPage.getResourceScopeGroupURL('owners'), { fixture: 'flowmetrics/Owners.json' }).as('ownersData')
        topologyPage.selectScopeGroup("resource", "owners")
        cy.wait('@ownersData')
        cy.get(topologySelectors.nGroups).its('length').should('be.greaterThan', 4)
    })

    it("(OCP-53591, memodi) should verify group expand/collapse", function () {
        topologyPage.selectScopeGroup("resource", "owners")
        cy.contains('Display options').should('exist').click()
        cy.get(topologySelectors.groupToggle).click()
        cy.get(topologySelectors.groupLayer + ' > ' + topologySelectors.group).each((node, index) => {
            cy.wrap(node).should('not.have.descendants', 'g.pf-topology__group')
        })
        cy.get(topologySelectors.groupToggle).click()
        cy.get(topologySelectors.groupLayer + ' > ' + topologySelectors.group).each((node, index) => {
            cy.wrap(node).should('have.descendants', 'g.pf-topology__group')
        })
    })

    it("(OCP-53591, aramesha) should verify group edges default and disabled states", function () {
        topologyPage.selectScopeGroup("resource", "owners")
        cy.contains('Display options').should('exist').click()

        // group edges should be present and checked by default when groups are enabled
        cy.get(topologySelectors.groupEdgesToggle).should('exist')
        cy.get(topologySelectors.groupEdgesToggle).should('be.checked')
        cy.get(topologySelectors.groupEdgesToggle).should('not.be.disabled')

        // group edges should be disabled when group is set to none
        cy.byTestID("group-dropdown").click().byTestID("none").click()
        cy.get(topologySelectors.groupEdgesToggle).should('be.disabled')

        // group edges should be disabled when edges are toggled off
        cy.byTestID("group-dropdown").click().byTestID("owners").click()
        cy.get(topologySelectors.edgeToggle).uncheck()
        cy.get(topologySelectors.groupEdgesToggle).should('be.disabled')
        cy.get(topologySelectors.edgeToggle).check()
        cy.get(topologySelectors.groupEdgesToggle).should('not.be.disabled')
    })

    it("(OCP-53591, aramesha) should verify group edges toggle on/off", function () {
        topologyPage.selectScopeGroup("resource", "owners")
        cy.contains('Display options').should('exist').click()
        cy.get(topologySelectors.groupEdgesToggle).should('be.checked')

        // With group edges on, aggregate edges should exist
        cy.get('[data-test^="aggregate-edge-"]').should('exist')
        cy.get('#drawer ' + topologySelectors.edge).should('have.length.greaterThan', 0)

        // Toggle group edges off — aggregate edges should disappear, leaf edges should remain
        cy.get(topologySelectors.groupEdgesToggle).uncheck()
        cy.get('[data-test^="aggregate-edge-"]').should('not.exist')
        cy.get('#drawer ' + topologySelectors.edge).should('have.length.greaterThan', 0)

        // Toggle group edges back on — aggregate edges should reappear
        cy.get(topologySelectors.groupEdgesToggle).check()
        cy.get('[data-test^="aggregate-edge-"]').should('exist')
        cy.get('#drawer ' + topologySelectors.edge).should('have.length.greaterThan', 0)
    })

    it("(OCP-53591, memodi) should verify edges display/hidden", function () {
        topologyPage.selectScopeGroup("resource", "owners")
        cy.contains('Display options').should('exist').click()
        cy.get(topologySelectors.edgeToggle).uncheck()

        // verify labels and group edges are also disabled
        cy.get('#edges-tag-switch').should('be.disabled')
        cy.get(topologySelectors.groupEdgesToggle).should('be.disabled')
        cy.get(topologySelectors.defaultLayer).each((node, index) => {
            cy.wrap(node).should('not.have.descendants', '' + topologySelectors.edge)
        })
        cy.get(topologySelectors.edgeToggle).check()
        cy.get('#edges-tag-switch').should('be.enabled')
        cy.get(topologySelectors.groupEdgesToggle).should('not.be.disabled')
        cy.get(topologySelectors.defaultLayer).each((node, index) => {
            cy.wrap(node).should('have.descendants', '' + topologySelectors.edge)
        })
    })

    it("(OCP-53591, memodi) should verify edges labels can be displayed/hidden", function () {
        netflowPage.selectSourceNS(project)
        topologyPage.selectScopeGroup(undefined, "none")
        topologyPage.selectScopeGroup("namespace")
        cy.get('#reset-view').should('exist').click()
        cy.byLegacyTestID('edge-handler').find('g.pf-topology__edge__tag').should("exist")


        cy.contains('Display options').should('exist').click()
        cy.get(topologySelectors.labelToggle).uncheck()

        cy.byLegacyTestID('edge-handler').find('g.pf-topology__edge__tag').should("not.exist")

        cy.get(topologySelectors.labelToggle).check()
        cy.byLegacyTestID('edge-handler').find('g.pf-topology__edge__tag').should("exist")
        netflowPage.clearAllFilters()
    })

    it("(OCP-53591, memodi) should verify badges display/hidden", function () {
        netflowPage.selectSourceNS(project)
        topologyPage.selectScopeGroup(undefined, "none")
        topologyPage.selectScopeGroup("namespace")
        cy.get('#reset-view').should('exist').click()

        cy.contains('Display options').should('exist').click()
        cy.get(topologySelectors.badgeToggle).uncheck()

        cy.get('g.pf-topology__node__label').each((node, index) => {
            cy.wrap(node).should('not.have.descendants', 'g.pf-topology__node__label__badge')
        })
        // not checking the existence of the badge since there may be an 
        // "Unknown" node present with empty badge.
        netflowPage.clearAllFilters()
    })

    afterEach("after each tests", function () {
        cy.contains('Display options').should('exist').click()
        netflowPage.resetClearFilters()
    })

    after("after all tests", function () {
        cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
    })
})
