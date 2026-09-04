import { netflowPage, topologyPage } from "@views/netflow-page"
import { Operator } from "@views/netobserv"
import { networkHealth, networkHealthSelectors } from "@views/network-health"

const alertServerity = ["Info", "Warning", "Critical"]

describe('(OCP-84821) Network Health test', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
        cy.uiLogin(Cypress.env('LOGIN_IDP'), Cypress.env('LOGIN_USERNAME'), Cypress.env('LOGIN_PASSWORD'))

        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector("NetworkAlertHealth")

        cy.adminCLI("oc apply -f cypress/fixtures/dns_errors.yaml")
        cy.adminCLI("oc wait --for=condition=Ready pod/dnsutils -n dns-traffic --timeout=180s", { timeout: 200000 })

        // Verify the operator created the PrometheusRule (contains DNSNxDomain alert definitions).
        // The operator creates it as "flowlogs-pipeline-alert" in the netobserv namespace.
        const waitForPrometheusRule = (attempt = 0): void => {
            const maxAttempts = 60
            // NOTE: cy.adminCLI appends --kubeconfig to the entire command string,
            // so pipes (|) are NOT safe — the --kubeconfig ends up on the piped command.
            // Always parse output in JavaScript instead.
            cy.adminCLI(
                `oc get prometheusrule -n netobserv -o name`,
                { failOnNonZeroExit: false }
            ).then((result: Cypress.Exec) => {
                const lines = (result.stdout?.trim() || '').split('\n').filter(l => l.length > 0)
                cy.log(`PrometheusRule count in netobserv: ${lines.length} (attempt ${attempt + 1}/${maxAttempts})`)
                if (lines.length > 0) {
                    return
                }
                if (attempt < maxAttempts) {
                    cy.wait(5000)
                    waitForPrometheusRule(attempt + 1)
                } else {
                    cy.adminCLI(
                        `oc get prometheusrule -A -o custom-columns='NAMESPACE:.metadata.namespace,NAME:.metadata.name' --no-headers`,
                        { failOnNonZeroExit: false }
                    ).then((dump: Cypress.Exec) => {
                        throw new Error(
                            'PrometheusRule never created by operator in netobserv namespace after 5 minutes. ' +
                            `All PrometheusRules: ${dump.stdout?.trim() || '(empty)'}. ` +
                            'Check operator logs in gather-extra artifacts.'
                        )
                    })
                }
            })
        }
        waitForPrometheusRule()

        // Phase 1: Verify FLP metrics are being scraped by Prometheus.
        // This proves the pipeline: eBPF agent → FLP → Prometheus scrape is working.
        // Without this, we'd wait 8 min for alerts only to discover FLP wasn't scraped.
        const waitForFLPScrape = (attempt = 0): void => {
            const maxAttempts = 36
            cy.adminCLI(
                `oc exec -n openshift-monitoring -c prometheus prometheus-k8s-0 -- ` +
                `sh -c "curl -sf 'http://localhost:9090/api/v1/targets?state=active' 2>/dev/null"`,
                { failOnNonZeroExit: false, timeout: 120000 }
            ).then((result: Cypress.Exec) => {
                const output = result.stdout || ''
                const hasFLP = output.includes('flowlogs-pipeline')
                cy.log(`FLP scraped by Prometheus: ${hasFLP} (attempt ${attempt + 1}/${maxAttempts})`)
                if (hasFLP) {
                    return
                }
                if (attempt < maxAttempts) {
                    cy.wait(10000)
                    waitForFLPScrape(attempt + 1)
                } else {
                    throw new Error(
                        'FLP metrics target not discovered by Prometheus after 6 minutes. ' +
                        'Pipeline broken before alert evaluation can begin. ' +
                        'Check gather-extra artifacts for FLP pods, ServiceMonitor, and Prometheus target state.'
                    )
                }
            })
        }
        waitForFLPScrape()

        // Phase 2: Verify dns_flows_total metrics are being produced by FLP.
        // The DNSNxDomain alert uses dns_flows_total (which has DnsFlagsResponseCode labels),
        // NOT dns_latency_seconds. Without dns_flows_total, the alert PromQL references a
        // non-existent metric and can never fire.
        const waitForDNSFlowsMetrics = (attempt = 0): void => {
            const maxAttempts = 36
            cy.adminCLI(
                `oc exec -n openshift-monitoring -c prometheus prometheus-k8s-0 -- ` +
                `sh -c "curl -sf 'http://localhost:9090/api/v1/query?query=netobserv_namespace_dns_flows_total' 2>/dev/null"`,
                { failOnNonZeroExit: false, timeout: 120000 }
            ).then((result: Cypress.Exec) => {
                const output = result.stdout || ''
                const hasData = output.includes('"result":[{') && !output.includes('"result":[]')
                cy.log(`DNS flows_total metrics in Prometheus: ${hasData} (attempt ${attempt + 1}/${maxAttempts})`)
                if (hasData) {
                    return
                }
                if (attempt < maxAttempts) {
                    cy.wait(10000)
                    waitForDNSFlowsMetrics(attempt + 1)
                } else {
                    throw new Error(
                        'netobserv_namespace_dns_flows_total not found in Prometheus after 6 minutes. ' +
                        'The DNSNxDomain alert requires dns_flows_total metrics (not dns_latency_seconds). ' +
                        'Verify the FC includeList contains namespace_dns_flows_total.'
                    )
                }
            })
        }
        waitForDNSFlowsMetrics()

        // Phase 3: Wait for DNS NxDomain alerts to start firing.
        // Pipeline: metric accumulation → rule evaluation → for: 5m duration → alert fires.
        // With correct dns_flows_total metrics, alerts need ~7-8 min:
        //   ~2 min for metrics accumulation + ~5 min for: duration + evaluation intervals.
        const waitForAlerts = (attempt = 0): void => {
            const maxAttempts = 60
            cy.adminCLI(
                `oc exec -n openshift-monitoring -c prometheus prometheus-k8s-0 -- ` +
                `sh -c "curl -sf 'http://localhost:9090/api/v1/alerts' 2>/dev/null"`,
                { failOnNonZeroExit: false, timeout: 120000 }
            ).then((result: Cypress.Exec) => {
                const output = result.stdout || ''
                const count = (output.match(/DNSNxDomain/g) || []).length
                cy.log(`Prometheus DNSNxDomain alert count: ${count} (attempt ${attempt + 1}/${maxAttempts})`)
                if (count > 0) {
                    return
                }
                if (attempt < maxAttempts) {
                    cy.wait(10000)
                    waitForAlerts(attempt + 1)
                } else {
                    // Dump the actual PrometheusRule PromQL to verify if operator has the _count fix
                    cy.adminCLI(
                        `oc get prometheusrule -n netobserv -o jsonpath='{range .items[*].spec.groups[*].rules[*]}{.alert}{" => "}{.expr}{\"\\n\"}{end}'`,
                        { failOnNonZeroExit: false, timeout: 60000 }
                    ).then((promRuleDump: Cypress.Exec) => {
                        const promRuleOutput = promRuleDump.stdout || ''
                        const dnsRules = promRuleOutput.split('\n')
                            .filter((l: string) => l.includes('DNSNxDomain'))
                            .slice(0, 5)
                            .join(' | ')

                        // Use --data-urlencode for safe PromQL query (avoids {} [] encoding issues)
                        cy.adminCLI(
                            `oc exec -n openshift-monitoring -c prometheus prometheus-k8s-0 -- ` +
                            `sh -c "curl -s --fail-with-body -G 'http://localhost:9090/api/v1/query' ` +
                            `--data-urlencode 'query=count(netobserv_namespace_dns_flows_total) by (DnsFlagsResponseCode)'"`,
                            { failOnNonZeroExit: false, timeout: 120000 }
                        ).then((labelDump: Cypress.Exec) => {
                            throw new Error(
                                'DNSNxDomain alerts not firing after 10 minutes of polling. ' +
                                `PrometheusRule PromQL for DNSNxDomain: [${dnsRules || '(none)'}]. ` +
                                `dns_flows_total labels: ${(labelDump.stdout || '').substring(0, 500)}. ` +
                                'Check gather-extra artifacts for operator/FLP logs and Prometheus state.'
                            )
                        })
                    })
                }
            })
        }
        waitForAlerts()
    })

    beforeEach('test', function () {
        cy.clearNetobservLocalStorage()

    })

    it("(OCP-84821, memodi) Verify Network Health Alerts", function () {
        cy.visit('/monitoring/alertrules')
        cy.get('table', { timeout: 60000 }).should('exist')

        cy.get('#name').should('be.visible').clear().type('DNSNxDomain_PerDst{enter}')
        const variants = ["Namespace", "Workload"]
        variants.forEach(variant => {
            alertServerity.forEach(severity => {
                cy.contains(`DNSNxDomain_PerDst${variant}${severity}`).should('exist')
            })
        })
        cy.visit('/network-health')
        cy.get("#content-scrollable").should('exist')
        netflowPage.setAutoRefresh()
        cy.get(networkHealthSelectors.global).should('exist')
        cy.get(networkHealthSelectors.node).should('exist')
        cy.get(networkHealthSelectors.namespace).should('exist')
        cy.get(networkHealthSelectors.workload).should('exist')

        // Switch to namespace tab and wait for health cards to load
        cy.get(networkHealthSelectors.namespace).should('exist').click()
        networkHealth.verifyAlert("dns-traffic")

        networkHealth.navigateToAlertPage("dns-traffic")
    })

    it("(OCP-84821, memodi) Verify RecordingRules", function () {
        cy.visit('/network-health')
        netflowPage.setAutoRefresh()
        cy.get(networkHealthSelectors.node).should('exist').click()

        networkHealth.verifyAlert("ip", "recording", "Too many DNS NX_DOMAIN errors")
    })

    it("(OCP-84821, memodi) Verify Health Topology Integration", function () {
        cy.visit('/network-health')
        netflowPage.setAutoRefresh()

        cy.get(networkHealthSelectors.namespace).should('exist').click()
        networkHealth.clickOnAlert("dns-traffic")

        cy.get(networkHealthSelectors.sidePanel).should('be.visible')
        // click the kebab button
        cy.get('div.rule-details-row').first().find('button').click({ force: true }).then(() => {
            cy.contains('Inspect network traffic', { timeout: 60000 }).click().then(() => {
                cy.checkNetflowTraffic()
                // select Owner group
                topologyPage.selectGroupWithSlider("Owner")
                topologyPage.selectGroupWithSlider("Namespace")
                // click on the NS and check Health tab in sidebar.
                cy.get('g[data-kind="node"] > g').eq(1).parent().should('exist').click()
                cy.get('#elementPanel').should('be.visible')
                cy.get('#drawer-tabs').contains('Health').should('exist').click()
                cy.get('div .rule-details-row').should('exist')
            })
        })
    })

    after("all tests", function () {
        cy.adminCLI('oc delete -f cypress/fixtures/dns_errors.yaml --ignore-not-found')
        Operator.deleteFlowCollector()
        cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
    })
})
