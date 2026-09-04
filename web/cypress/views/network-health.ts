export namespace networkHealthSelectors {
    export const global = '[id^="pf-tab-global"]'
    export const node = '[id^="pf-tab-per-node"]'
    export const namespace = '[id^="pf-tab-per-namespace"]'
    export const workload = '[id^="pf-tab-per-owner"]'
    export const platform = '[data-test="health-context-tab-platform"]'
    export const platformGlobal = '[data-test="health-platform-tab-global"]'
    export const platformNodes = '[data-test="health-platform-tab-nodes"]'
    export const nodeCard = '[data-test^="health-card-"]'
    export const sidePanel = '[data-test="health-drawer-content"]'
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
