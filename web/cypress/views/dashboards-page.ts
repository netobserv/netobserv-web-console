export const dashboard = {
    visitDashboard: (dashboardName: string) => {
        // The Console falls back to the default dashboard if the requested
        // ConfigMap hasn't been picked up yet. Retry until the URL stays on
        // the expected dashboard (the Console redirects away when it's unknown).
        const ensureDashboard = (retries = 5): void => {
            cy.visit(`/monitoring/dashboards/${dashboardName}`)
            cy.byTestID('dashboard-dropdown', { timeout: 60000 }).should('exist')
            cy.url().then(url => {
                if (!url.includes(dashboardName) && retries > 0) {
                    cy.log(`Redirected away from ${dashboardName}, dashboard not registered yet (${retries} retries left)`)
                    cy.wait(10000)
                    ensureDashboard(retries - 1)
                }
            })
        }
        ensureDashboard()
        cy.url({ timeout: 10000 }).should('include', dashboardName)

        cy.contains('label', 'Refresh interval').parent().siblings().find('button').first().click()
        cy.contains('15 seconds').should('exist').click()

        cy.contains('label', 'Time range').parent().siblings().find('button').first().click()
        cy.contains('Last 5 minutes').should('exist').click()

        cy.get('#content-scrollable').scrollTo('bottom')
    }
}

export namespace dashboardSelectors {
    export const flowStatsToggle = '[data-test-id=panel-flowlogs-pipeline-statistics] button:first'
    export const ebpfStatsToggle = '[data-test-id=panel-e-bpf-agent-statistics] button:first'
    export const operatorStatsToggle = '[data-test-id=panel-operator-statistics] button:first'
    export const resourceStatsToggle = '[data-test-id=panel-resource-usage] button:first'
    export const top10PerRouteToggle = '[data-test-id=panel-top-10-per-route] button:first'
    export const top10PerNamespaceToggle = '[data-test-id=panel-top-10-per-namespace] button:first'
    export const top10PerShardToggle = '[data-test-id=panel-top-10-per-shard] button:first'
}

export const graphSelector = {
    graphBody: '.pf-v6-c-card__body'
}

Cypress.Commands.add('checkDashboards', (names) => {
    for (let i = 0; i < names.length; i++) {
        const name = names[i]
        // Re-query from data-test on every retry — chaining .first() detaches when Console
        // re-renders dashboards (auth recovery, poll refresh, accordion expand).
        cy.get(`[data-test="${name}"]`, { timeout: 120000 }).should($panels => {
            expect($panels.length, `${name} should exist`).to.be.greaterThan(0)
            const $region = Cypress.$($panels[0]).find(graphSelector.graphBody)
            expect($region.length, `${name} graph region should exist`).to.be.greaterThan(0)
            expect(
                $region.find('[data-test="empty-state"]').length,
                `${name} should not be empty`
            ).to.equal(0)
        })
    }
})

declare global {
    namespace Cypress {
        interface Chainable {
            checkDashboards(names: string[]): Chainable<Element>
        }
    }
}
