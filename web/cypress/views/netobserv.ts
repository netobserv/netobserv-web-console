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
    networkAlertHealth: './cypress/fixtures/flowcollector/fc_networkalert.yaml'
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
        cy.adminCLI('oc get csv -n openshift-netobserv-operator --no-headers -o custom-columns=":metadata.name"',
            { failOnNonZeroExit: false })
            .then((result: any) => {
                const stdout = result.stdout ? result.stdout.trim() : ''
                const csvName = stdout.split('\n').find((line: string) =>
                    line.includes('netobserv-operator') || line.includes('network-observability-operator')
                )

                if (csvName) {
                    // CSV exists, check if it's in Succeeded state
                    cy.adminCLI(`oc wait csv ${csvName.trim()} -n openshift-netobserv-operator --for=jsonpath='{.status.phase}'=Succeeded --timeout=120s`, { timeout: 140000 })
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
        cy.adminCLI('oc get csv -n openshift-netobserv-operator --no-headers -o custom-columns=":metadata.name"',
            { failOnNonZeroExit: false })
            .then((result: any) => {
                const stdout = result.stdout ? result.stdout.trim() : ''
                const csvName = stdout.split('\n').find((line: string) =>
                    line.includes('netobserv-operator') || line.includes('network-observability-operator')
                )

                if (!csvName) {
                    throw new Error(`NetObserv CSV not found. oc get csv stdout: ${stdout}`)
                }
                const csvUrl = `/k8s/ns/openshift-netobserv-operator/operators.coreos.com~v1alpha1~ClusterServiceVersion/${csvName.trim()}/flows.netobserv.io~v1beta2~FlowCollector`
                const ensureLoaded = (retries = 3): void => {
                    cy.visit(csvUrl)
                    // Wait for any page to finish loading (cluster overview
                    // also has loading-box__loaded, so we check URL after).
                    cy.get('div.loading-box__loaded', { timeout: 120000 }).should('exist')
                    cy.url().then(url => {
                        if (!url.includes('FlowCollector')) {
                            if (retries > 0) {
                                cy.log(`Console redirected away from FlowCollector page (${retries} retries left). URL: ${url}`)
                                cy.wait(10000)
                                ensureLoaded(retries - 1)
                            } else {
                                throw new Error(
                                    `Console keeps redirecting away from FlowCollector page. ` +
                                    `Expected URL containing 'FlowCollector', got: ${url}`
                                )
                            }
                        }
                    })
                }
                ensureLoaded()
            })
    },
    createFlowcollector: (parameters?: FlowCollectorParameter) => {
        Operator.visitFlowcollector()
        cy.get('div.loading-box__loaded').should('exist')
        cy.wait(3000)
        cy.get("#yaml-create", { timeout: 60000 }).should('exist').then(() => {
            if ((Cypress.$('td[role="gridcell"]').length > 0) && (parameters != null)) {
                Operator.deleteFlowCollector()
                // Wait for old Loki resources to be cleaned up before creating new FC.
                // Without this, the operator may struggle to recreate Loki resources
                // because the old PVC is still being finalized (can take up to 6 min on AWS EBS).
                cy.adminCLI(
                    `oc wait --for=delete deployment/loki -n ${project} --timeout=120s`,
                    { failOnNonZeroExit: false, timeout: 140000 }
                )
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
                    // Ensure FlowCollector exists before polling pods (UI Submit is async).
                    const waitForFlowCollector = (attempt = 0): void => {
                        const maxAttempts = 24
                        cy.adminCLI(`oc get flowcollector cluster -o name`, {
                            failOnNonZeroExit: false
                        }).then((result: Cypress.Exec) => {
                            if (result.stdout?.trim()) {
                                return
                            }
                            if (attempt < maxAttempts) {
                                cy.wait(5000)
                                waitForFlowCollector(attempt + 1)
                            } else {
                                throw new Error(
                                    `Timed out waiting for flowcollector/cluster ` +
                                        `(exitCode=${result.exitCode} stderr=${result.stderr?.trim() || '(empty)'})`
                                )
                            }
                        })
                    }
                    waitForFlowCollector()
                    // Demo Loki pods are created async after FlowCollector apply; waiting
                    // immediately yields "no matching resources".
                    const waitForLokiPods = (attempt = 0): void => {
                        // ~10 min: PVC provisioning on AWS EBS + operator reconcile can
                        // take much longer when Loki resources are recreated from scratch
                        // (e.g. after FC delete + wizard-based re-create in StaticPlugin)
                        const maxAttempts = 120
                        cy.adminCLI(`oc get pods -l app=loki -n ${project} -o name`, {
                            failOnNonZeroExit: false
                        }).then((result: Cypress.Exec) => {
                            const stdout = result.stdout?.trim() || ''
                            if (stdout.length > 0) {
                                cy.adminCLI(
                                    `oc wait --for=condition=Ready pod -l app=loki -n ${project} --timeout=180s`,
                                    { timeout: 200000 }
                                )
                            } else if (attempt < maxAttempts) {
                                cy.wait(5000)
                                waitForLokiPods(attempt + 1)
                            } else {
                                // Dump Loki deployment state for diagnostics
                                cy.adminCLI(
                                    `oc get deployment,pvc,pods -l app=loki -n ${project} -o wide`,
                                    { failOnNonZeroExit: false, timeout: 30000 }
                                ).then((diag: Cypress.Exec) => {
                                    throw new Error(
                                        `Timed out waiting for Loki pods (app=loki) in ${project} after ${maxAttempts} attempts. ` +
                                        `Loki resources: ${(diag.stdout || '(empty)').substring(0, 500)}. ` +
                                        `Check gather-extra artifacts for operator logs and pod state.`
                                    )
                                })
                            }
                        })
                    }
                    waitForLokiPods()
                }

                // Check FlowCollector status and wait for all components to be Ready
                if (parameters !== "WithLokiStack") {
                    // Check status in the FlowCollector 'cluster' row specifically
                    cy.contains('tr', 'cluster').within(() => {
                        cy.byTestID('status-text', { timeout: 60000 }).should('contain.text', 'Ready')
                    })
                    cy.adminCLI(`oc wait --for=condition=Ready pod -l app=netobserv-plugin -n ${project} --timeout=180s`, { timeout: 200000 })

                    // Wait for eBPF agent and FLP pods to be running.
                    // FC "Ready" means the operator reconciled, but pods may
                    // still be starting (DaemonSet rolling out on each node, etc.).
                    // FLP can be a Deployment (Service/Kafka model) or DaemonSet (Direct model),
                    // so we wait on pods rather than a specific resource type.
                    cy.adminCLI(
                        `oc wait --for=condition=Ready pod -l app=netobserv-ebpf-agent -n ${project} --timeout=180s`,
                        { failOnNonZeroExit: false, timeout: 200000 }
                    )
                    cy.adminCLI(
                        `oc wait --for=condition=Ready pod -l app=flowlogs-pipeline -n ${project} --timeout=180s`,
                        { failOnNonZeroExit: false, timeout: 200000 }
                    )

                    // Wait for the operator to reconcile the frontend ConfigMap
                    // with the expected eBPF features. Without this, the plugin page
                    // loads with a stale config and shows wrong/missing panels.
                    const featureMap: Record<string, string> = {
                        FlowRTT: 'flowRTT',
                        DNSTracking: 'dnsTracking',
                        PacketDrop: 'pktDrop',
                        TLSTracking: 'tlsTracking',
                        UDNMapping: 'udnMapping',
                        NetworkAlertHealth: 'dnsTracking'
                    }
                    const expectedFeature = featureMap[parameters || '']
                    if (expectedFeature) {
                        const waitForConfig = (attempt = 0): void => {
                            const maxAttempts = 60
                            cy.adminCLI(
                                `oc get configmap console-plugin-config -n ${project} -o jsonpath='{.data.config\\.yaml}'`,
                                { failOnNonZeroExit: false }
                            ).then((result: Cypress.Exec) => {
                                const config = result.stdout || ''
                                const hasFeature = new RegExp(`^\\s*-\\s+${expectedFeature}\\s*$`, 'm').test(config)
                                cy.log(`ConfigMap features '${expectedFeature}': ${hasFeature} (attempt ${attempt + 1}/${maxAttempts})`)
                                if (hasFeature) {
                                    return
                                }
                                if (attempt < maxAttempts) {
                                    cy.wait(5000)
                                    waitForConfig(attempt + 1)
                                } else {
                                    const featuresMatch = config.match(/features:[\s\S]*?(?=\n\s*[a-z]|\n$|$)/)
                                    cy.log(
                                        `WARNING: ConfigMap features list missing '${expectedFeature}' after ${maxAttempts} attempts. ` +
                                        `Actual features section: ${featuresMatch?.[0]?.trim() || '(empty or not found)'}. ` +
                                        `Proceeding anyway — checkPanel reload-retry may still recover.`
                                    )
                                }
                            })
                        }
                        waitForConfig()
                    }

                    // Restart the plugin deployment to ensure pods mount the
                    // updated ConfigMap. The ConfigMap volume mount can lag the
                    // API object by 60-120s (kubelet sync). Without a restart the
                    // pod may serve stale config missing the expected feature.
                    cy.adminCLI(
                        `oc rollout restart deployment/netobserv-plugin -n ${project}`,
                        { failOnNonZeroExit: false, timeout: 60000 }
                    )
                    cy.adminCLI(
                        `oc rollout status deployment/netobserv-plugin -n ${project} --timeout=180s`,
                        { failOnNonZeroExit: false, timeout: 200000 }
                    )

                    // Force reload to ensure console picks up the new ConsolePlugin
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
        // Loki tab — select Monolithic mode, then enable demo Loki.
        // Open the mode dropdown and select "Monolithic" by text.
        // PF6 renders Select options as menu items — clicking the <li> wrapper
        // (matched by the old ID selector) does not trigger selection; we must
        // click the inner text element.
        cy.get(pluginSelectors.lokiMode).should('exist').click()
        cy.contains('[role="option"]', 'Monolithic').should('be.visible').click()
        // Wait for form to render Monolithic-specific fields after mode change
        cy.get(pluginSelectors.installDemoLoki).should('exist').and('be.visible').check()
        cy.get(pluginSelectors.installDemoLoki).should('be.checked')
        cy.get(pluginSelectors.next).should('exist').click()
        // Consumption tab - submit button may be clipped by parent overflow:hidden
        // when the step content (cluster metrics, recommendations) is tall, so use force:true
        cy.get(pluginSelectors.wizardSubmit).should('exist').click({ force: true })
        // Verify submit outcome: wizard navigates to /status on success, or shows errors on failure
        const verifySubmit = (attempt = 0): void => {
            cy.url().then(url => {
                if (url.includes('/status')) {
                    cy.log('Wizard submit succeeded - navigated to status page')
                    return
                }
                // Check for form validation errors displayed in the wizard
                cy.get('body').then($body => {
                    const errors = $body.find('.pf-v6-c-alert__title, .pf-v6-c-helper-text__item-text.pf-m-error')
                    if (errors.length > 0) {
                        const errorTexts = [...errors].map(e => e.textContent).join('; ')
                        throw new Error(`Wizard submit failed with errors: ${errorTexts}`)
                    }
                    if (attempt < 2) {
                        cy.log(`Wizard submit pending (attempt ${attempt + 1}/3) - retrying click`)
                        cy.get(pluginSelectors.wizardSubmit).should('exist').click({ force: true })
                        cy.wait(5000)
                        verifySubmit(attempt + 1)
                    } else {
                        cy.screenshot('wizard-submit-failure')
                        throw new Error(
                            'Wizard submit did not navigate to status page and no errors shown. ' +
                            `Current URL: ${url}. Check screenshot for wizard state.`
                        )
                    }
                })
            })
        }
        cy.wait(3000)
        verifySubmit()

        // Verify the wizard-created FC actually has installDemoLoki enabled.
        // If this fails, the wizard checkbox interaction above did not work.
        cy.adminCLI(
            'oc get flowcollector cluster -o jsonpath="{.spec.loki.monolithic.installDemoLoki}"',
            { failOnNonZeroExit: false, timeout: 60000 }
        ).then((result: Cypress.Exec) => {
            const val = result.stdout?.replace(/"/g, '').trim() || ''
            expect(val).to.equal('true',
                'FlowCollector spec.loki.monolithic.installDemoLoki must be true. ' +
                'The wizard installDemoLoki checkbox was not properly applied.'
            )
        })
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
