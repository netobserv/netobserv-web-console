export namespace networkHealthSelectors {
    export const global = '[id^="pf-tab-global"]'
    export const node = '[id^="pf-tab-per-node"]'
    export const namespace = '[id^="pf-tab-per-namespace"]'
    export const workload = '[id^="pf-tab-per-owner"]'
    export const nodeCard = '[data-test^="health-card-"]'
    export const sidePanel = '[data-test="health-drawer-content"]'
}


const waitForHealthCard = (name: string, retries = 2): void => {
    const selector = `[data-test^="health-card-${name}"]`
    const pollForCard = (attempt = 0, maxAttempts = 12): void => {
        cy.get('body').then($body => {
            if ($body.find(selector).length > 0) {
                return
            }
            if (attempt < maxAttempts) {
                cy.wait(10000)
                pollForCard(attempt + 1, maxAttempts)
            } else if (retries > 0) {
                cy.log(`health-card-${name} not found, reloading (${retries} retries left)`)
                cy.reload()
                cy.get('#content-scrollable', { timeout: 30000 }).should('exist')
                waitForHealthCard(name, retries - 1)
            }
        })
    }
    pollForCard()
}

export const networkHealth = {
    clickOnAlert: (name: string) => {
        waitForHealthCard(name)
        cy.get(`[data-test^="health-card-${name}"]`).eq(0).should('be.visible').find('button').click()
    },
    verifyAlert: (name: string, mode: string = "alert", alertText?: string) => {
        waitForHealthCard(name)
        cy.get(`[data-test^="health-card-${name}"]`).eq(0).should('be.visible').find('button').click({ force: true }).then(() => {
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
