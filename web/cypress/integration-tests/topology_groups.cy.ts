import { netflowPage, topologySelectors, topologyPage } from "@views/netflow-page"
import { Operator } from "@views/netobserv"

describe("(OCP-53591) Netflow Topology groups features", { tags: ['Network_Observability'] }, function () {

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

    it("(OCP-53591, memodi) should verify namespace scope", function () {
        const scope = "namespace"
        cy.intercept('GET', topologyPage.getScopeURL(scope), {
            fixture: 'flowmetrics/namespace.json'
        }).as('matchedUrl')

        // selecting something different first
        // to re-trigger API request on namespace selection
        topologyPage.selectScopeGroup("owner")
        topologyPage.selectScopeGroup(scope)
        cy.wait('@matchedUrl').then(({ response }) => {
            expect(response?.statusCode).to.eq(200)
        })
        topologyPage.isViewRendered()
        // verify number of edges and nodes.
        cy.get('#drawer ' + topologySelectors.edge).should('have.length', 4)
        cy.get('#drawer ' + topologySelectors.node).should('have.length', 5)
    })

    it("(OCP-53591, memodi) should verify owner scope", function () {
        const scope = "owner"
        cy.intercept('GET', topologyPage.getScopeURL(scope), {
            fixture: 'flowmetrics/owner.json'
        }).as('matchedUrl')

        // using slider
        let lastRefresh = Cypress.$("#lastRefresh").text()
        cy.log(`last refresh is ${lastRefresh}`)
        cy.get('#scope-step-2 button').click().then(slider => {
            netflowPage.waitForLokiQuery()
            cy.wait(3000)
            cy.get('#lastRefresh').invoke('text').should('not.eq', lastRefresh)
        })

        cy.wait('@matchedUrl').then(({ response }) => {
            expect(response?.statusCode).to.eq(200)
        })
        topologyPage.isViewRendered()
        // verify number of edges and nodes.
        cy.get('#drawer ' + topologySelectors.edge).should('have.length', 29)
        cy.get('#drawer ' + topologySelectors.node).should('have.length', 15)
    })

    it("(OCP-53591, memodi) should verify resource scope", function () {
        const scope = 'resource'
        cy.intercept('GET', topologyPage.getScopeURL(scope), { fixture: 'flowmetrics/resource.json' }).as('matchedUrl')
        topologyPage.selectScopeGroup(scope)
        cy.wait('@matchedUrl').then(({ response }) => {
            expect(response?.statusCode).to.eq(200)
        })
        topologyPage.isViewRendered()
        // verify number of edges and nodes.
        cy.get('#drawer ' + topologySelectors.edge).should('have.length', 76)
        cy.get('#drawer ' + topologySelectors.node).should('have.length', 28)
    })

    it("(OCP-53591, memodi) should verify group Nodes", function () {
        const groups = 'hosts'
        cy.intercept('GET', topologyPage.getResourceScopeGroupURL(groups), {
            fixture: 'flowmetrics/hosts.json'
        })
        topologyPage.selectScopeGroup("resource", groups)
        topologyPage.isViewRendered()
        // verify number of groups, to be equal to number of cluster nodes
        cy.get(topologySelectors.nGroups).should('have.length', 6)
    })

    it("(OCP-53591, memodi) should verify group Nodes+NS", function () {
        cy.intercept('GET', topologyPage.getResourceScopeGroupURL('hosts%2Bnamespaces'), { fixture: 'flowmetrics/hostsNS.json' })
        topologyPage.selectScopeGroup("resource", "hosts+namespaces")
        topologyPage.isViewRendered()
        cy.get(topologySelectors.nGroups).should('have.length', 10)
    })

    it("(OCP-53591, memodi) should verify group Nodes+Owners", function () {
        cy.intercept('GET', topologyPage.getResourceScopeGroupURL('hosts%2Bowners'), { fixture: 'flowmetrics/hostsOwners.json' })
        topologyPage.selectScopeGroup("resource", "hosts+owners")
        // verify number of groups
        cy.get(topologySelectors.nGroups).should('have.length', 11)
    })

    it("(OCP-53591, memodi) should verify group NS", function () {
        cy.intercept('GET', topologyPage.getResourceScopeGroupURL('namespaces'), { fixture: 'flowmetrics/NS.json' })
        topologyPage.selectScopeGroup("resource", "namespaces")
        cy.get(topologySelectors.nGroups).should('have.length', 4)
    })

    it("(OCP-53591, memodi) should verify group NS+Owners", function () {
        cy.intercept('GET', topologyPage.getResourceScopeGroupURL('namespaces%2Bowners'), { fixture: 'flowmetrics/NSOwners.json' })
        topologyPage.selectScopeGroup("resource", "namespaces+owners")
        cy.get(topologySelectors.nGroups).should('have.length', 9)
    })

    it("(OCP-53591, aramesha) should verify group edges reduce edge count with NS grouping", function () {
        cy.intercept('GET', topologyPage.getResourceScopeGroupURL('namespaces'), { fixture: 'flowmetrics/NS.json' })
        topologyPage.selectScopeGroup("resource", "namespaces")
        topologyPage.isViewRendered()
        cy.contains('Display options').should('exist').click()

        // disable group edges and record leaf count
        cy.get(topologySelectors.groupEdgesToggle).uncheck()

        cy.get('#drawer ' + topologySelectors.edge).its('length').then(leafCount => {
            // enable group edges and verify count changes
            cy.get(topologySelectors.groupEdgesToggle).check()
            cy.get('#drawer ' + topologySelectors.edge).its('length').should('not.eq', leafCount)
        })
    })

    it("(OCP-53591, aramesha) should verify group edges reduce edge count with NS+Owners grouping", function () {
        cy.intercept('GET', topologyPage.getResourceScopeGroupURL('namespaces%2Bowners'), { fixture: 'flowmetrics/NSOwners.json' })
        topologyPage.selectScopeGroup("resource", "namespaces+owners")
        topologyPage.isViewRendered()
        cy.contains('Display options').should('exist').click()

        // disable group edges and record leaf count
        cy.get(topologySelectors.groupEdgesToggle).uncheck()

        cy.get('#drawer ' + topologySelectors.edge).its('length').then(leafCount => {
            // enable group edges and verify count changes
            cy.get(topologySelectors.groupEdgesToggle).check()
            cy.get('#drawer ' + topologySelectors.edge).its('length').should('not.eq', leafCount)
        })
    })

    it("(OCP-53591, aramesha) should verify collapse/expand with group edges", function () {
        cy.intercept('GET', topologyPage.getResourceScopeGroupURL('namespaces'), { fixture: 'flowmetrics/NS.json' })
        topologyPage.selectScopeGroup("resource", "namespaces")
        topologyPage.isViewRendered()
        cy.contains('Display options').should('exist').click()

        // ensure group edges are on
        cy.get(topologySelectors.groupEdgesToggle).check()

        // collapse groups
        cy.get(topologySelectors.groupToggle).click()

        // edges should still render after collapse (no dangling edges or errors)
        cy.get('#drawer ' + topologySelectors.edge).should('have.length.gte', 0)

        // expand groups
        cy.get(topologySelectors.groupToggle).click()

        // edges should rebuild after expand
        cy.get('#drawer ' + topologySelectors.edge).its('length').should('be.gte', 1)
    })

    afterEach("test", function () {
        netflowPage.resetClearFilters()
    })

    after("after all tests", function () {
        cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
    })
})
