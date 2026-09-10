import "@views/netobserv"
import { Operator } from "@views/netobserv"

const VMI_NAMESPACE = "test-vm"
const VMI_NAME = "test-vm"

describe('(OCP-90529) Network Traffic Tab on VMI Page', { tags: ['Network_Observability'] }, function () {

    before('setup', function () {
        // Add cluster admin role and login first (like other tests)
        cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
        cy.uiLogin(Cypress.env('LOGIN_IDP'), Cypress.env('LOGIN_USERNAME'), Cypress.env('LOGIN_PASSWORD'))
        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector()

        // Setup KubeVirt operator
        cy.adminCLI(`oc create namespace openshift-cnv`, { failOnNonZeroExit: false } as any)
        cy.adminCLI(`oc apply -f ./cypress/fixtures/vmi/kubevirt-operator-group.yaml`)
        cy.adminCLI(`oc apply -f ./cypress/fixtures/vmi/kubevirt-subscription.yaml`)

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
            { retries: 30, interval: 20000 }
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
            { retries: 30, interval: 20000 }
        )

        // Wait for KubeVirt CR to be created by HyperConverged operator
        cy.checkCommandResult(
            "oc get kubevirt kubevirt-kubevirt-hyperconverged -n openshift-cnv -o jsonpath='{.metadata.name}'",
            'kubevirt-kubevirt-hyperconverged',
            { retries: 30, interval: 10000 }
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
    })

    it('(OCP-90529, kapjain) Navigate from Search to VMI and verify Network Traffic tab', function () {
        // Navigate to search page with VirtualMachineInstance resource pre-selected
        cy.visit(`/search/ns/${VMI_NAMESPACE}?kind=kubevirt.io~v1~VirtualMachineInstance`)
        cy.wait(3000)

        // Wait for VMI detail page to load
        cy.get('#content', { timeout: 30000 }).should('exist')
        cy.wait(2000)

        // Click on VM name to navigate to VMI detail page
        cy.get('tbody tr', { timeout: 30000 }).contains(VMI_NAME).click()
        cy.wait(2000)
        // Check if Network Traffic tab is present and click it
        cy.get('[data-test-id="horizontal-link-Network Traffic"]', { timeout: 60000 })
          .should('be.visible')
          .then(($tab) => {
            cy.wrap($tab).click()
          })

        // Verify filter with vm name
        cy.get('[data-test="filter-toolbar-chips"]', { timeout: 30000 }).should('contain', 'test-vm')
    })

    it('(OCP-90529, kapjain) Navigate from Virtualization VM page and verify Network Traffic on virt-launcher Pod', function () {
        // Navigate to the VirtualMachine detail page via Virtualization
        cy.visit(`/k8s/ns/${VMI_NAMESPACE}/kubevirt.io~v1~VirtualMachine/${VMI_NAME}`)

        // Wait for page to load
        cy.get('#content', { timeout: 30000 }).should('exist')
        cy.wait(1000)

        // Dismiss welcome modal if present
        cy.dismissWelcomeModal()
        cy.wait(500)

        // Navigate to virt-launcher pod
        cy.contains('a', 'virt-launcher', { timeout: 30000 }).click({ force: true })

        // Check if Network Traffic tab is present and click it
        cy.get('[data-test-id="horizontal-link-Network Traffic"]', { timeout: 60000 })
          .should('be.visible')
          .then(($tab) => {
            cy.wrap($tab).click({ force: true })
          })

        // Verify filter with vm name
        cy.get('[data-test="filter-toolbar-chips"]', { timeout: 30000 }).should('contain', 'test-vm')
    })

    after("cleanup", function () {
        // Delete test VM and namespace
        cy.adminCLI(`oc delete vm ${VMI_NAME} -n ${VMI_NAMESPACE} --grace-period=30 --wait=false`, { failOnNonZeroExit: false } as any)
        cy.adminCLI(`oc delete namespace ${VMI_NAMESPACE} --grace-period=90`, { failOnNonZeroExit: false } as any)

        // Delete HyperConverged CR and related resources (leave operators installed to avoid slow reinstall)
        cy.adminCLI('oc delete hyperconverged kubevirt-hyperconverged -n openshift-cnv --wait=false', { failOnNonZeroExit: false } as any)
        cy.adminCLI('oc delete cdi cdi-kubevirt-hyperconverged -n openshift-cnv --wait=false', { failOnNonZeroExit: false } as any)
        cy.adminCLI('oc delete configmap cdi-apiserver-signer-bundle -n openshift-cnv --wait=false', { failOnNonZeroExit: false } as any)
    })
})
