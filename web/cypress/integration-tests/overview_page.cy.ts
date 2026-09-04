import { genSelectors, netflowPage, overviewSelectors, querySumSelectors } from "@views/netflow-page"
import { Operator } from "@views/netobserv"

describe('(OCP-54839) Netflow Overview page tests', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
        cy.uiLogin(Cypress.env('LOGIN_IDP'), Cypress.env('LOGIN_USERNAME'), Cypress.env('LOGIN_PASSWORD'))

        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector()
    })

    beforeEach('overview page test', function () {
        netflowPage.visit()
        netflowPage.waitForLokiQuery()
        cy.get('.overviewTabButton').should('exist')

        cy.checkPanel(overviewSelectors.defaultPanels)
        cy.checkPanelsNum();
    })

    it("(OCP-54839, aramesha) should validate overview page features", { tags: ['@netobserv-critical'] }, function () {
        cy.byTestID(genSelectors.timeDrop).then(btn => {
            expect(btn).to.exist
            cy.wrap(btn).click().then(drop => {
                cy.byTestID('1h').should('exist').click()
            })
        })

        cy.byTestID(genSelectors.refreshDrop).then(btn => {
            expect(btn).to.exist
            cy.wrap(btn).click().then(drop => {
                cy.byTestID('15s').should('exist').click()
            })
        })

        cy.byTestID(genSelectors.refreshBtn).should('exist').click()

        cy.showAdvancedOptions().then(views => {
            cy.contains('Display options').should('exist').click()

            // validate scope dropdown
            cy.byTestID(overviewSelectors.scopeDrop).then(btn => {
                expect(btn).to.exist
                cy.wrap(btn).click().then(drop => {
                    cy.byTestID('host').should('exist')
                    cy.byTestID('namespace').should('exist')
                    cy.byTestID('owner').should('exist')
                    cy.byTestID('resource').should('exist').click()
                })
            })

            // verify truncate labels dropdown
            cy.byTestID(overviewSelectors.truncateDrop).then(btn => {
                expect(btn).to.exist
                cy.wrap(btn).click().then(drop => {
                    cy.byTestID('0').should('exist')
                    cy.byTestID('10').should('exist')
                    cy.byTestID('20').should('exist')
                    cy.byTestID('30').should('exist')
                    cy.byTestID('40').should('exist')
                    cy.byTestID('25').should('exist').click()
                })
            })
        })
    })

    it("(OCP-54839, aramesha) should validate query summary panel", function () {
        cy.get(querySumSelectors.bytesCount).should($el => {
            expect(parseFloat($el.text())).to.be.greaterThan(0)
        })

        cy.get(querySumSelectors.bpsCount).should($el => {
            expect(parseFloat($el.text())).to.be.greaterThan(0)
        })
        cy.get('#query-summary-toggle').should('exist').click()
        cy.get('#summaryPanel').should('be.visible')
        cy.contains('Results').should('exist')
        cy.contains('Cardinality').should('exist')
        cy.contains('Configuration').should('exist')
        cy.contains('Sampling').should('exist')
    })

    it("(OCP-54839, aramesha) should validate panels", { tags: ['@netobserv-critical'] }, function () {
        cy.showAdvancedOptions().then(views => {
            cy.contains('Display options').should('exist').click()

            // verify single focus graph toggle
            cy.get('#focus-switch').check()
            // verify 'Top 5 average bytes rates' panel is in focus
            cy.get('#overview-sticky-graph').contains('Top 5 average bytes rates');
            cy.get('[data-test-metrics]').its('length').should('gt', 0);

            // verify other panels are scrollable on the right
            for (let i = 0; i < overviewSelectors.defaultPanels.length; i++) {
                cy.get('#overview-graph-list').contains(overviewSelectors.defaultPanels[i])
            }

            // uncheck single focus toggle and verify panels
            cy.get('#focus-switch').check()
            cy.checkPanel(overviewSelectors.defaultPanels)
            cy.checkPanelsNum();
        })

        // open panels modal
        cy.openPanelsModal();

        // verify all panels are listed  
        cy.checkPopItems(overviewSelectors.panelsModal, overviewSelectors.managePanelsList);

        // select all panels
        cy.get(overviewSelectors.panelsModal).contains('Select all').click();
        cy.get(overviewSelectors.panelsModal).contains('Save').click();
        netflowPage.waitForLokiQuery()
        cy.checkPanelsNum(4);

        // verify all panels are rendered
        netflowPage.waitForLokiQuery()
        cy.checkPanel(overviewSelectors.allPanels)

        // unselect all panels and verify save is disabled
        cy.openPanelsModal();
        cy.get(overviewSelectors.panelsModal).contains('Unselect all').click();
        cy.get(overviewSelectors.panelsModal).contains('Save').should('be.disabled');

        // select 1 panel and verify its visible on console
        cy.get('[data-test="overview-panel-management"]').find('#top_avg_packet_rates').check();
        cy.get(overviewSelectors.panelsModal).contains('Save').click();
        netflowPage.waitForLokiQuery()
        cy.checkPanel([overviewSelectors.allPanels[2]])
        cy.checkPanelsNum(1);

        // restore default panels and verify visible on console
        cy.openPanelsModal();
        cy.get(overviewSelectors.panelsModal).contains('Restore default panels').click();
        cy.get(overviewSelectors.panelsModal).contains('Save').click();
        netflowPage.waitForLokiQuery()
        cy.checkPanel(overviewSelectors.defaultPanels)
        cy.checkPanelsNum();
    })

    afterEach("test", function () {
        netflowPage.resetClearFilters()
    })

    after("after all tests", function () {
        cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
    })
})
