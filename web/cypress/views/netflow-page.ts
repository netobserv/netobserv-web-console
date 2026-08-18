import { guidedTour } from "@views/tour";

declare global {
    namespace Cypress {
        interface Chainable {
            showAdvancedOptions(): Chainable<Element>
            checkPanelsNum(panels?: number): Chainable<Element>
            checkPanel(panelName: string[]): Chainable<Element>
            openPanelsModal(): Chainable<Element>
            openColumnsModal(): Chainable<Element>
            selectAndVerifyColumns(columnSelectors: string[]): Chainable<Element>
            selectPopupItems(id: string, names: string[]): Chainable<Element>
            checkPopupItems(id: string, names: string[]): Chainable<Element>
            checkQuerySummary(metric: JQuery<HTMLElement>): Chainable<Element>
            checkPerformance(page: string, loadTime: number, memoryUsage: number): Chainable<Element>
            changeQueryOption(name: string): Chainable<Element>
            visitNetflowTrafficTab(page: string): Chainable<Element>
            checkNetflowTraffic(loki?: string): Chainable<Element>
        }
    }
}

type Group = 'Node' | 'Namespace' | 'Owner' | 'Resource'

export function getTopologyScopeURL(scope: string): string {
    return `**/flow/metrics**aggregateBy=${scope}*`
}

export function getTopologyResourceScopeGroupURL(groups: string): string {
    return `**/flow/metrics**groups=${groups}*`
}

export function getMemoryUsageMB(): number {
    return Math.round((window.performance as any).memory?.usedJSHeapSize / 1048576)
}

export const netflowPage = {
    visit: (clearfilters = true) => {
        cy.clearNetobservLocalStorage()
        cy.visit('/netflow-traffic')

        // Retry with reload if console shows 404 (plugin route not registered yet)
        const waitForPlugin = (retries = 3): void => {
            cy.wait(5000)
            cy.get('body').then($body => {
                if ($body.text().includes('Page Not Found') && retries > 0) {
                    cy.log('Plugin page not ready, reloading')
                    cy.wait(15000)
                    cy.visit('/netflow-traffic')
                    waitForPlugin(retries - 1)
                }
            })
        }
        waitForPlugin()

        // Wait for the plugin page before touching filters
        cy.get('#overview-container', { timeout: 60000 }).should('exist')

        cy.wrap(clearfilters).then(shouldClearFilters => {
            if (shouldClearFilters) {
                netflowPage.clearAllFilters()
            }
        })
        // set the page to auto refresh
        netflowPage.setAutoRefresh()

        netflowPage.waitForLokiQuery()

        cy.byTestID('no-results-found', { timeout: 30000 }).should('not.exist')
    },
    visitDeveloper: (project: string) => {
        cy.clearNetobservLocalStorage()
        cy.switchPerspective('Developer');
        guidedTour.close()
        cy.visit(`/dev-monitoring/ns/${project}/netflow-traffic`)
    },
    setAutoRefresh: () => {
        cy.byTestID(genSelectors.refreshDrop).then(btn => {
            expect(btn).to.exist
            cy.wrap(btn).click().then(drop => {
                cy.get('[data-test="15s"]').should('exist').click()
            })
        })
    },
    stopAutoRefresh: () => {
        cy.byTestID(genSelectors.refreshDrop).then(btn => {
            expect(btn).to.exist
            cy.wrap(btn).click().then(drop => {
                cy.get('[data-test="OFF_KEY"]').should('exist').click()
            })
        })
    },
    resetClearFilters: () => {
        const tryReset = (retries = 3): void => {
            cy.get('body').then($body => {
                if ($body.find('[data-test="reset-filters-button"]').length > 0) {
                    cy.byTestID("reset-filters-button").click({ force: true })
                } else if (retries > 0) {
                    cy.wait(500)
                    tryReset(retries - 1)
                }
            })
        }
        tryReset()
    },
    clearAllFilters: () => {
        cy.byTestID(genSelectors.refreshDrop).should('exist')
        const tryClick = (retries = 5): void => {
            cy.get('body').then($body => {
                if ($body.find('[data-test="clear-all-filters-button"]').length > 0) {
                    cy.byTestID("clear-all-filters-button").click()
                } else if (retries > 0) {
                    cy.wait(500)
                    tryClick(retries - 1)
                }
            })
        }
        tryClick()
    },
    waitForLokiQuery: () => {
        cy.get("#refresh-button > span > svg").invoke('attr', 'style').should('contain', '0s linear 0s')
    },
    selectSourceNS: (project: string) => {
        cy.byTestID("column-filter-toggle").click().get('.pf-c-dropdown__menu').should('be.visible')
        // verify Source namespace filter
        cy.byTestID('group-0-toggle').should('exist').byTestID('src_namespace').click()
        cy.byTestID('autocomplete-search').type(project + '{enter}{enter}')
        cy.get('#filters div.custom-chip > p').should('contain.text', `${project}`)
    }
}

export const topologyPage = {
    selectScopeGroup: (scope?: string, group?: string) => {
        cy.get(displayDropdownSelectors.topology).should('exist').click()
        if (scope) {
            cy.byTestID("scope-dropdown").click().byTestID(scope).click()
        }
        if (group) {
            cy.wait(5000)
            cy.byTestID("group-dropdown").click().byTestID(group).click()
        }
        cy.get(displayDropdownSelectors.topology).should('exist').click()
    },
    isViewRendered: () => {
        cy.get('[data-surface="true"]').should('exist')
    },
    getOwnerNode: (resourceType: string, resourceName: string, timeout: number = 60000) => {
        return cy.get(`g[data-id*="o=${resourceType}.${resourceName}"]`, { timeout })
    },
    selectGroupWithSlider: (group: Group) => {
        let selector
        switch (group) {
            case 'Node':
                selector = '#scope-step-0'
                break
            case 'Namespace':
                selector = '#scope-step-1'
                break
            case 'Owner':
                selector = '#scope-step-2'
                break
            case 'Resource':
                selector = '#scope-step-3'
                break
        }
        cy.get('#lastRefresh').invoke('text').then((lastRefresh) => {
            cy.get(`${selector} >  div:nth-child(2) > button`).click().then(slider => {
                netflowPage.waitForLokiQuery()
                cy.wait(3000)
                cy.get('#lastRefresh').invoke('text').should('not.eq', lastRefresh)
            })
        })
    }
}

/**
 * Helper function to setup topology view with optional namespace filter
 * Navigates to topology tab, clears filters, optionally applies namespace filter, and sets display options
 * @param namespace - Optional namespace to filter topology view by
 */
export function setupTopologyViewWithNamespaceFilter(namespace?: string) {
    cy.clearNetobservLocalStorage()
    netflowPage.visit()
    cy.get('#tabs-container').contains('Topology').click()

    if (Cypress.$('[data-surface=true][transform="translate(0, 0) scale(1)]').length > 0) {
        cy.get('[data-test="filters"] > [data-test="clear-all-filters-button"]').should('exist').click()
    }
    cy.get('#drawer').should('not.be.empty')

    // Add filter for namespace if provided
    if (namespace) {
        cy.byTestID("column-filter-toggle").click().get('.pf-c-dropdown__menu').should('be.visible')
        cy.byTestID('group-0-toggle').should('exist').byTestID('src_namespace').click()
        cy.byTestID('autocomplete-search').type(namespace + '{enter}{enter}')
        cy.get('#filters div.custom-chip > p').should('contain.text', `${namespace}`)
    }

    cy.byTestID("show-view-options-button").should('exist').click()
    cy.get('[data-test-id="view-options-toolbar"]').should('be.visible')
    cy.get('#display-dropdown-container').should('be.visible')
    cy.get(displayDropdownSelectors.topology).should('exist').click()
    cy.byTestID('layout-dropdown').click()
    cy.byTestID('Grid').click()
    cy.byTestID(topologySelectors.metricsDrop).should('exist').click().get('#sum').click()
    cy.get(displayDropdownSelectors.topology).should('exist').click()
    // Leave view options toolbar open for subsequent operations
}

export namespace genSelectors {
    export const timeDrop = "time-range-dropdown-dropdown"
    export const refreshDrop = "refresh-dropdown-dropdown"
    export const refreshBtn = 'refresh-button'
    export const moreOpts = 'more-options-button'
    export const fullScreen = '[data-test=fullscreen-button]'
}

export namespace colSelectors {
    export const columnsModal = '.modal-content'
    export const save = 'columns-save-button'
    export const resetDefault = 'columns-reset-button'
    export const mac = '#Mac'
    export const k8sOwner = '#K8S_OwnerObject'
    export const ipPort = '#AddrPort'
    export const protocol = '#Proto'
    export const icmpType = '#IcmpType'
    export const icmpCode = '#IcmpCode'
    export const srcNodeIP = '#SrcK8S_HostIP'
    export const srcNS = '#SrcK8S_Namespace'
    export const dstNodeIP = '#DstK8S_HostIP'
    export const direction = '#FlowDirection'
    export const bytes = '#Bytes'
    export const packets = '#Packets'
    export const recordType = '#RecordType'
    export const conversationID = '#_HashId'
    export const startTime = '#StartTime'
    export const flowRTT = '#TimeFlowRttMs'
    export const dscp = '#Dscp'
    export const dnsLatency = '#DNSLatency'
    export const dnsResponseCode = '#DNSResponseCode'
    export const dnsId = '#DNSId'
    export const dnsError = '#DNSErrNo'
    export const dnsName = '#DNSName'
    export const srcZone = '#SrcZone'
    export const dstZone = '#DstZone'
    export const clusterName = '#ClusterName'
    export const srcSubnetLabel = '#SrcSubnetLabel'
    export const dstSubnetLabel = '#DstSubnetLabel'
}

export namespace exportSelectors {
    export const overviewExport = '#export-button'
    export const avgBytesRatesDropdown = '#top_avg_byte_rates div:nth-child(3) button'
    export const tableExport = '#export-button'
    export const exportButton = '[data-test=export-button]'
    export const closeButton = '[data-test=export-close-button]'
    export const topologyExport = '#export-button'
}

export namespace filterSelectors {
    export const filterGroupText = '.custom-chip > p'
    export const filterNames = "#filters p"
    export const compareDropdown = '#filter-compare-toggle-button'
}

export namespace displayDropdownSelectors {
    export const overview = '#display-dropdown-container .pf-c-select'
    export const table = '#display-dropdown-container .pf-c-select'
    export const topology = '#display-dropdown-container .pf-c-select'
}

export namespace querySumSelectors {
    export const queryStatsPanel = "#query-summary"
    export const flowsCount = "#flowsCount"
    export const bytesCount = "#bytesCount"
    export const packetsCount = "#packetsCount"
    export const bpsCount = "#bytesPerSecondsCount"
    export const avgRTT = "#rttAvg"
    export const dnsAvg = "#dnsAvg"
    export const droppedBytesCount = "#pktDropBytesCount"
    export const droppedBpsCount = "#pktDropBytesPerSecondsCount"
    export const droppedPacketsCount = "#pktDropPacketsCount"
}

// Helper functions for topology selectors
const topoLayer = (layerId: string): string => `[data-layer-id="${layerId}"]`;
const topoSvg = (attr: 'type' | 'kind', value: string, modifier: string = ''): string =>
    `g[data-${attr}="${value}"]${modifier}`;
const topoToggle = (toggleId: string): string => `#${toggleId}-switch`;

export namespace topologySelectors {
    export const metricsDrop = 'metricFunction-dropdown'
    export const metricsFunctionDrop = 'metricFunction-dropdown'
    export const metricsFunction = '#metricFunction'
    export const metricsList = '#metricFunction > ul > li'
    export const metricTypeDrop = 'metricType-dropdown'
    export const metricType = '#metricType'
    export const optsClose = '[aria-label="Close drawer panel"]'
    export const nGroups = topoLayer('groups') + ' > g'
    export const group = topoSvg('type', 'group')
    export const node = topoSvg('kind', 'node', ':empty')
    export const edge = topoSvg('kind', 'edge')
    export const groupLayer = topoLayer('groups')
    export const defaultLayer = topoLayer('default')
    export const groupToggle = topoToggle('group-collapsed')
    export const edgeToggle = topoToggle('edges')
    export const labelToggle = topoToggle('edges-tag')
    export const badgeToggle = topoToggle('badge')
}

export namespace overviewSelectors {
    export const panelsModal = '.modal-content'
    export const resetDefault = 'panels-reset-button'
    export const save = 'panels-save-button'
    export const cancel = 'panels-cancel-button'
    export const typeDrop = 'type-dropdown'
    export const scopeDrop = 'scope-dropdown'
    export const truncateDrop = 'truncate-dropdown'
    export const managePanelsList = ['Top X average bytes rates (donut)', 'Top X bytes rates stacked with total (bars and lines)', 'Top X average packets rates (donut)', 'Top X packets rates stacked with total (bars and lines)']
    export const managePacketDropPanelsList = ['Top X packet dropped state stacked with total (donut or bars and lines)', 'Top X packet dropped cause stacked with total (donut or bars and lines)', 'Top X average dropped bytes rates (donut)', 'Top X dropped bytes rates stacked with total (bars and lines)', 'Top X average dropped packets rates (donut)', 'Top X dropped packets rates stacked with total (bars and lines)']
    export const manageDNSTrackingPanelsList = ['Top X DNS response code with total (donut or bars and lines)', 'Top X average DNS latencies with overall (donut or lines)', 'Bottom X minimum DNS latencies with overall (donut or lines)', 'Top X maximum DNS latencies with overall (donut or lines)', 'Top X 90th percentile DNS latencies with overall (donut or lines)']
    export const manageFlowRTTPanelsList = ['Top X average TCP smoothed Round Trip Time with overall (donut or lines)', 'Bottom X minimum TCP smoothed Round Trip Time with overall (donut or lines)', 'Top X maximum TCP smoothed Round Trip Time with overall (donut or lines)', 'Top X 90th percentile TCP smoothed Round Trip Time with overall (donut or lines)', 'Top X 99th percentile TCP smoothed Round Trip Time with overall (donut or lines)']
    export const defaultPanels = ['Top 5 average bytes rates', 'Top 5 bytes rates stacked with total']
    export const defaultPacketDropPanels = ['Top 5 packet dropped state stacked with total', 'Top 5 packet dropped cause stacked with total', 'Top 5 average dropped packets rates', 'Top 5 dropped packets rates stacked with total']
    export const defaultDNSTrackingPanels = ['Top 5 DNS response code', 'Top 5 average DNS latencies with overall', 'Top 5 90th percentile DNS latencies']
    export const defaultFlowRTTPanels = ['Top 5 average TCP smoothed Round Trip Time with overall', 'Bottom 5 minimum TCP smoothed Round Trip Time', 'Top 5 90th percentile TCP smoothed Round Trip Time']
    export const allPanels = defaultPanels.concat(['Top 5 average packets rates', 'Top 5 packets rates'])
    export const allPacketDropPanels = defaultPacketDropPanels.concat(['Top 5 average dropped bytes rates', 'Top 5 dropped bytes rates stacked with total'])
    export const allDNSTrackingPanels = defaultDNSTrackingPanels.concat(['Bottom 5 minimum DNS latencies', 'Top 5 maximum DNS latencies'])
    export const allFlowRTTPanels = defaultFlowRTTPanels.concat(['Top 5 maximum TCP smoothed Round Trip Time', 'Top 5 99th percentile TCP smoothed Round Trip Time'])
}

export const loadTimes = {
    "overview": 8500,
    "table": 5000,
    "topology": 5000
}

export const memoryUsage = {
    "overview": 300,
    "table": 450,
    "topology": 600
}

export namespace histogramSelectors {
    export const timeRangeContainer = "#chart-histogram .histogram-range-container"
    export const zoomin = '[data-test="histogram-zoom-in"]'
    export const zoomout = '[data-test="histogram-zoom-out"]'
    export const singleRightShift = '[data-test="histogram-single-right"]'
    export const doubleRightShift = '[data-test="histogram-double-right"]'
    export const singleLeftShift = '[data-test="histogram-single-left"]'
    export const doubleLeftShift = '[data-test="histogram-double-left"]'
}

Cypress.Commands.add('showAdvancedOptions', () => {
    cy.get('#show-view-options-button')
        .then(function ($button) {
            if ($button.text() === 'Hide advanced options') {
                return;
            } else {
                cy.get('#show-view-options-button').click();
            }
        })
});

Cypress.Commands.add('checkPanelsNum', (panels = 2) => {
    cy.get('#overview-flex').find('.overview-card').its('length').should('eq', panels);
});

Cypress.Commands.add('checkPanel', (panelName) => {
    for (let i = 0; i < panelName.length; i++) {
        cy.get('#overview-flex', { timeout: 60000 }).contains(panelName[i]);
        cy.get('[data-test-metrics]', { timeout: 120000 }).its('length').should('gt', 0);
    }
});

Cypress.Commands.add('openPanelsModal', () => {
    cy.showAdvancedOptions();
    cy.byTestID('manage-overview-panels-button').should('exist').click();
    cy.get('#overview-panels-modal').should('exist');
});

Cypress.Commands.add('openColumnsModal', () => {
    cy.showAdvancedOptions();
    cy.get('#manage-columns-button').click();
    cy.get('#table-column-management').should('exist');
});

Cypress.Commands.add('checkPopupItems', (id, names) => {
    for (let i = 0; i < names.length; i++) {
        cy.get(id).contains('label', names[i]).should('exist');
    }
});

Cypress.Commands.add('selectPopupItems', (id, names) => {
    for (let i = 0; i < names.length; i++) {
        cy.get(id).contains(names[i])
            .parent().find('input[type="checkbox"]').click();
    }
});

Cypress.Commands.add('selectAndVerifyColumns', (columnSelectors: string[]) => {
    // Open the columns modal
    cy.openColumnsModal().then(() => {
        cy.get(colSelectors.columnsModal).should('be.visible');

        // Check each column
        columnSelectors.forEach(selector => {
            cy.get(selector).check();
        });

        cy.byTestID(colSelectors.save).click();
    });
    cy.reload();

    // Verify columns appear in table
    cy.byTestID('table-composable').should('exist').within(() => {
        columnSelectors.forEach(selector => {
            cy.get(selector).should('exist');
        });
    });
});

Cypress.Commands.add('checkQuerySummary', (metric) => {
    // parseFloat handles formats: "123 ms", "123+ ms", "1.5k ms", "1.5k+ ms"
    const num = parseFloat(metric.text())
    expect(num).to.be.greaterThan(0)
});

Cypress.Commands.add('changeQueryOption', (name: string) => {
    cy.get('#filter-toolbar-search-filters').contains('Query options').click();
    cy.get('#query-options-dropdown').contains(name).click();
    cy.get('#filter-toolbar-search-filters').contains('Query options').click();
});

Cypress.Commands.add('visitNetflowTrafficTab', (page) => {
    cy.visit(page)
    cy.get('[role="gridcell"]').eq(0).should('exist').within(() => {
        cy.get('a').should('exist').click()
    })
    cy.byLegacyTestID('horizontal-link-Network Traffic').should('exist').click()

    // validate netflow-traffic page shows values
    cy.checkNetflowTraffic()
});

Cypress.Commands.add('checkNetflowTraffic', (loki = "Enabled") => {
    // overview panels
    cy.get('#tabs-container').contains('Overview').click({ force: true })
    netflowPage.setAutoRefresh()
    cy.wait(2000)
    cy.checkPanel(overviewSelectors.defaultPanels)

    // table view
    if (loki == "Disabled") {
        // verify netflow traffic page is disabled
        cy.get('li.tableTabButton > button').should('exist').should('have.class', 'pf-m-aria-disabled')
    }
    else {
        cy.get('#tabs-container').contains('Traffic flows').click()
        cy.wait(1000)
        cy.byTestID("table-composable", { timeout: 60000 }).should('exist')
    }

    // topology view
    cy.get('#tabs-container').contains('Topology').click()
    cy.wait(2000)
    cy.get('#drawer', { timeout: 60000 }).should('not.be.empty')
});
