export namespace networkHealthSelectors {
    export const global = '[id^="pf-tab-global"]'
    export const node = '[id^="pf-tab-per-node"]'
    export const namespace = '[id^="pf-tab-per-namespace"]'
    export const workload = '[id^="pf-tab-per-owner"]'
    export const nodeCard = '[data-test^="health-card-"]'
    export const sidePanel = '[data-test="health-drawer-content"]'
}

// Selectors for the Network Health filters toolbar (see health-filters-toolbar.tsx / health-multi-select-filter.tsx)
export namespace networkHealthFiltersSelectors {
    export const toolbar = '[data-test="health-filters-toolbar"]'
    export const severityToggle = '[data-test="health-severity-filter-toggle"]'
    export const statusToggle = '[data-test="health-status-filter-toggle"]'
    export const modeToggle = '[data-test="health-mode-filter-toggle"]'
    // The Namespace filter is a free-text typeahead (type a name/pattern + Enter, or pick a suggestion),
    // not a checkbox toggle: the focusable element is the nested search <input>.
    export const namespaceInput = '[data-test="health-namespace-filter-input"]'
    // SearchInput is a composite PatternFly component; `data-test` lands on its wrapper, so the actual
    // focusable element is the nested <input>.
    export const nameInput = '[data-test="health-name-filter"] input'
    export const clearAll = '[data-test="health-filters-clear-all"]'
    export const option = (filterId: string, value: string) => `[data-test="${filterId}-option-${value}"]`
}


export const networkHealth = {
    clickOnAlert: (name: string) => {
        cy.get(`[data-test^="health-card-${name}"]`, { timeout: 60000 }).eq(0).should('be.visible').find('button').click()
    },
    verifyAlert: (name: string, mode: string = "alert", alertText?: string) => {
        cy.get(`[data-test^="health-card-${name}"]`, { timeout: 120000 }).eq(0).should('be.visible').find('button').click({ force: true }).then(() => {
            cy.get(networkHealthSelectors.sidePanel).should('be.visible')
            cy.contains(mode).should('exist')
            if (alertText) {
                cy.contains(alertText).should('exist')
            }
            cy.get(`[data-test^="health-card-${name}"]`).eq(0).find('button').click({ force: true })
            cy.get(networkHealthSelectors.sidePanel).should('not.exist')
        })
    },
    navigateToAlertPage: (name: string) => {
        networkHealth.clickOnAlert(name)
        cy.get(networkHealthSelectors.sidePanel).should('be.visible').then(() => {
            cy.get('button[aria-label="Kebab toggle"]').first().click().then(() => {
                // verify Runbooks
                cy.contains('View runbook').should('have.attr', 'href').and('include', 'https');
                // Inspect alert
                cy.contains('Inspect alert').click().then(() => {
                    cy.byTestID('empty-box').should('not.exist')
                })
            })
        })
    },
    navigateToNetflowTrafficPage: (name: string) => {
        networkHealth.clickOnAlert(name)
        cy.get(networkHealthSelectors.sidePanel).should('be.visible').then(() => {
            cy.get('button[aria-label="Kebab toggle"]').first().click().then(() => {
                cy.contains('Inspect network traffic').click().then(() => {
                
                })
            })
        })
    }
}
