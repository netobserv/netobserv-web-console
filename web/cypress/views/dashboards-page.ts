export const dashboard = {
    visit: () => {
        cy.visit('/monitoring/dashboards')
        cy.byTestID('dashboard-dropdown').should('exist').click()
    },
    visitDashboard: (dashboardName: string) => {
        cy.visit(`/monitoring/dashboards/${dashboardName}`)

        cy.get('#refresh-interval-dropdown-dropdown').should('exist').then(btn => {
            cy.wrap(btn).click().then(drop => {
                cy.contains('15 seconds').should('exist').click()
            })
        })

        cy.get('#monitoring-time-range-dropdown').should('exist').then(btn => {
            cy.wrap(btn).click().then(drop => {
                cy.contains('Last 5 minutes').should('exist').click()
            })
        })

        // to load all the graphs on the dashboard
        cy.wait(1000)
        cy.get('#content-scrollable').scrollTo('bottom')
        cy.wait(1000)
    }
}

export namespace dashboardSelectors {
    export const flowStatsToggle = '[data-test-id=panel-flowlogs-pipeline-statistics] > .pf-c-button'
    export const ebpfStatsToggle = '[data-test-id=panel-e-bpf-agent-statistics] > .pf-c-button'
    export const operatorStatsToggle = '[data-test-id=panel-operator-statistics] > .pf-c-button'
    export const resourceStatsToggle = '[data-test-id=panel-resource-usage] > .pf-c-button'
}

export const graphSelector = {
    graphBody: '.co-dashboard-card__body--dashboard > div > div'
}

Cypress.Commands.add('checkDashboards', (names) => {
    for (let i = 0; i < names.length; i++) {
        // Wait for panel to exist
        cy.byTestID(names[i], { timeout: 120000 }).should('exist').first().scrollIntoView()

        // Add wait to allow metrics to populate
        cy.wait(2000)

        // Check that graph body doesn't have empty state
        cy.byTestID(names[i]).first({ timeout: 120000 }).should($panel => {
            const $region = $panel.find(graphSelector.graphBody)
            expect($region.length, `${names[i]} graph region should exist`).to.be.greaterThan(0)
            expect($region.hasClass('graph-empty-state'), `${names[i]} should not be empty`).to.be.false
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
