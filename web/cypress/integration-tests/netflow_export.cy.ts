import { Operator, project } from "@views/netobserv"
import { netflowPage, exportSelectors } from "@views/netflow-page"

describe('(OCP-72610 Network_Observability) Export automation', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
        cy.uiLogin(Cypress.env('LOGIN_IDP'), Cypress.env('LOGIN_USERNAME'), Cypress.env('LOGIN_PASSWORD'))

        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector()
    })

    beforeEach('any export test', function () {
        netflowPage.visit()
    })

    it("(OCP-72610, aramesha, Network_Observability) should validate exporting panels", function () {
        // Export all overview panels
        cy.get('li.overviewTabButton').should('exist').click()
        netflowPage.stopAutoRefresh()
        cy.byTestID('show-view-options-button').should('exist').click()
        cy.get('#export-button').should('exist').click()
        cy.readFile('cypress/downloads/overview_page.png')

        // Export only Top 5 average bytes rates panel
        cy.get(exportSelectors.avgBytesRatesDropdown).should('exist').click()
        cy.contains("Export panel").should('exist').click()
        cy.readFile('cypress/downloads/overview_panel_top_avg_byte_rates.png')
        cy.exec('rm cypress/downloads/overview_page.png')
        cy.exec('rm cypress/downloads/overview_panel_top_avg_byte_rates.png')
    })

    it("(OCP-72610, aramesha, Network_Observability) should validate exporting table view", function () {
        cy.get('#tabs-container').contains('Traffic flows').click()
        netflowPage.stopAutoRefresh()
        netflowPage.selectSourceNS(project)
        cy.byTestID("table-composable").should('exist')
        cy.byTestID('show-view-options-button').should('exist').click()
        cy.get(exportSelectors.tableExport).should('exist').click()
        cy.exec("rm -f cypress/downloads/*.csv", { failOnNonZeroExit: false })
        cy.get('#export-modal').find(exportSelectors.exportButton).should('exist').then((exportbtn) => {
            cy.wrap(exportbtn).click()
            const waitForCsv = (retries = 5): void => {
                cy.exec("ls cypress/downloads", { failOnNonZeroExit: false }).then((response) => {
                    const files = (response.stdout || '').trim().split('\n').filter(f => f.endsWith('.csv'))
                    if (files.length === 0 && retries > 0) {
                        cy.wait(2000)
                        waitForCsv(retries - 1)
                        return
                    }
                    expect(files.length).to.be.greaterThan(0)
                    const csvFile = files[0]
                    expect(csvFile).to.match(/^[\w.-]+$/)
                    cy.exec(`mv "cypress/downloads/${csvFile}" "cypress/downloads/export_table.csv"`)
                    cy.readFile('cypress/downloads/export_table.csv', { timeout: 10000 })
                })
            }
            waitForCsv()
            cy.exec('rm cypress/downloads/export_table.csv')
        })
    })

    it("(OCP-72610, aramesha, Network_Observability) should validate exporting topology view", function () {
        cy.get('#tabs-container').contains('Topology').click()
        netflowPage.selectSourceNS(project)
        netflowPage.stopAutoRefresh()
        cy.get('#drawer').should('not.be.empty')
        cy.showAdvancedOptions()
        cy.get('#export-button').should('exist').click()
        cy.readFile('cypress/downloads/topology.png').then(() => {
            cy.exec('rm cypress/downloads/topology.png')
        })
    })

    afterEach("each test", function () {
        netflowPage.resetClearFilters()
    })

    after("all tests", function () {
        cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
    })
})
