import { colSelectors, netflowPage, overviewSelectors, topologySelectors, viewSelectors } from "@views/netflow-page"
import { Operator } from "@views/netobserv"

// Expected panels per view (text visible in overview panel titles)
const pktDropPanels = [
    'Top 5 average dropped packets rates',
    'Top 5 dropped packets rates stacked with total',
    'Top 5 packet dropped state stacked with total',
    'Top 5 packet dropped cause stacked with total',
    'Top 5 average dropped bytes rates',
    'Top 5 dropped bytes rates stacked with total'
]

const dnsPanels = [
    'Top 5 average DNS latencies with overall',
    'Top 5 90th percentile DNS latencies',
    'Top 5 99th percentile DNS latencies',
    'Top 5 maximum DNS latencies',
    'Top 5 DNS name',
    'Top 5 DNS response code'
]

const rttPanels = [
    'Top 5 average TCP smoothed Round Trip Time with overall',
    'Top 5 90th percentile TCP smoothed Round Trip Time',
    'Top 5 99th percentile TCP smoothed Round Trip Time',
    'Top 5 maximum TCP smoothed Round Trip Time',
    'Bottom 5 minimum TCP smoothed Round Trip Time'
]

const tlsPanels = [
    'TLS usage',
    'TLS per version',
    'TLS per group',
    'TLS per cipher suite'
]

// Generic panel not in any feature preset but default-selected on All Traffic
const genericPanel = 'top_avg_byte_rates'
const genericPanelTitle = 'Top 5 average bytes rates'

describe('(OCP-XXXXX) Views selector tests', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.env(['LOGIN_IDP', 'LOGIN_USERNAME', 'LOGIN_PASSWORD']).then(({ LOGIN_IDP, LOGIN_USERNAME, LOGIN_PASSWORD }) => {
            cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${LOGIN_USERNAME}`)
            cy.uiLogin(LOGIN_IDP, LOGIN_USERNAME, LOGIN_PASSWORD)
        })

        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector("AllFeatures")

    })

    beforeEach('view selector test', function () {
        netflowPage.visit()
        netflowPage.waitForLokiQuery()
    })

    it("(OCP-XXXXX, memodi) should display view selector with all feature views", { tags: ['@netobserv-critical'] }, function () {
        cy.get(viewSelectors.container).should('exist')
        cy.get(viewSelectors.dropdown).should('exist')

        // Default view is All Traffic
        cy.get(viewSelectors.dropdown).should('contain.text', 'All Traffic')

        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.allTraffic).should('exist')
        cy.get(viewSelectors.packetDrops).should('exist')
        cy.get(viewSelectors.dnsLatency).should('exist')
        cy.get(viewSelectors.flowRTT).should('exist')
        cy.get(viewSelectors.tlsTracking).should('exist')
        cy.get(viewSelectors.udnMapping).should('exist')
        cy.get(viewSelectors.networkEvents).should('exist')
        cy.get(viewSelectors.packetTranslation).should('exist')

        cy.get(viewSelectors.dropdown).click()
    })

    it("(OCP-XXXXX, memodi) should show feature-specific panels and columns when view is selected", function () {
        // ── PANELS ──
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.packetDrops).click()
        cy.get(viewSelectors.dropdown).should('contain.text', 'Packet Drops')
        cy.checkPanel(pktDropPanels)

        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.dnsLatency).click()

        cy.get(viewSelectors.dropdown).should('contain.text', 'DNS Latency')
        cy.checkPanel(dnsPanels)

        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.flowRTT).click()

        cy.get(viewSelectors.dropdown).should('contain.text', 'Flow RTT')
        cy.checkPanel(rttPanels)

        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.tlsTracking).click()

        cy.get(viewSelectors.dropdown).should('contain.text', 'TLS Tracking')
        cy.checkPanel(tlsPanels)

        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.allTraffic).click()

        cy.get(viewSelectors.dropdown).should('contain.text', 'All Traffic')
        cy.checkPanel(overviewSelectors.defaultPanels)

        // ── COLUMNS ──
        cy.get('#tabs-container').contains('Traffic flows').click()
        cy.byTestID("table-composable").should('exist')
        netflowPage.stopAutoRefresh()

        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.packetDrops).click()
        cy.byTestID('table-composable').should('exist').within(() => {
            cy.get(colSelectors.bytes).should('exist')
            cy.get(colSelectors.packets).should('exist')
            cy.get('#PktDropBytes').should('exist')
            cy.get('#PktDropPackets').should('exist')
        })

        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.dnsLatency).click()
        cy.byTestID('table-composable').should('exist').within(() => {
            cy.get(colSelectors.dnsLatency).should('exist')
            cy.get(colSelectors.dnsResponseCode).should('exist')
        })

        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.flowRTT).click()
        cy.byTestID('table-composable').should('exist').within(() => {
            cy.get(colSelectors.flowRTT).should('exist')
        })

        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.tlsTracking).click()
        cy.byTestID('table-composable').should('exist').within(() => {
            cy.get(colSelectors.tlsVersion).should('exist')
        })

        // Return to All Traffic — feature columns absent, base columns present
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.allTraffic).click()
        cy.byTestID('table-composable').should('exist').within(() => {
            cy.get(colSelectors.srcNS).should('exist')
            cy.get(colSelectors.protocol).should('exist')
            cy.get(colSelectors.dnsLatency).should('not.exist')
            cy.get(colSelectors.flowRTT).should('not.exist')
            cy.get(colSelectors.tlsVersion).should('not.exist')
        })
    })

    it("(OCP-XXXXX, memodi) should persist generic column/panel changes across all views", function () {
        // ── GENERIC COLUMN: add on feature view, verify propagates everywhere ──
        cy.get('#tabs-container').contains('Traffic flows').click()
        cy.byTestID("table-composable").should('exist')
        netflowPage.stopAutoRefresh()

        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.dnsLatency).click()

        // Add generic column (DSCP — no feature, not default) on DNS view → no draft
        cy.openColumnsModal()
        cy.get(`${colSelectors.dscp}[type="checkbox"]`).check({ force: true })
        cy.byTestID(colSelectors.save).click()

        // "Custom" prefix — generic change
        cy.get(viewSelectors.dropdown).should('contain.text', 'Custom')

        // Verify DSCP column shows on DNS view
        cy.byTestID('table-composable').within(() => {
            cy.get(colSelectors.dnsLatency).should('exist')
            cy.get(colSelectors.dscp).should('exist')
        })

        // Switch to PktDrop — DSCP column should also show (generic pref propagated)
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.packetDrops).click()
        cy.byTestID('table-composable').within(() => {
            cy.get(colSelectors.dscp).should('exist')
        })

        // Switch to All Traffic — DSCP column should also show
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.allTraffic).click()
        cy.byTestID('table-composable').within(() => {
            cy.get(colSelectors.dscp).should('exist')
        })

        // ── GENERIC PANEL: add on feature view, verify propagates everywhere ──
        cy.get('#tabs-container').contains('Overview').click()
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.dnsLatency).click()

        // Add generic panel (top_avg_byte_rates not in DNS preset) on DNS view
        cy.openPanelsModal()
        cy.byTestID(`overview-panel-checkbox-${genericPanel}`).check()
        cy.byTestID('panels-save-button').click()

        // generic change, create draft
        cy.get(viewSelectors.dropdown).should('contain.text', 'Custom')

        // Generic panel shows on DNS view
        cy.get('#overview-flex').contains(genericPanelTitle).should('exist')

        // Switch to PktDrop — generic panel should also show
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.packetDrops).click()
        cy.get('#overview-flex').contains(genericPanelTitle).should('exist')

        // Switch to All Traffic — generic panel shows there too
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.allTraffic).click()
        cy.get('#overview-flex').contains(genericPanelTitle).should('exist')

        // ── GENERIC COLUMN: deselect on feature view, verify hidden everywhere ──
        cy.get('#tabs-container').contains('Traffic flows').click()
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.dnsLatency).click()

        // srcNS is a generic default column — deselect on DNS view
        cy.openColumnsModal()
        cy.get(`${colSelectors.srcNS}[type="checkbox"]`).uncheck()
        cy.byTestID(colSelectors.save).click()

        // generic change - draft
        cy.get(viewSelectors.dropdown).should('contain.text', 'Custom')

        // srcNS hidden on DNS view
        cy.byTestID('table-composable').within(() => {
            cy.get(colSelectors.srcNS).should('not.exist')
        })

        // Switch to PktDrop — srcNS also hidden
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.packetDrops).click()
        cy.byTestID('table-composable').within(() => {
            cy.get(colSelectors.srcNS).should('not.exist')
        })

        // Switch to All Traffic — srcNS also hidden
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.allTraffic).click()
        cy.byTestID('table-composable').within(() => {
            cy.get(colSelectors.srcNS).should('not.exist')
        })

        // ── GENERIC PANEL: deselect on feature view, verify hidden everywhere ──
        cy.get('#tabs-container').contains('Overview').click()

        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.dnsLatency).click()

        // Add generic panel first (so it's in prefs) then remove it
        cy.openPanelsModal()
        cy.byTestID(`overview-panel-checkbox-${genericPanel}`).check()
        cy.byTestID(overviewSelectors.save).click()

        cy.openPanelsModal()
        cy.byTestID(`overview-panel-checkbox-${genericPanel}`).uncheck()
        cy.byTestID(overviewSelectors.save).click()

        // generic change - draft is created
        cy.get(viewSelectors.dropdown).should('contain.text', 'Custom')

        // Generic panel hidden on DNS view
        cy.get('#overview-flex').contains(genericPanelTitle).should('not.exist')

        // Switch to PktDrop — also hidden
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.packetDrops).click()
        cy.get('#overview-flex').contains(genericPanelTitle).should('not.exist')

        // Switch to All Traffic — also hidden
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.allTraffic).click()
        cy.get('#overview-flex').contains(genericPanelTitle).should('not.exist')

        // ── CLEANUP: restore defaults (any view — clears generic prefs globally) ──
        cy.openPanelsModal()
        cy.byTestID(overviewSelectors.resetDefault).click()
        cy.byTestID(overviewSelectors.save).click()

        cy.get('#tabs-container').contains('Traffic flows').click()
        cy.openColumnsModal()
        cy.byTestID(colSelectors.resetDefault).click()
        cy.byTestID(colSelectors.save).click()
    })

    it("(OCP-XXXXX, memodi) should create draft and show Custom prefix when feature column/panel is modified", function () {
        // ── DRAFT: deselect preset feature column on DNS view ──
        cy.get('#tabs-container').contains('Traffic flows').click()
        cy.byTestID("table-composable").should('exist')
        netflowPage.stopAutoRefresh()

        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.dnsLatency).click()

        cy.openColumnsModal()
        cy.get(`${colSelectors.dnsLatency}[type="checkbox"]`).uncheck()
        cy.byTestID(colSelectors.save).click()

        // Draft created — toggle shows "Custom View: DNS Latency"
        cy.get(viewSelectors.dropdown).should('contain.text', 'Custom')
        cy.get(viewSelectors.dropdown).should('contain.text', 'DNS Latency')

        // Draft column removed from table
        cy.byTestID('table-composable').within(() => {
            cy.get(colSelectors.dnsLatency).should('not.exist')
            // Other DNS columns still visible
            cy.get(colSelectors.dnsResponseCode).should('exist')
        })

        // Switch to PktDrop — draft preserved (not on this view)
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.packetDrops).click()
        cy.get(viewSelectors.dropdown).should('not.contain.text', 'Custom')

        // Switch back to DNS — draft still active
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.dnsLatency).click()
        cy.get(viewSelectors.dropdown).should('contain.text', 'Custom')
        cy.byTestID('table-composable').within(() => {
            cy.get(colSelectors.dnsLatency).should('not.exist')
        })

        // Discard changes — draft cleared, preset restored
        cy.get(viewSelectors.dropdown).click()
        cy.byTestID('view-option-discard-draft').click()
        cy.get(viewSelectors.dropdown).should('not.contain.text', 'Custom')
        cy.byTestID('table-composable').within(() => {
            cy.get(colSelectors.dnsLatency).should('exist')
        })

        // ── DRAFT: add non-preset feature column on DNS view → only on DNS ──
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.dnsLatency).click()

        // Add RTT column (feature: flowRTT, not in DNS preset) → draft created
        cy.openColumnsModal()
        cy.get(`${colSelectors.flowRTT}[type="checkbox"]`).check()
        cy.byTestID(colSelectors.save).click()

        cy.get(viewSelectors.dropdown).should('contain.text', 'Custom')

        // RTT visible on DNS draft view
        cy.byTestID('table-composable').within(() => {
            cy.get(colSelectors.flowRTT).should('exist')
            cy.get(colSelectors.dnsLatency).should('exist')
        })

        // Switch to PktDrop — RTT not shown (draft scoped to DNS only)
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.packetDrops).click()
        cy.byTestID('table-composable').within(() => {
            cy.get(colSelectors.flowRTT).should('not.exist')
        })

        // Switch to All Traffic — RTT not shown
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.allTraffic).click()
        cy.byTestID('table-composable').within(() => {
            cy.get(colSelectors.flowRTT).should('not.exist')
        })

        // Discard draft on DNS
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.dnsLatency).click()
        cy.get(viewSelectors.dropdown).click()
        cy.byTestID('view-option-discard-draft').click()
        cy.get(viewSelectors.dropdown).should('not.contain.text', 'Custom')

        // ── DRAFT: deselect preset feature panel on DNS view ──
        cy.get('#tabs-container').contains('Overview').click()
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.dnsLatency).click()

        cy.openPanelsModal()
        // Uncheck a DNS preset panel
        cy.byTestID('overview-panel-checkbox-top_avg_dns_latency').uncheck()
        cy.byTestID(overviewSelectors.save).click()

        // Draft created — toggle shows "Custom"
        cy.get(viewSelectors.dropdown).should('contain.text', 'Custom')

        // Preset panel removed from overview
        cy.get('#overview-flex').contains('Top 5 average DNS latencies').should('not.exist')

        // Discard — preset panels restored
        cy.get(viewSelectors.dropdown).click()
        cy.byTestID('view-option-discard-draft').click()
        cy.get(viewSelectors.dropdown).should('not.contain.text', 'Custom')
        cy.get('#overview-flex').contains('Top 5 average DNS latencies').should('exist')
    })

    it("(OCP-XXXXX, memodi) should restore defaults and clear generic prefs on any view", function () {
        cy.get('#tabs-container').contains('Traffic flows').click()
        netflowPage.stopAutoRefresh()

        // Add generic column (DSCP) on All Traffic
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.allTraffic).click()
        cy.openColumnsModal()
        cy.get(`${colSelectors.dscp}[type="checkbox"]`).check()
        cy.byTestID(colSelectors.save).click()

        // DSCP shows on All Traffic
        cy.byTestID('table-composable').within(() => {
            cy.get(colSelectors.dscp).should('exist')
        })

        // Restore default on All Traffic — clears generic prefs
        cy.openColumnsModal()
        cy.byTestID(colSelectors.resetDefault).click()
        cy.byTestID(colSelectors.save).click()

        // DSCP gone from All Traffic
        cy.byTestID('table-composable').within(() => {
            cy.get(colSelectors.dscp).should('not.exist')
        })

        // Switch to DNS — DSCP also gone (generic prefs cleared globally)
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.dnsLatency).click()
        cy.byTestID('table-composable').within(() => {
            cy.get(colSelectors.dscp).should('not.exist')
            // DNS preset columns still present
            cy.get(colSelectors.dnsLatency).should('exist')
        })
    })

    it("(OCP-XXXXX, memodi) should set correct topology metric type per view", function () {
        cy.get('#tabs-container').contains('Topology').click()

        // All Traffic — default metric: Bytes
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.allTraffic).click()

        cy.byTestID("show-view-options-button").should('exist').click()
        cy.contains('Display options').should('exist').click()
        cy.byTestID(topologySelectors.metricTypeDrop).should('contain.text', 'Bytes')

        // Packet Drops — preset metric: PktDropPackets
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.packetDrops).click()
        cy.contains('Display options').should('exist').click()
        cy.byTestID(topologySelectors.metricTypeDrop).should('contain.text', 'Dropped packets')

        // DNS Latency — preset metric: DnsLatencyMs
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.dnsLatency).click()
        cy.contains('Display options').should('exist').click()
        cy.byTestID(topologySelectors.metricTypeDrop).should('contain.text', 'DNS latencies')

        // Flow RTT — preset metric: TimeFlowRttNs
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.flowRTT).click()
        cy.contains('Display options').should('exist').click()

        cy.byTestID(topologySelectors.metricTypeDrop).should('contain.text', 'RTT')

        // Return to All Traffic — original Bytes metric restored
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.allTraffic).click()
        cy.contains('Display options').should('exist').click()
        cy.byTestID(topologySelectors.metricTypeDrop).should('contain.text', 'Bytes')

        // Changing metric on a view does NOT create a draft
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.packetDrops).click()
        cy.contains('Display options').should('exist').click()

        cy.byTestID(topologySelectors.metricTypeDrop).click()
        cy.get('#PktDropBytes').click()
        cy.get(viewSelectors.dropdown).should('not.contain.text', 'Custom')

        cy.byTestID("show-view-options-button").click()
    })

    it("(OCP-XXXXX, memodi) generic prefs survive refresh, draft is lost on refresh", function () {
        cy.get('#tabs-container').contains('Traffic flows').click()
        netflowPage.stopAutoRefresh()

        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.dnsLatency).click()

        // Create a draft by adding non-preset feature column
        cy.openColumnsModal()
        cy.get(`${colSelectors.flowRTT}[type="checkbox"]`).check()
        cy.byTestID(colSelectors.save).click()
        cy.get(viewSelectors.dropdown).should('contain.text', 'Custom')

        // Add a generic column (propagates globally via prefs)
        cy.openColumnsModal()
        cy.get(`${colSelectors.dscp}[type="checkbox"]`).check()
        cy.byTestID(colSelectors.save).click()

        // Page refresh
        cy.reload()

        // Navigate back to DNS view
        cy.get('#tabs-container').contains('Traffic flows').click()
        netflowPage.stopAutoRefresh()
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.dnsLatency).click()

        // Draft lost — no Custom prefix
        cy.get(viewSelectors.dropdown).should('not.contain.text', 'Custom')

        // RTT (draft col) not shown — draft gone
        cy.byTestID('table-composable').within(() => {
            cy.get(colSelectors.flowRTT).should('not.exist')
        })

        // DSCP (generic pref) still shown — prefs persisted in localStorage
        cy.byTestID('table-composable').within(() => {
            cy.get(colSelectors.dscp).should('exist')
        })

        // Cleanup
        cy.openColumnsModal()
        cy.byTestID(colSelectors.resetDefault).click()
        cy.byTestID(colSelectors.save).click()
    })

    it("(OCP-XXXXX, memodi) should clear draft when clicking 'Restore default columns'", function () {
        cy.get('#tabs-container').contains('Traffic flows').click()
        cy.byTestID("table-composable").should('exist')
        netflowPage.stopAutoRefresh()

        // Select DNS view
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.dnsLatency).click()
        cy.get(viewSelectors.dropdown).should('contain.text', 'DNS Latency')

        // Reorder columns to create draft
        cy.openColumnsModal()
        cy.byTestID('table-column-management').within(() => {
            // Drag first column to different position (creates reorder draft)
            cy.get('[id="data-0"]').trigger('mousedown')
            cy.get('[id="data-3"]').trigger('mouseover').trigger('mouseup')
        })
        cy.byTestID('columns-save-button').click()

        // Verify "Custom" label present (draft exists)
        cy.get(viewSelectors.dropdown).should('contain.text', 'Custom')

        // Click "Restore default columns"
        cy.openColumnsModal()
        cy.byTestID('columns-reset-button').click()
        cy.byTestID('columns-save-button').click()

        // Verify "Custom" label gone (draft cleared)
        cy.get(viewSelectors.dropdown).should('contain.text', 'DNS Latency').and('not.contain.text', 'Custom')
    })

    afterEach("test", function () {
        netflowPage.resetClearFilters()
    })

    after("all tests", function () {
        Operator.deleteFlowCollector()
        cy.env(['LOGIN_USERNAME']).then(({ LOGIN_USERNAME }) => {
            cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${LOGIN_USERNAME}`)
        })
    })
})
