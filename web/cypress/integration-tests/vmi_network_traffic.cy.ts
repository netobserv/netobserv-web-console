import "@views/netobserv"
import { Operator } from "@views/netobserv"
import { netflowPage } from "@views/netflow-page"

const VMI_NAMESPACE = "test-vm"
const VMI_NAME = "test-vm"

describe('(NETOBSERV-2693) Network Traffic Tab on VMI Page', { tags: ['Network_Observability'] }, function () {

    before('setup', function () {
        // Add cluster admin role and login first (like other tests)
        cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
        cy.uiLogin(Cypress.env('LOGIN_IDP'), Cypress.env('LOGIN_USERNAME'), Cypress.env('LOGIN_PASSWORD'))

        // Install NetObserv operator
        if (`${Cypress.env('SKIP_NOO_INSTALL')}` !== 'true') {
            Operator.install()
        }

        cy.checkStorageClass(this)
        Operator.createFlowcollector()
        // Setup KubeVirt operator
        cy.adminCLI(`oc create namespace openshift-cnv`, { failOnNonZeroExit: false } as any)
        cy.adminCLI(`oc apply -f ./cypress/fixtures/vmi/kubevirt-operator-group.yaml`)
        cy.adminCLI(`oc apply -f ./cypress/fixtures/vmi/kubevirt-subscription.yaml`)
        cy.adminCLI(`oc apply -f ./cypress/fixtures/vmi/kubevirt-priority-class.yaml`)

        // Wait for subscription to create InstallPlan and CSV
        cy.checkCommandResult(
            "oc get subscription kubevirt-hyperconverged -n openshift-cnv -o jsonpath='{.status.installedCSV}'",
            'kubevirt',
            { retries: 30, interval: 10000 }
        )

        // Wait for CNV operator CSV to be Succeeded
        cy.checkCommandResult(
            "oc get csv -n openshift-cnv -o jsonpath='{.items[*].status.phase}'",
            'Succeeded',
            { retries: 60, interval: 20000 }
        )

        // Wait for webhook pod to be ready before creating HyperConverged CR
        cy.checkCommandResult(
            "oc get pods -n openshift-cnv -l name=hyperconverged-cluster-webhook -o jsonpath='{.items[*].status.conditions[?(@.type==\"Ready\")].status}' 2>/dev/null",
            'True',
            { retries: 30, interval: 10000 }
        )

        // Create HyperConverged CR
        cy.adminCLI(`oc apply -f ./cypress/fixtures/vmi/hyperconverged-cr.yaml`)
        cy.wait(5000)

        // Wait for HyperConverged to be available
        cy.checkCommandResult(
            "oc get hyperconverged kubevirt-hyperconverged -n openshift-cnv -o jsonpath='{.status.conditions[?(@.type==\"Available\")].status}'",
            'True',
            { retries: 60, interval: 20000 }
        )

        // Wait for KubeVirt CR to be created by HyperConverged operator
        cy.checkCommandResult(
            "oc get kubevirt kubevirt-kubevirt-hyperconverged -n openshift-cnv -o jsonpath='{.metadata.name}'",
            'kubevirt-kubevirt-hyperconverged',
            { retries: 60, interval: 10000 }
        )

        // Enable software emulation via JSON patch annotation
        cy.adminCLI(`oc annotate hyperconverged kubevirt-hyperconverged -n openshift-cnv 'kubevirt.kubevirt.io/jsonpatch=[{"op":"add","path":"/spec/configuration/developerConfiguration/useEmulation","value":true}]' --overwrite`)

        // Wait for emulation to be applied on KubeVirt CR
        cy.checkCommandResult(
            "oc get kubevirt kubevirt-kubevirt-hyperconverged -n openshift-cnv -o jsonpath='{.spec.configuration.developerConfiguration.useEmulation}'",
            'true',
            { retries: 30, interval: 10000 }
        )

        // Restart virt-handler pods to pick up emulation config
        cy.adminCLI('oc delete pods -n openshift-cnv -l kubevirt.io=virt-handler')
        cy.checkCommandResult(
            "oc get pods -n openshift-cnv -l kubevirt.io=virt-handler -o jsonpath='{.items[0].status.phase}'",
            'Running',
            { retries: 15, interval: 10000 }
        )

        // Create test VM namespace and VM
        cy.adminCLI(`oc create namespace ${VMI_NAMESPACE}`, { failOnNonZeroExit: false } as any)
        cy.adminCLI(`oc apply -f ./cypress/fixtures/vmi/test-vm.yaml`)

        // Wait for VM to be running
        cy.checkCommandResult(
            `oc get vm ${VMI_NAME} -n ${VMI_NAMESPACE} -o jsonpath='{.status.printableStatus}'`,
            'Running',
            { retries: 30, interval: 20000 }
        )

        // Generate network traffic from the VM by making requests from virt-launcher pod
        cy.adminCLI(`oc get pods -n ${VMI_NAMESPACE} -l kubevirt.io/domain=${VMI_NAME} -o jsonpath='{.items[0].metadata.name}'`)
            .then((result: any) => {
                const podName = result.stdout.trim()
                cy.wrap(podName).should('not.be.empty', 'virt-launcher pod should exist')
                // Generate multiple curl requests to ensure traffic is captured
                cy.adminCLI(`oc exec -n ${VMI_NAMESPACE} ${podName} -- timeout 10 curl -v http://8.8.8.8 2>&1 | head -20`, { failOnNonZeroExit: false } as any)
                cy.wait(2000)
                cy.adminCLI(`oc exec -n ${VMI_NAMESPACE} ${podName} -- timeout 10 curl -v http://8.8.8.8 2>&1 | head -20`, { failOnNonZeroExit: false } as any)
            })

        // Wait for flows to be ingested into Loki by polling flow-collector logs
        cy.adminCLI(`oc logs -n netobserv -l app=netobserv-plugin,component=flow-collector --tail=100 2>/dev/null | grep -i "packet\\|flow" || echo "waiting"`, { retries: 30, interval: 5000 })
    })

    it('(NETOBSERV-2693, kapjain) Navigate from Search to VMI and verify Network Traffic on virt-launcher Pod', { tags: ["@smoke"] }, function () {
        // Navigate to search page with VirtualMachineInstance resource pre-selected
        cy.visit(`/search/ns/${VMI_NAMESPACE}?kind=kubevirt.io~v1~VirtualMachineInstance`)

        // Verify VMI appears in search results and click on it
        cy.get('tbody tr', { timeout: 30000 }).should('have.length.greaterThan', 0)
        cy.get('tbody tr', { timeout: 30000 }).contains(VMI_NAME).click()

        // Verify we are on the VMI detail page
        cy.url().should('contain', 'VirtualMachineInstance')
        cy.url().should('contain', VMI_NAME)

        // Navigate to the virt-launcher Pod from VMI detail page
        cy.contains('a', 'virt-launcher', { timeout: 30000 }).should('exist').click()

        // Verify we are on the Pod detail page
        cy.url().should('contain', 'pods')
        cy.wait(2000)

        // Click on Network Traffic tab
        cy.byLegacyTestID('horizontal-link-Network Traffic').should('be.visible', { timeout: 60000 }).click()

        // Increase time range to capture flows
        cy.byTestID('time-range-dropdown-dropdown').should('be.visible', { timeout: 30000 }).click()
        cy.get('[data-test="1h"]').should('be.visible', { timeout: 10000 }).click()

        // Wait for page to stabilize and allow flows to load
        cy.wait(5000)

        // Verify traffic flows are present in the table tab
        cy.get('#tabs-container').contains('Traffic flows').click()

        // Click refresh button to reload flows
        cy.get('[data-test="refresh-button"]').should('be.visible').click()
        cy.wait(2000)

        cy.get('[data-test="table-composable"]', { timeout: 120000 }).should('exist')
        cy.get('[data-test="table-composable"] tbody tr', { timeout: 120000 }).should('have.length.greaterThan', 0)

        cy.wait(3000)

        // Verify overview tab loads with panels
        cy.get('#tabs-container').contains('Overview').click({ force: true })
        netflowPage.waitForLokiQuery()
        cy.get('#overview-flex', { timeout: 120000 }).should('exist')

        // Verify topology tab loads with graph content
        cy.get('#tabs-container').contains('Topology').click()
        cy.get('#drawer', { timeout: 120000 }).should('exist')
    })

    it('(NETOBSERV-2761, kapjain) Navigate from Virtualization VM page and verify Network Traffic on virt-launcher Pod', { tags: ["@smoke"] }, function () {
        // Navigate to the VirtualMachine detail page via Virtualization
        cy.visit(`/k8s/ns/${VMI_NAMESPACE}/kubevirt.io~v1~VirtualMachine/${VMI_NAME}`)

        // Verify we are on the VM detail page
        cy.url().should('contain', 'VirtualMachine')
        cy.url().should('contain', VMI_NAME)
        cy.contains(VMI_NAME, { timeout: 30000 }).should('exist')

        // Give page time to fully load
        cy.wait(3000)

        // Navigate to the virt-launcher Pod from VM detail page
        cy.contains('a', 'virt-launcher', { timeout: 30000 }).should('be.visible').click()

        // Verify we are on the Pod detail page
        cy.url().should('contain', 'pods')
        cy.wait(2000)

        // Click on Network Traffic tab
        cy.byLegacyTestID('horizontal-link-Network Traffic').should('be.visible', { timeout: 60000 }).click()

        // Increase time range to capture flows
        cy.byTestID('time-range-dropdown-dropdown').should('be.visible', { timeout: 30000 }).click()
        cy.get('[data-test="1h"]').should('be.visible', { timeout: 10000 }).click()

        // Verify traffic flows are present in the table tab
        cy.get('#tabs-container').contains('Traffic flows').click()

        // Click refresh button to reload flows
        cy.get('[data-test="refresh-button"]').should('be.visible').click()
        cy.wait(2000)

        cy.get('[data-test="table-composable"]', { timeout: 120000 }).should('exist')
        cy.get('[data-test="table-composable"] tbody tr', { timeout: 120000 }).should('have.length.greaterThan', 0)

        cy.wait(3000)

        // Verify overview tab loads with panels
        cy.get('#tabs-container').contains('Overview').click({ force: true })
        netflowPage.waitForLokiQuery()
        cy.get('#overview-flex', { timeout: 120000 }).should('exist')

        // Verify topology tab loads with graph content
        cy.get('#tabs-container').contains('Topology').click()
        cy.get('#drawer', { timeout: 120000 }).should('exist')
    })

    after("cleanup", function () {
        // Delete test VM and namespace
        cy.adminCLI(`oc delete vm ${VMI_NAME} -n ${VMI_NAMESPACE}`, { failOnNonZeroExit: false } as any)
        cy.adminCLI(`oc delete namespace ${VMI_NAMESPACE} --wait=false`, { failOnNonZeroExit: false } as any)

        // Delete HyperConverged CR (leave CNV operator installed to avoid slow reinstall)
        cy.adminCLI('oc delete hyperconverged kubevirt-hyperconverged -n openshift-cnv --wait=false', { failOnNonZeroExit: false } as any)

        // Delete FlowCollector if not skipping NetObserv install
        if (`${Cypress.env('SKIP_NOO_INSTALL')}` !== 'true') {
            Operator.deleteFlowCollector()
        }

        cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
    })
})
