export namespace networkHealthSelectors {
    export const global = '[id^="pf-tab-global"]'
    export const node = '[id^="pf-tab-per-node"]'
    export const namespace = '[id^="pf-tab-per-namespace"]'
    export const workload = '[id^="pf-tab-per-owner"]'
    export const nodeCard = '[data-test^="health-card-"]'
    export const sidePanel = '[data-test="health-drawer-content"]'
    export const createRuleButton = '[data-test="create-health-rule-button"]'
    export const manageRulesButton = '[data-test="manage-health-rules-button"]'
    export const wizard = '#healthRuleWizard'
    export const createdAlert = '[data-test="health-rule-created-alert"]'
    export const rulesManager = '[data-test="health-rules-manager"]'
    export const dynamicForm = '[data-test-id="dynamic-form"]'
    export const wizardPrimary = '[data-test="health-rule-wizard-primary"]'
    export const wizardDelete = '[data-test="health-rule-wizard-delete"]'
    export const wizardDeleteConfirm = '[data-test="health-rule-wizard-delete-confirm"]'
    export const sourceTemplate = '[data-test="health-rule-source-template"]'
    export const sourceAlert = '[data-test="health-rule-source-alert"]'
    export const sourceRecording = '[data-test="health-rule-source-recording"]'
    export const discardModal = '#discard-changes-modal'
    export const discardConfirm = '[data-test="discard-changes-confirm"]'
}

/**
 *  helpers for the Network Health rule wizard (create/edit/delete).
 */
export const healthRuleWizard = {
    next: () => cy.contains('button', 'Next').should('be.visible').click(),
    back: () => cy.contains('button', 'Back').should('be.visible').click(),
    submit: () => cy.get(networkHealthSelectors.wizardPrimary).filter(':visible').should('be.enabled').click(),
    cancel: () => cy.contains('button', 'Cancel').filter(':visible').first().click(),
    continueEditing: () => cy.contains('button', 'Continue editing').should('be.visible').click(),

    // Config -> Review -> Config, waiting for the editor to mount before Back and the form to
    // return after so navigation is deterministic. The editor's benign dispose-time throw on
    // Back is handled by the uncaught:exception filter at the top of the spec.
    reviewRoundTrip: () => {
        healthRuleWizard.next()
        cy.get('.monaco-editor', { timeout: 60000 }).should('be.visible')
        healthRuleWizard.back()
        cy.get(networkHealthSelectors.dynamicForm, { timeout: 60000 }).should('be.visible')
    },

    fillCustomAlert: (opts: { name: string; namespace: string; group: string; alert: string }) => {
        cy.get('[data-test="root_metadata_name"] input').clear().type(opts.name)
        cy.get('[data-test="root_metadata_namespace"] input').clear().type(opts.namespace)
        cy.get('[data-test="root_spec_groups_0_name"] input').clear().type(opts.group)
        cy.get('[data-test="root_spec_groups_0_rules_0_alert"] input').clear().type(opts.alert)
        // Seed a valid PromQL expression from the built-in snippets menu.
        cy.get('[data-test="root_spec_groups_0_rules_0_expr-snippets-toggle"]').click()
        cy.contains('[role="menuitem"]', 'Incoming traffic surge').click()
    }
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
