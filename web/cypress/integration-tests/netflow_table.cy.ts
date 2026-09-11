import { colSelectors, filterSelectors, genSelectors, histogramSelectors, netflowPage } from "@views/netflow-page"
import { Operator, project } from "@views/netobserv"

describe('(OCP-50532, OCP-50531, OCP-50530, OCP-59408) Netflow Table view tests', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
        cy.uiLogin(Cypress.env('LOGIN_IDP'), Cypress.env('LOGIN_USERNAME'), Cypress.env('LOGIN_PASSWORD'))

        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector()
    })

    beforeEach("test", function () {
        netflowPage.visit()
        cy.get('#tabs-container').contains('Traffic flows').click()
        cy.byTestID("table-composable").should('exist')
    })

    it("(OCP-50532, memodi) should validate netflow table features", { tags: ['@netobserv-critical'] }, function () {
        cy.byTestID(genSelectors.timeDrop).then(btn => {
            expect(btn).to.exist
            cy.wrap(btn).click().then(drop => {
                cy.get('[data-test="1h"]').should('exist').click()
            })
        })

        cy.byTestID(genSelectors.refreshDrop).then(btn => {
            expect(btn).to.exist
            cy.wrap(btn).click().then(drop => {
                cy.get('[data-test="15s"]').should('exist').click()
            })
        })

        cy.byTestID(genSelectors.refreshBtn).should('exist').click()

        // change row sizes
        cy.byTestID("show-view-options-button").should('exist').click().then(views => {
            cy.contains('Display options').should('exist').click()
            cy.byTestID('size-s').click()
            cy.byTestID('size-l').click()
            cy.byTestID('size-m').click()
        })

        // expand view
        cy.get(genSelectors.fullScreen).click().then(() => {
            cy.get('#page-sidebar').then(sidenav => {
                cy.byLegacyTestID('admin-perspective-nav').should('not.be.visible')
            })
        })

        cy.byTestID("show-view-options-button").should('exist').click()
    })

    it("(OCP-50532, memodi) should validate columns", { tags: ['e2e', 'admin'] }, function () {
        netflowPage.stopAutoRefresh()
        cy.openColumnsModal().then(col => {
            cy.get(colSelectors.columnsModal).should('be.visible')
            cy.get(colSelectors.k8sOwner).check()
            cy.get(colSelectors.ipPort).check()

            cy.get(colSelectors.mac).should('exist').check()
            cy.get(colSelectors.direction).should('exist').check()
            // ICMP related columns
            cy.get(colSelectors.icmpType).should('exist').check()
            cy.get(colSelectors.icmpCode).should('exist').check()

            // source columns 
            cy.get(colSelectors.srcNodeIP).check()
            cy.get('#SrcK8S_Namespace[type="checkbox"]').uncheck()

            // dest columns
            cy.get(colSelectors.dstNodeIP).check()

            cy.byTestID(colSelectors.save).click()
        })
        cy.reload()

        cy.byTestID('table-composable').should('exist').within(() => {
            cy.get(colSelectors.srcNS).should('not.exist')
            cy.get(colSelectors.dstNodeIP).should('exist')
            cy.get(colSelectors.mac).should('exist')
            cy.get(colSelectors.k8sOwner).should('exist')
            cy.get(colSelectors.ipPort).should('exist')
            cy.get(colSelectors.protocol).should('exist')
            cy.get(colSelectors.icmpType).should('exist')
            cy.get(colSelectors.icmpCode).should('exist')

            cy.get(colSelectors.srcNodeIP).should('exist')

            cy.get(colSelectors.direction).should('exist')
        })

        // restore defaults
        cy.openColumnsModal().byTestID(colSelectors.resetDefault).click().byTestID(colSelectors.save).click()

        cy.byTestID('table-composable').within(() => {
            cy.get(colSelectors.srcNS).should('exist')
            cy.get(colSelectors.mac).should('not.exist')
        })
    })

    it("(OCP-50532, memodi) should validate filters", { tags: ['@netobserv-critical'] }, function () {
        netflowPage.stopAutoRefresh()

        // verify Source namespace filter
        netflowPage.selectSourceNS(project)

        // Verify SrcNS column for all rows
        cy.get('[data-test-td-column-id=SrcK8S_Namespace]').each((td) => {
            expect(td).to.contain(`${project}`)
        })

        // verify swap button — wait for poppers to fully dismiss
        netflowPage.waitForLokiQuery()
        netflowPage.dismissPoppers()
        cy.get("#swap-filters-button").should('exist').click()
        cy.get(filterSelectors.filterNames).eq(0).should('contain.text', 'Destination')

        // Verify DstNS column for all rows
        cy.get('[data-test-td-column-id=DstK8S_Namespace]').each((td) => {
            expect(td).to.contain(`${project}`)
        })

        netflowPage.clearAllFilters()

        // verify NOT filter
        // Clear any text in filter input to ensure FilterSearchPanel (not suggestions) is shown
        cy.get(filterSelectors.filterInput).clear()
        cy.get(filterSelectors.filterDropdown).click()
        cy.get('#filter-popper').should('be.visible')
        cy.get(filterSelectors.sourceRadio).should('exist').click()
        cy.get(filterSelectors.columnFilter).should('exist').click().get('#namespace').should('exist').click()
        cy.get(filterSelectors.compareDropdown).should('exist').click().get('#not-equal').should('exist').click()
        cy.get('#autocomplete-search').type(project + '{enter}')

        cy.get('#filters').find('.custom-chip-text').first().should('contain.text', 'Not Namespace equals')

        netflowPage.clearAllFilters()

        // verify src port filter and port Naming
        cy.get(filterSelectors.filterInput).type("src_port=3100" + '{enter}')
        cy.get('#src_port-0-toggle').should('contain.text', 'loki')
        netflowPage.waitForTableRows(1)

        // disable filter
        cy.get('#src_port-0-toggle').click().get('#dropdown-item-disable').click()

        // sort by port
        netflowPage.waitForLokiQuery()
        cy.get('[data-test=th-SrcPort] button').click()

        // Verify SrcPort doesnt not have text loki for all rows
        cy.get('[data-test-td-column-id=SrcPort]').each((td) => {
            cy.wrap(td).should('not.contain.text', 'loki (3100)')
        })

        // enable filter
        cy.get('#filters .disabled-group p').eq(0).click()
        netflowPage.waitForTableRows(1)

        // Verify SrcPort has text loki for all rows
        cy.get('[data-test-td-column-id=SrcPort]').each((td) => {
            cy.wrap(td).should('contain.text', 'loki (3100)')
        })

        netflowPage.clearAllFilters()
        cy.get('#filters').should('not.exist')
    })

    it("(OCP-50531, memodi) should validate localstorage for plugin", { tags: ['e2e', 'admin'] }, function () {
        // select compact column size
        cy.byTestID("show-view-options-button").should('exist').click().then(views => {
            cy.contains('Display options').should('exist').click()
            cy.byTestID('size-s').click()
            cy.contains('Display options').should('exist').click()
            cy.selectAndVerifyColumns([colSelectors.startTime])
            cy.byTestID("show-view-options-button").should('exist').click()
        })

        cy.visit('/monitoring/alerts')
        cy.visit('/netflow-traffic')

        cy.get('#pageHeader').should('exist').then(() => {
            const rawSettings = localStorage.getItem('netobserv-plugin-settings')
            expect(rawSettings, 'netobserv-plugin-settings should exist').to.not.be.null
            const settings = JSON.parse(rawSettings as string)
            expect(settings['netflow-traffic-refresh']).to.be.equal(15000)
            expect(settings['netflow-traffic-size-size']).to.be.equal('s')
            expect(settings['netflow-traffic-columns']).to.include('StartTime')
        })
    })

    it("(OCP-59408, memodi) should verify histogram", function () {
        cy.get('#time-range-dropdown-dropdown').should('exist').click().byTestID("5m").should('exist').click()
        cy.byTestID("show-histogram-button").should('exist').click()
        cy.get('#popover-netobserv-tour-popover-body', { timeout: 30000 }).should('exist')
        // close tour
        cy.get(".guided-tour-close-button", { timeout: 30000 }).should("exist").click()
        cy.byTestID(genSelectors.refreshDrop).should('be.disabled')
        // get current refreshed time
        let lastRefresh = ''
        cy.get('#lastRefresh').invoke('text').then(text => { lastRefresh = text })

        cy.get("#chart-histogram").should('exist')
        // move histogram slider
        cy.get("#chart-histogram  rect").should('exist').then(hist => {
            const histWidth = cy.$$('#chart-histogram').prop("clientWidth")
            const clientX = histWidth / 2
            cy.wrap(hist).trigger('mousedown').trigger("mousemove", { clientX: clientX, clientY: 45 }).trigger("mouseup", { waitForAnimations: true })
            cy.get('#lastRefresh', { timeout: 30000 }).invoke('text').should('not.eq', lastRefresh).then(text => { lastRefresh = text })
        })
        // zoom out
        cy.get(histogramSelectors.zoomout).should('exist').click()
        cy.get('#lastRefresh', { timeout: 30000 }).invoke('text').should('not.eq', lastRefresh).then(text => { lastRefresh = text })
        // zoom in
        cy.get(histogramSelectors.zoomin).should('exist').click()
        cy.get('#lastRefresh', { timeout: 30000 }).invoke('text').should('not.eq', lastRefresh).then(text => { lastRefresh = text })

        // time shift single right arrow
        cy.get(histogramSelectors.singleRightShift).should('exist').click()
        cy.get('#lastRefresh', { timeout: 30000 }).invoke('text').should('not.eq', lastRefresh).then(text => { lastRefresh = text })
        // time shift double right arrow
        cy.get(histogramSelectors.doubleRightShift).should('exist').click()
        cy.get('#lastRefresh', { timeout: 30000 }).invoke('text').should('not.eq', lastRefresh).then(text => { lastRefresh = text })

        // time shift single left arrow
        cy.get(histogramSelectors.singleLeftShift).should('exist').click()
        cy.get('#lastRefresh', { timeout: 30000 }).invoke('text').should('not.eq', lastRefresh).then(text => { lastRefresh = text })
        // time shift double left arrow
        cy.get(histogramSelectors.doubleLeftShift).should('exist').click()
        cy.get('#lastRefresh', { timeout: 30000 }).invoke('text').should('not.eq', lastRefresh).then(text => { lastRefresh = text })
        // hide histogram
        cy.byTestID("show-histogram-button").should('exist').click().then(() => {
            cy.get('#time-range-dropdown-dropdown').should('exist').click()
            cy.get("#5m").should("exist").click()
            cy.byTestID(genSelectors.refreshDrop).should('exist').should('not.be.disabled')
        })
    })

    afterEach("test", function () {
        netflowPage.resetClearFilters()
    })

    after("all tests", function () {
        cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
    })
})
