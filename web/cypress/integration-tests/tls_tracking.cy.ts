import { colSelectors, filterSelectors, netflowPage, overviewSelectors } from "@views/netflow-page"
import { Operator } from "@views/netobserv"

describe('(OCP-88966) TLSTracking test', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
        cy.uiLogin(Cypress.env('LOGIN_IDP'), Cypress.env('LOGIN_USERNAME'), Cypress.env('LOGIN_PASSWORD'))

        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector("TLSTracking")
    })

    beforeEach('any TLSTracking test', function () {
        netflowPage.visit()
        netflowPage.selectView('tls')
    })

    it("(OCP-88966, aramesha) Verify TLSTracking panels", function () {
        // verify TLS Tracking view preset panels are visible
        cy.checkPanel(overviewSelectors.defaultTLSTrackingPanels)
        cy.checkPanelsNum(overviewSelectors.defaultTLSTrackingPanels.length);

        // open panels modal and verify all relevant panels are listed
        cy.openPanelsModal()
        cy.checkPopItems(overviewSelectors.panelsModal, overviewSelectors.manageTLSTrackingPanelsList);

        // select all panels and verify they are rendered
        cy.get(overviewSelectors.panelsModal).contains('Select all').click();
        cy.get(overviewSelectors.panelsModal).contains('Save').click();
        netflowPage.waitForLokiQuery()
        // 4 TLS + 4 generic rate panels
        cy.checkPanelsNum(8);
        cy.checkPanel(overviewSelectors.allTLSTrackingPanels)

        // restore default panels and verify they are visible
        cy.openPanelsModal();
        cy.byTestID(overviewSelectors.resetDefault).click().byTestID(overviewSelectors.save).click()
        netflowPage.waitForLokiQuery()
        cy.checkPanel(overviewSelectors.defaultTLSTrackingPanels)
        cy.checkPanelsNum(overviewSelectors.defaultTLSTrackingPanels.length);
    })

    it("(OCP-88966, aramesha) Validate TLSTracking columns", function () {
        cy.get('#tabs-container').contains('Traffic flows').click()
        cy.byTestID("table-composable").should('exist')
        netflowPage.stopAutoRefresh()

        // verify TLS Tracking view preset columns
        cy.byTestID('table-composable').should('exist').within(() => {
            cy.get(colSelectors.tlsVersion).should('exist')
            cy.get(colSelectors.tlsCipherSuite).should('exist')
            cy.get(colSelectors.tlsGroup).should('exist')
            cy.get(colSelectors.tlsTypes).should('exist')
        })

        // add filter for tls_version= TLS 1.3 and tls_types = ServerHello
        cy.get(filterSelectors.filterInput).type("tls_version=TLS 1.3" + '{enter}')
        cy.get(filterSelectors.filterInput).type("tls_types=ServerHello" + '{enter}')
        netflowPage.waitForTableRows(1)

        // Verify TLS column data for all rows
        cy.get('[data-test-td-column-id="TLSVersion"]')
            .should('have.length.greaterThan', 0)
            .each((td) => {
                expect(td).to.contain('TLS 1.3')
        })
        cy.get('[data-test-td-column-id="TLSTypes"]').each((td) => {
            expect(td).to.contain('ServerHello')
        })
        cy.get('[data-test-td-column-id="TLSGroup"]').each((td) => {
            expect(td.text().trim()).to.not.be.empty
        })
        cy.get('[data-test-td-column-id="TLSCipherSuite"]').each((td) => {
            expect(td.text().trim()).to.not.be.empty
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
