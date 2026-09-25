import { colSelectors, filterSelectors, netflowPage, overviewSelectors, querySumSelectors } from "@views/netflow-page"
import { Operator, project } from "@views/netobserv"

describe('(OCP-67087) DNSTracking test', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
        cy.uiLogin(Cypress.env('LOGIN_IDP'), Cypress.env('LOGIN_USERNAME'), Cypress.env('LOGIN_PASSWORD'))

        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector("DNSTracking")
    })

    beforeEach('any DNSTracking test', function () {
        netflowPage.visit()
        netflowPage.selectView('dns')
    })

    it("(OCP-67087, aramesha) Verify DNSTracking panels and Query Summary", function () {
        // verify DNS Latency view preset panels are visible
        cy.checkPanel(overviewSelectors.defaultDNSTrackingPanels)
        cy.checkPanelsNum(overviewSelectors.defaultDNSTrackingPanels.length);

        // open panels modal and verify all relevant panels are listed
        cy.openPanelsModal()
        cy.checkPopItems(overviewSelectors.panelsModal, overviewSelectors.manageDNSTrackingPanelsList);

        // select all panels and verify they are rendered
        cy.get(overviewSelectors.panelsModal).contains('Select all').click();
        cy.get(overviewSelectors.panelsModal).contains('Save').click();
        netflowPage.waitForLokiQuery()
        // 7 DNS + 4 generic rate panels
        cy.checkPanelsNum(11);

        netflowPage.waitForLokiQuery()
        cy.checkPanel(overviewSelectors.allDNSTrackingPanels)

        // restore default panels and verify they are visible
        cy.openPanelsModal();
        cy.byTestID(overviewSelectors.resetDefault).click().byTestID(overviewSelectors.save).click()
        netflowPage.waitForLokiQuery()
        cy.checkPanel(overviewSelectors.defaultDNSTrackingPanels)
        cy.checkPanelsNum(overviewSelectors.defaultDNSTrackingPanels.length);

        // verify Query Summary stats for DNSTracking
        cy.checkQuerySummary(querySumSelectors.dnsAvg)
    })

    it("(OCP-67087, aramesha) Validate DNSTracking columns and DNSName", function () {
        cy.get('#tabs-container').contains('Traffic flows').click()
        cy.byTestID("table-composable").should('exist')
        netflowPage.stopAutoRefresh()

        // verify DNS Latency view preset columns: DNS Latency and DNS Response Code
        cy.byTestID('table-composable').should('exist').within(() => {
            cy.get(colSelectors.dnsLatency).should('exist')
            cy.get(colSelectors.dnsResponseCode).should('exist')
        })

        // add filter for dst_ns=netobserv and DNSName=loki
        const dns_name = "loki.netobserv.svc.cluster"
        cy.get(filterSelectors.filterInput).type("dst_namespace=" + project + '{enter}')
        cy.get(filterSelectors.filterInput).type("dns_name=" + dns_name + '{enter}')
        netflowPage.waitForTableRows(1)

        // DNS Id / Error are in the DNS Latency preset; add DNS Name for this assertion.
        // Avoid selectAndVerifyColumns (reloads and would drop the draft view).
        cy.openColumnsModal().then(() => {
            cy.get(colSelectors.columnsModal).should('be.visible')
            cy.get(colSelectors.dnsName).check()
            cy.byTestID(colSelectors.save).click()
        })
        cy.byTestID('table-composable').within(() => {
            cy.get(colSelectors.dnsId).should('exist')
            cy.get(colSelectors.dnsError).should('exist')
            cy.get(colSelectors.dnsName).should('exist')
        })

        // Verify DNSName value for all rows
        cy.get('[data-test-td-column-id="DNSName"]').each((td) => {
            expect(td).to.contain(`${dns_name}`)
        })

        netflowPage.clearAllFilters()
    })

    afterEach("test", function () {
        netflowPage.resetClearFilters()
    })

    after("all tests", function () {
        Operator.deleteFlowCollector()
        cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
    })
})
