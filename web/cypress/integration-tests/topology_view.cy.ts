import { genSelectors, netflowPage, topologyPage, topologySelectors } from "@views/netflow-page"
import { Operator } from "@views/netobserv"

const metricFunction = [
    "Latest rate",
    "Average rate",
    "Min rate",
    "Max rate",
    "Total"
]
const metricType = [
    "Bytes",
    "Packets"
]

describe("(OCP-53591) Netflow Topology view features", { tags: ['Network_Observability'] }, function () {
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

    it("(OCP-53591, memodi) should verify topology page features", { tags: ['@netobserv-critical'] }, function () {
        cy.byTestID('search-topology-element-input').should('exist')
        cy.contains('Display options').should('exist').click()

        cy.byTestID(topologySelectors.metricsFunctionDrop).should('exist').click()
        cy.get(topologySelectors.metricsFunction).find('li').should('have.length', 5).each((item, index) => {
            cy.wrap(item).should('contain.text', metricFunction[index])
        })
        cy.byTestID(topologySelectors.metricTypeDrop).should('exist').click()
        cy.get(topologySelectors.metricType).find('li').should('have.length', 2).each((item, index) => {
            cy.wrap(item).should('contain.text', metricType[index])
        })
        cy.contains('Display options').should('exist').click()

        cy.byTestID(genSelectors.timeDrop).should('exist')
        cy.byTestID(genSelectors.refreshDrop).should('exist')
        cy.get('#zoom-in').should('exist')
        cy.get('#zoom-out').should('exist')
        cy.get('#reset-view').should('exist')
        cy.get('#query-summary').should('exist')
    })

    it("(OCP-53591, memodi) should verify local storage", function () {
        // modify some options
        cy.contains('Display options').should('exist').click()
        cy.byTestID('truncate-dropdown').click().byTestID("25").click()
        cy.get(topologySelectors.badgeToggle).uncheck()
        cy.byTestID('scope-dropdown').should('exist').click().byTestID('namespace').should('exist').click()
        cy.contains('Display options').should('exist').click()

        cy.visit('/monitoring/alerts')
        cy.visit('/netflow-traffic')
        cy.get('#drawer').should('exist')

        cy.get('#pageHeader').should('exist').then(() => {
            const rawSettings = localStorage.getItem('netobserv-plugin-settings')
            expect(rawSettings, 'netobserv-plugin-settings should exist').to.not.be.null
            const settings = JSON.parse(rawSettings as string)
            const topologySettings = settings['netflow-traffic-topology-options']

            expect(settings['netflow-traffic-view-id']).to.be.equal('topology')
            expect(topologySettings['edgeTags']).to.be.true
            expect(topologySettings['edges']).to.be.true
            expect(topologySettings['groupEdges']).to.be.true
            expect(topologySettings['groupTypes']).to.be.equal('auto')
            // expect(topologySettings['layout']).to.be.equal('Grid')
            expect(topologySettings['metricFunction']).to.be.equal('last')
            expect(topologySettings['metricType']).to.be.equal('Bytes')
            expect(topologySettings['nodeBadges']).to.be.false
            expect(settings['netflow-traffic-metric-scope']).to.be.equal('namespace')
            expect(topologySettings['truncateLength']).to.be.equal(25)
        })
    })

    it("(OCP-53591, memodi) should verify side panel", function () {
        cy.get('g[data-kind="node"] > g').eq(1).parent().should('exist').click()
        cy.get('#elementPanel').should('be.visible')

        // details tab
        cy.get('#drawer-tabs').contains('Details').should('exist')
        // metrics tab
        cy.get('#drawer-tabs').contains('Metrics').should('exist').click()
        cy.get('.element-metrics-container svg').should('exist')
    })

    afterEach("test", function () {
        netflowPage.resetClearFilters()
    })

    after("all tests", function () {
        cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
    })
})
