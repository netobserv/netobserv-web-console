import { catalogSources } from "@views/catalog-source"
import { pluginSelectors } from "@views/netflow-page"
import { operatorHubPage } from "@views/operator-hub-page"

declare global {
    namespace Cypress {
        interface Chainable {
            enableFLPMetrics(tag: string[]): Chainable<Element>
            checkStorageClass(context: Mocha.Context): Chainable<Element>
            deployFlowcollectorFromFixture(fixtureFile: string): Chainable<Element>
        }
    }
}

// Types
type FlowCollectorParameter =
    | 'PacketDrop'
    | 'FlowRTT'
    | 'DNSTracking'
    | 'UDNMapping'
    | 'TLSTracking'
    | 'LokiDisabled'
    | 'WithLokiStack'
    | 'Conversations'
    | 'ZonesAndMultiCluster'
    | 'BytesMetrics'
    | 'PacketsMetrics'
    | 'SubnetLabels'
    | 'StaticPlugin'
    | 'NetworkAlertHealth'
    | 'AllFeatures'

// Constants
export const project = "netobserv"

// Environment variables
const catSrc = Cypress.env('NOO_CATALOG_SOURCE')
const catSrcImage: string = Cypress.env('NOO_CS_IMAGE')

// Default catalog images
const DEFAULT_UPSTREAM_IMAGE = 'quay.io/netobserv/network-observability-operator-catalog:v0.0.0-sha-main'
const DEFAULT_DOWNSTREAM_IMAGE = "quay.io/redhat-user-workloads/ocp-network-observab-tenant/catalog-ystream:latest"

// FlowCollector fixture paths (relative to web/ directory where Cypress executes)
const FIXTURE_PATHS = {
    default: './cypress/fixtures/flowcollector/fc.yaml',
    bytesMetrics: './cypress/fixtures/flowcollector/fc_bytesMetrics.yaml',
    packetsMetrics: './cypress/fixtures/flowcollector/fc_packetsMetrics.yaml',
    packetDrop: './cypress/fixtures/flowcollector/fc_packetDrop.yaml',
    dnsTracking: './cypress/fixtures/flowcollector/fc_DNSTracking.yaml',
    flowRTT: './cypress/fixtures/flowcollector/fc_flowRTT.yaml',
    udnMapping: './cypress/fixtures/flowcollector/fc_UDN.yaml',
    tlsTracking: './cypress/fixtures/flowcollector/fc_TLSTracking.yaml',
    lokiDisabled: './cypress/fixtures/flowcollector/fc_lokiDisabled.yaml',
    withLokiStack: './cypress/fixtures/flowcollector/fc_withLokiStack.yaml',
    conversations: './cypress/fixtures/flowcollector/fc_conversations.yaml',
    subnetLabels: './cypress/fixtures/flowcollector/fc_subnetLabel.yaml',
    zonesMultiCluster: './cypress/fixtures/flowcollector/fc_zoneMulticluster.yaml',
    networkAlertHealth: './cypress/fixtures/flowcollector/fc_networkalert.yaml',
    allFeatures: './cypress/fixtures/flowcollector/fc_allFeatures.yaml'
} as const

export const Operator = {
    name: () => {
        if (`${Cypress.env('NOO_CATALOG_SOURCE')}` === "upstream") {
            return "NetObserv Operator"
        }
        else {
            return "Network Observability"
        }
    },
    install_catalogsource: () => {
        let catalogDisplayName = "Production Operators"
        let catalogImg: string
        let catalogSource: string

        if (catSrc === "upstream") {
            catalogImg = catSrcImage ? catSrcImage : DEFAULT_UPSTREAM_IMAGE
            catalogSource = "netobserv-test"
            catalogDisplayName = "NetObserv QE"
            catalogSources.createCustomCatalog(catalogImg, catalogSource, catalogDisplayName)
        }
        else {
            catalogImg = catSrcImage ? catSrcImage : DEFAULT_DOWNSTREAM_IMAGE
            catalogSource = "netobserv-konflux-fbc"
            catalogDisplayName = "NetObserv Konflux"
            catalogSources.createCustomCatalog(catalogImg, catalogSource, catalogDisplayName)
            // deploy ImageDigetMirrorSet
            cy.adminCLI('oc apply -f ./cypress/fixtures/image-digest-mirror-set.yaml')
        }
        return catalogSource
    },
    install: () => {
        if (`${Cypress.env('SKIP_NOO_INSTALL')}` === "true") {
            return null
        }
        // Check operator status via CLI
        cy.adminCLI('oc get csv -n openshift-netobserv-operator --no-headers -o custom-columns=":metadata.name" 2>/dev/null || echo "NotFound"')
            .then((result: any) => {
                const stdout = result.stdout ? result.stdout.trim() : ''
                const csvName = stdout.split('\n').find((line: string) =>
                    line.includes('netobserv-operator') || line.includes('network-observability-operator')
                )

                if (csvName && !stdout.includes('NotFound') && !stdout.includes('No resources found')) {
                    // CSV exists, check if it's in Succeeded state
                    cy.adminCLI(`oc wait csv ${csvName.trim()} -n openshift-netobserv-operator --for=jsonpath='{.status.phase}'=Succeeded --timeout=120s`)
                        .then(() => {
                            cy.log('NetObserv Operator already installed')
                        })
                } else {
                    cy.log('Installing NetObserv Operator')
                    var catalogSource = Operator.install_catalogsource()

                    if (catSrc === "upstream") {
                        // metrics checkbox is not available for upstream operators
                        operatorHubPage.install("netobserv-operator", catalogSource, false)
                    } else {
                        operatorHubPage.install("netobserv-operator", catalogSource, true)
                    }
                }
        })
    },
    visitFlowcollector: () => {
        cy.adminCLI('oc get csv -n openshift-netobserv-operator --no-headers -o custom-columns=":metadata.name" 2>/dev/null || echo "NotFound"')
            .then((result: any) => {
                const stdout = result.stdout ? result.stdout.trim() : ''
                const csvName = stdout.split('\n').find((line: string) =>
                    line.includes('netobserv-operator') || line.includes('network-observability-operator')
                )

                if (csvName && !stdout.includes('NotFound') && !stdout.includes('No resources found')) {
                    cy.visit(`/k8s/ns/openshift-netobserv-operator/operators.coreos.com~v1alpha1~ClusterServiceVersion/${csvName.trim()}/flows.netobserv.io~v1beta2~FlowCollector`)
                    cy.get('div.loading-box__loaded', { timeout: 30000 }).should('exist')
                } else {
                    throw new Error('NetObserv CSV not found')
                }
            })
    },
    createFlowcollector: (parameters?: FlowCollectorParameter) => {
        Operator.visitFlowcollector()
        cy.get('div.loading-box__loaded').should('exist')
        cy.wait(3000)
        cy.get("#yaml-create", { timeout: 60000 }).should('exist').then(() => {
            if ((Cypress.$('td[role="gridcell"]').length > 0) && (parameters != null)) {
                Operator.deleteFlowCollector()
                // come back to flowcollector tab after deletion
                Operator.visitFlowcollector()
            }
        })
        // don't create flowcollector if already exists
        cy.get('div.loading-box__loaded', { timeout: 60000 }).should('be.visible').then(() => {
            if (Cypress.$('td[role="gridcell"]').length === 0) {
                cy.log("Deploying flowcollector")
                switch (parameters) {
                    case "PacketDrop":
                        cy.deployFlowcollectorFromFixture(FIXTURE_PATHS.packetDrop)
                        break;
                    case "FlowRTT":
                        cy.deployFlowcollectorFromFixture(FIXTURE_PATHS.flowRTT)
                        break;
                    case "DNSTracking":
                        cy.deployFlowcollectorFromFixture(FIXTURE_PATHS.dnsTracking)
                        break;
                    case "UDNMapping":
                        cy.deployFlowcollectorFromFixture(FIXTURE_PATHS.udnMapping)
                        break;
                    case "TLSTracking":
                        cy.deployFlowcollectorFromFixture(FIXTURE_PATHS.tlsTracking)
                        break;
                    case "LokiDisabled":
                        cy.deployFlowcollectorFromFixture(FIXTURE_PATHS.lokiDisabled)
                        break;
                    case "WithLokiStack":
                        cy.deployFlowcollectorFromFixture(FIXTURE_PATHS.withLokiStack)
                        break;
                    case "Conversations":
                        cy.deployFlowcollectorFromFixture(FIXTURE_PATHS.conversations)
                        break;
                    case "ZonesAndMultiCluster":
                        cy.deployFlowcollectorFromFixture(FIXTURE_PATHS.zonesMultiCluster)
                        break;
                    case "BytesMetrics":
                        cy.deployFlowcollectorFromFixture(FIXTURE_PATHS.bytesMetrics)
                        break;
                    case "PacketsMetrics":
                        cy.deployFlowcollectorFromFixture(FIXTURE_PATHS.packetsMetrics)
                        break;
                    case "SubnetLabels":
                        cy.deployFlowcollectorFromFixture(FIXTURE_PATHS.subnetLabels)
                        break;
                    case "StaticPlugin":
                        // Flowcollector deployed with PacketDrop enabled
                        Operator.deployFlowcollectorFromUI()
                        // Navigate back to FlowCollector list page after UI deployment
                        Operator.visitFlowcollector()
                        break;
                    case "NetworkAlertHealth":
                        // Flowcollector deployed with DNSTracking enabled
                        cy.deployFlowcollectorFromFixture(FIXTURE_PATHS.networkAlertHealth)
                        break;
                    case "AllFeatures":
                        cy.deployFlowcollectorFromFixture(FIXTURE_PATHS.allFeatures)
                        break;
                    default:
                        cy.deployFlowcollectorFromFixture(FIXTURE_PATHS.default)
                        break;
                }
                // Bug: OCPBUGS-58468
                // cy.byTestID('refresh-web-console', { timeout: 60000 }).should('exist')
                // cy.reload(true)
                if (parameters !== "StaticPlugin") {
                    cy.intercept('**/copy-login-commands*').as('reload')
                    // wait for all window refresh
                    cy.wait('@reload', { timeout: 100000 })
                    cy.log("Console refreshed successfully")
                }
                if (parameters !== "LokiDisabled" && parameters !== "WithLokiStack") {
                    cy.adminCLI(`oc wait --for=condition=Ready pod -l app=loki -n ${project} --timeout=180s`)
                }

                // Check FlowCollector status and wait for plugin pod to be Ready
                if (parameters !== "WithLokiStack") {
                    // Check status in the FlowCollector 'cluster' row specifically
                    cy.contains('tr', 'cluster').within(() => {
                        cy.byTestID('status-text', { timeout: 60000 }).should('contain.text', 'Ready')
                    })
                    cy.adminCLI(`oc wait --for=condition=Ready pod -l app=netobserv-plugin -n ${project} --timeout=180s`)
                    // Force reload to ensure console picks up the new ConsolePlugin
                    // (the copy-login-commands intercept may have caught a delete-triggered reload)
                    cy.reload(true)
                }
            }
        })
    },
    deployFlowcollectorFromUI: () => {
        cy.byTestID('item-create').should('exist').click({ force: true })
        // Overview tab
        cy.get(pluginSelectors.next).should('exist').click()
        // Processing tab
        cy.get(pluginSelectors.privilegedToggle).should('exist').click({ force: true })
        // Enable PacketDrop
        cy.get(pluginSelectors.packetDropEnable).should('exist').check()
        cy.get(pluginSelectors.next).should('exist').click()
        // Loki tab
        cy.get(pluginSelectors.lokiMode).should('exist').click().then(mode => {
            cy.get(pluginSelectors.monolithicMode).should('exist').click()
        })
        cy.get(pluginSelectors.installDemoLoki).should('exist').click({ force: true })
        cy.get(pluginSelectors.next).should('exist').click()
        // Consumption tab - final submit
        cy.get('footer').contains('button', 'Submit').should('exist').click()
    },
    deleteFlowCollector: () => {
        cy.adminCLI(`oc delete flowcollector cluster --ignore-not-found`)
        // Bug: OCPBUGS-58468
        // cy.byTestID('refresh-web-console', { timeout: 60000 }).should('exist')
        // cy.reload(true)
    },
    uninstall: () => {
        cy.visit('k8s/all-namespaces/operators.coreos.com~v1alpha1~ClusterServiceVersion')

        cy.contains(Operator.name()).should('exist').invoke('attr', 'href').then(href => {
            cy.visit(href)
        })
        cy.get('.co-actions-menu > .pf-c-dropdown__toggle').should('exist').click()
        cy.byTestActionID('Uninstall Operator').should('exist').click()
        cy.byTestID('confirm-action').should('exist').click()
    },
    deleteCatalogSource: (catalogSource: string) => {
        cy.visit('k8s/cluster/config.openshift.io~v1~OperatorHub/cluster/sources')
        cy.byTestID(catalogSource).should('exist').invoke('attr', 'href').then(href => {
            cy.visit(href)
        })
        cy.get('.co-actions-menu > .pf-c-dropdown__toggle').should('exist').click()
        cy.byTestActionID('Delete CatalogSource').should('exist').click()
        cy.byTestID('confirm-action').should('exist').click()
    }
}

Cypress.Commands.add('checkStorageClass', (context: Mocha.Context) => {
    let storageClassCheck = false
    const kubeconfig = Cypress.env('KUBECONFIG_PATH');
    expect(kubeconfig, 'KUBECONFIG_PATH').to.be.a('string').and.not.be.empty
    cy.exec(`oc get sc --kubeconfig ${JSON.stringify(kubeconfig)}`).then(result => {
        if (result.stderr.includes('No resources found')) {
            cy.log('StorageClass not deployed, skipping')
            storageClassCheck = true
        }
        cy.wrap(storageClassCheck).then(scCheck => {
            if (scCheck) {
                context.skip()
            }
        })
    })
});

Cypress.Commands.add('enableFLPMetrics', (tags: string[]) => {
    for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        cy.get('#root_spec_processor_metrics_includeList_add-btn').should('exist').click()
        cy.get(`#root_spec_processor_metrics_includeList_${i}`).should('exist').click().then(metrics => {
            cy.get(`#${tag}-link`).should('exist').click()
        })
    }
});

Cypress.Commands.add('deployFlowcollectorFromFixture', (fixtureFile: string) => {
    cy.adminCLI(`oc apply -f ${fixtureFile}`)
})
