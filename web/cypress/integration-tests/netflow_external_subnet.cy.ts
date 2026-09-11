import { colSelectors, filterSelectors, netflowPage } from "@views/netflow-page"
import { Operator } from "@views/netobserv"

describe('(OCP-67615, OCP-72874) Return external traffic and custom subnet labels test', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
        cy.uiLogin(Cypress.env('LOGIN_IDP'), Cypress.env('LOGIN_USERNAME'), Cypress.env('LOGIN_PASSWORD'))

        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector("SubnetLabels")

        // deploy test pod and wait for it to complete (generates traffic to external IP)
        cy.adminCLI('oc create -f cypress/fixtures/test-pod.yaml')
        cy.adminCLI('oc wait --for=jsonpath=\'{.status.phase}\'=Succeeded pod/test -n netobserv-test-67615 --timeout=180s', { timeout: 200000 })
    })

    it("(OCP-67615, aramesha) External traffic and custom subnet label", function () {
        netflowPage.visit()
        cy.get('#tabs-container').contains('Traffic flows').click()
        netflowPage.waitForTableRows(1)

        // enable SrcSubnetLabel and DstSubnetLabel columns
        cy.selectAndVerifyColumns([
            colSelectors.srcSubnetLabel,
            colSelectors.dstSubnetLabel
        ])

        // filter on SrcSubnetLabel Pods and DstIP 52.200.142.250
        cy.get(filterSelectors.filterInput).type("src_subnet_label=Pods" + '{enter}')
        cy.get(filterSelectors.filterInput).type("dst_address=52.200.142.250" + '{enter}')
        // Flows may lag behind pod Succeeded; refresh until the filtered table has rows.
        // Do not assert an exact row count: the test pod may emit multiple matching flows.
        netflowPage.waitForTableRows(1)

        // validate SrcSubnetLabel=Pods and DstCustomLabel=testcustomlabel for custom subnet labels
        cy.get('[data-test-td-column-id=SrcSubnetLabel]').each((td) => {
            expect(td).attr("data-test-td-value").to.contain('Pods')
        })
        cy.get('[data-test-td-column-id=DstSubnetLabel]').each((td) => {
            expect(td).to.contain('testcustomlabel')
        })

        // validate bidirectional flows (at least the request + reply pair)
        cy.get('#match-1-dropdown').click().get(filterSelectors.biDirectional).click()
        netflowPage.waitForTableRows(2)

        netflowPage.clearAllFilters()
    })

    afterEach("test", function () {
        netflowPage.resetClearFilters()
    })

    after("all tests", function () {
        cy.adminCLI('oc delete -f cypress/fixtures/test-pod.yaml --ignore-not-found')
        Operator.deleteFlowCollector()
        cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
    })
})
