import { colSelectors, displayDropdownSelectors, genSelectors, histogramSelectors, netflowPage } from "@views/netflow-page"
import { Operator, project } from "@views/netobserv"

describe('(OCP-50532, OCP-50531, OCP-50530, OCP-59408 Network_Observability) Netflow Table view tests', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
        cy.login(Cypress.env('LOGIN_IDP'), Cypress.env('LOGIN_USERNAME'), Cypress.env('LOGIN_PASSWORD'))

        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector()
    })

    beforeEach("test", function () {
        netflowPage.visit()
        cy.get('#tabs-container').contains('Traffic flows').click()
        cy.byTestID("table-composable").should('exist')
    })

    it("(OCP-50532, memodi, Network_Observability) should validate netflow table features", function () {
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
        cy.showAdvancedOptions()
        cy.get(displayDropdownSelectors.table).should('exist').click()
        cy.byTestID('size-s').click()
        cy.byTestID('size-l').click()
        cy.byTestID('size-m').click()

        // expand view
        cy.byTestID('fullscreen-button').click()
        cy.get('#page-sidebar').then(sidenav => {
            cy.byLegacyTestID('perspective-switcher-menu').should('not.be.visible')
        })

        cy.byTestID("show-view-options-button").should('exist').click()
    })

    it("(OCP-50532, memodi, Network_Observability) should validate columns", function () {
        netflowPage.stopAutoRefresh()
        cy.openColumnsModal()
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
        cy.openColumnsModal()
        cy.byTestID(colSelectors.resetDefault).click()
        cy.byTestID(colSelectors.save).click()

        cy.byTestID('table-composable').within(() => {
            cy.get(colSelectors.srcNS).should('exist')
            cy.get(colSelectors.mac).should('not.exist')
        })
    })

    it("(OCP-50532, memodi, Network_Observability) should validate filters", function () {
        netflowPage.stopAutoRefresh()

        cy.byTestID("column-filter-toggle").click().get('.pf-c-dropdown__menu').should('be.visible')

        // verify Source namespace filter
        cy.byTestID('group-0-toggle').should('exist').byTestID('src_namespace').click()
        cy.byTestID('autocomplete-search').type(project + '{enter}')
        cy.get('#filters div.custom-chip > p').should('contain.text', `${project}`)

        // Verify SrcNS column for all rows
        cy.get('[data-test-td-column-id=SrcK8S_Namespace]').each((td) => {
            expect(td).to.contain(`${project}`)
        })

        // verify swap button
        netflowPage.waitForLokiQuery()
        cy.byTestID("swap-filters-button").should('exist').click()
        cy.get('#filters div.custom-chip-group > p').should('contain.text', 'Destination Namespace')

        // Verify DstNS column for all rows
        cy.get('[data-test-td-column-id=DstK8S_Namespace]').each((td) => {
            expect(td).to.contain(`${project}`)
        })

        netflowPage.clearAllFilters()
        cy.get('div.custom-chip').should('not.exist')

        // verify NOT filter switch button
        cy.get('#filter-compare-switch-button').should('exist').click()
        cy.byTestID("column-filter-toggle").click().get('.pf-c-dropdown__menu').should('be.visible')
        cy.byTestID('group-0-toggle').should('exist').byTestID('src_namespace').click()
        cy.byTestID('autocomplete-search').type(project + '{enter}')
        cy.get('#filters div.custom-chip-group > p').should('contain.text', 'Not Source Namespace')

        netflowPage.clearAllFilters()

        // verify NOT filter toggle
        cy.get('#filter-compare-toggle-button').should('exist').click().then(moreOpts => {
            cy.contains("Not equals").should('exist').click()
        })
        cy.byTestID("column-filter-toggle").click().get('.pf-c-dropdown__menu').should('be.visible')
        cy.byTestID('group-0-toggle').should('exist').byTestID('src_namespace').click()
        cy.byTestID('autocomplete-search').type(project + '{enter}')
        cy.get('#filters div.custom-chip-group > p').should('contain.text', 'Not Source Namespace')

        // verify One-way and back-forth button
        cy.byTestID("back-and-forth-button").should('exist').click()

        cy.byTestID("back-and-forth-button").should('exist').click()

        cy.get('#filter-compare-toggle-button').should('exist').click().then(moreOpts => {
            cy.contains("Equals").should('exist').click()
        })

        netflowPage.clearAllFilters()

        // verify src port filter and port Naming
        cy.byTestID("column-filter-toggle").click()
        cy.byTestID('src_port').click()
        cy.byTestID('autocomplete-search').type('3100{enter}')
        cy.get('#filters div.custom-chip > p').should('have.text', 'loki')

        // check enabled or disabling filter
        cy.get(':nth-child(1) > .pf-c-chip-group__label').click()
        cy.get('#filters  > .pf-c-toolbar__item > :nth-child(1)').should('have.class', 'disabled-group')

        // sort by port
        netflowPage.waitForLokiQuery()
        cy.get('[data-test=th-SrcPort] > .pf-c-table__button').click()
        // cy.reload()
        // cy.get('#tabs-container li:nth-child(2)').click()

        // Verify SrcPort doesnt not have text loki for all rows
        cy.get('[data-test-td-column-id=SrcPort]').each((td) => {
            cy.get('[data-test-td-column-id=SrcPort] > div > div').should('not.contain.text', 'loki (3100)')
        })

        cy.get(':nth-child(1) > .pf-c-chip-group__label').click()
        cy.get('#filters  > .pf-c-toolbar__item > :nth-child(1)').should('not.have.class', '.disabled-value')

        // Verify SrcPort has text loki for all rows
        cy.get('[data-test-td-column-id=SrcPort]').each((td) => {
            cy.get('[data-test-td-column-id=SrcPort] > div > div').should('contain.text', 'loki (3100)')
        })

        netflowPage.clearAllFilters()
        cy.get('div.custom-chip').should('not.exist')
    })

    it("(OCP-50531, memodi, Network_Observability) should validate localstorage for plugin", function () {
        netflowPage.stopAutoRefresh()

        cy.byTestID(genSelectors.refreshDrop).then(btn => {
            expect(btn).to.exist
            cy.wrap(btn).click().then(drop => {
                cy.get('[data-test="15s"]').should('exist').click()
            })
        })

        // select compact column size
        cy.showAdvancedOptions()
        cy.get(displayDropdownSelectors.table).should('exist').click()
        cy.byTestID('size-s').click()
        cy.get(displayDropdownSelectors.table).should('exist').click()
        cy.selectAndVerifyColumns([colSelectors.startTime])
        cy.showAdvancedOptions()

        cy.visit('/monitoring/alerts')
        cy.visit('/netflow-traffic')

        cy.get('#pageHeader').should('exist').then(() => {
            const settings = JSON.parse(localStorage.getItem('netobserv-plugin-settings') as string)
            expect(settings['netflow-traffic-refresh']).to.be.equal(15000)
            expect(settings['netflow-traffic-size-size']).to.be.equal('s')
            expect(settings['netflow-traffic-columns']).to.include('StartTime')
        })
    })

    it("(OCP-59408, memodi, Network_Observability) should verify histogram", function () {
        cy.get('#time-range-dropdown-dropdown').should('exist').click().byTestID("5m").should('exist').click()
        cy.byTestID("show-histogram-button").should('exist').click()
        cy.get("#refresh-dropdown button").should('be.disabled')
        cy.get('#popover-netobserv-tour-popover-body').should('exist')
        // close tour
        cy.get("#popover-netobserv-tour-popover-header > div > div:nth-child(2) > button").should("exist").click()
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
        cy.get(histogramSelectors.zoomout).should('exist').then(zoomout => {
            cy.wrap(zoomout).click()
            cy.get('#lastRefresh', { timeout: 30000 }).invoke('text').should('not.eq', lastRefresh).then(text => { lastRefresh = text })
        })
        // zoom in
        cy.get(histogramSelectors.zoomin).should('exist').then(zoomin => {
            cy.wrap(zoomin).click()
            cy.get('#lastRefresh', { timeout: 30000 }).invoke('text').should('not.eq', lastRefresh).then(text => { lastRefresh = text })
            cy.wrap(zoomin).trigger('mouseleave')
        })

        // time shift single right arrow
        cy.get(histogramSelectors.singleRightShift).should('exist').then(sRightShift => {
            cy.wrap(sRightShift).click()
            cy.get('#lastRefresh', { timeout: 30000 }).invoke('text').should('not.eq', lastRefresh).then(text => { lastRefresh = text })
        })
        // time shift double right arrow
        cy.get(histogramSelectors.doubleRightShift).should('exist').then(dblRightShift => {
            cy.wrap(dblRightShift).click()
            cy.get('#lastRefresh', { timeout: 30000 }).invoke('text').should('not.eq', lastRefresh).then(text => { lastRefresh = text })
        })

        // time shift single left right arrow
        cy.get(histogramSelectors.singleLeftShift).should('exist').then(sLeftShift => {
            cy.wrap(sLeftShift).click()
            cy.get('#lastRefresh', { timeout: 30000 }).invoke('text').should('not.eq', lastRefresh).then(text => { lastRefresh = text })
        })
        // time shift double left arrow
        cy.get(histogramSelectors.doubleLeftShift).should('exist').then(dblLeftShift => {
            cy.wrap(dblLeftShift).click()
            cy.get('#lastRefresh', { timeout: 30000 }).invoke('text').should('not.eq', lastRefresh).then(text => { lastRefresh = text })
        })
        // hide histogram
        cy.byTestID("show-histogram-button").should('exist').click().then(() => {
            cy.byTestID("time-range-dropdown-dropdown").should('exist').click()
            cy.get("#5m").should("exist").click()
            cy.byTestID("refresh-dropdown-dropdown").should('exist').should('not.be.disabled')
        })
    })

    afterEach("each test", function () {
        netflowPage.resetClearFilters()
    })

    after("all tests", function () {
        cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
    })
})
