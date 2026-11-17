import { Operator, project } from "@views/netobserv"
import { netflowPage } from "@views/netflow-page"

const waitForMetricsDownload = (extension: string, retries = 5): void => {
    cy.exec("ls cypress/downloads", { failOnNonZeroExit: false }).then((response) => {
        const files = (response.stdout || '').trim().split('\n').filter(f => f.endsWith(`.${extension}`))
        if (files.length === 0 && retries > 0) {
            cy.wait(2000)
            waitForMetricsDownload(extension, retries - 1)
            return
        }
        expect(files.length).to.be.greaterThan(0)
        const metricsFile = files[0]
        expect(metricsFile).to.match(/^netobserv_metrics_[\w.-]+$/)
        cy.exec(`mv "cypress/downloads/${metricsFile}" "cypress/downloads/metrics_export.${extension}"`)
        cy.readFile(`cypress/downloads/metrics_export.${extension}`, { timeout: 10000 })
        cy.exec(`rm cypress/downloads/metrics_export.${extension}`)
    })
}

describe('(NETOBSERV-680) Metrics export automation', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.setAsClusterAdmin();
        cy.uiLoginDefaultUser();

        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector()
    })

    beforeEach('any metrics export test', function () {
        netflowPage.visit()
        netflowPage.waitForLokiQuery()
    })

    it("(NETOBSERV-680, osmakal) should validate exporting metrics report from overview", function () {
        cy.get('li.overviewTabButton').should('exist').click()
        netflowPage.stopAutoRefresh()
        cy.showAdvancedOptions();
        cy.get('#export-metrics-button').should('exist').click()
        cy.byTestID('metrics-export-modal').should('be.visible')
        cy.exec("rm -f cypress/downloads/netobserv_metrics_*", { failOnNonZeroExit: false })
        cy.byTestID('metrics-export-modal').within(() => {
            cy.get('#metrics-export-format-csv').should('be.checked')
            cy.get('#metrics-export-topology-edges').should('not.exist')
            cy.byTestID('metrics-export-button').should('not.be.disabled').click()
        })
        waitForMetricsDownload('csv')
    })

    it("(NETOBSERV-680, osmakal) should validate exporting metrics report from topology as JSON", function () {
        cy.get('#tabs-container').contains('Topology').click()
        netflowPage.selectSourceNS(project)
        netflowPage.stopAutoRefresh()
        cy.get('#drawer').should('not.be.empty')
        cy.showAdvancedOptions();
        cy.get('#export-metrics-button').should('exist').click()
        cy.byTestID('metrics-export-modal').should('be.visible')
        cy.exec("rm -f cypress/downloads/netobserv_metrics_*", { failOnNonZeroExit: false })
        cy.byTestID('metrics-export-modal').within(() => {
            cy.get('#metrics-export-format-json').click()
            cy.get('#metrics-export-topology-edges').should('exist').and('be.disabled')
            cy.byTestID('metrics-export-button').should('not.be.disabled').click()
        })
        waitForMetricsDownload('json')
        netflowPage.clearAllFilters()
    })

    it("(NETOBSERV-680, osmakal) should validate exporting metrics report from topology as spreadsheet", function () {
        cy.get('#tabs-container').contains('Topology').click()
        netflowPage.selectSourceNS(project)
        netflowPage.stopAutoRefresh()
        cy.get('#drawer').should('not.be.empty')
        cy.showAdvancedOptions();
        cy.get('#export-metrics-button').should('exist').click()
        cy.byTestID('metrics-export-modal').should('be.visible')
        cy.exec("rm -f cypress/downloads/netobserv_metrics_*", { failOnNonZeroExit: false })
        cy.byTestID('metrics-export-modal').within(() => {
            cy.get('#metrics-export-format-spreadsheet').click()
            cy.get('#metrics-export-topology-edges').should('be.enabled').and('be.checked')
            cy.byTestID('metrics-export-button').should('not.be.disabled').click()
        })
        waitForMetricsDownload('xls')
        netflowPage.clearAllFilters()
    })

    afterEach("test", function () {
        netflowPage.resetClearFilters()
    })

    after("all tests", function () {
        cy.unsetAsClusterAdmin()
    })
})
