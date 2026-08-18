import { Operator } from "@views/netobserv"
import { netflowPage, colSelectors } from "@views/netflow-page"

describe('(OCP-67615, OCP-72874 Network_Observability) Return external traffic and custom subnet labels test', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
        cy.uiLogin(Cypress.env('LOGIN_IDP'), Cypress.env('LOGIN_USERNAME'), Cypress.env('LOGIN_PASSWORD'))

        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector("SubnetLabels")

        // deploy test pod and wait for it to complete (generates traffic to external IP)
        cy.adminCLI('oc create -f cypress/fixtures/test-pod.yaml')
        cy.adminCLI('oc wait --for=jsonpath=\'{.status.phase}\'=Succeeded pod/test -n netobserv-test-67615 --timeout=120s')
    })

    it("(OCP-67615, aramesha, Network_Observability) External traffic and custom subnet label", function () {
        netflowPage.visit()
        cy.get('#tabs-container').contains('Traffic flows').click()
        cy.byTestID("table-composable").should('exist')

        // enable SrcSubnetLabel and DstSubnetLabel columns
        cy.selectAndVerifyColumns([
            colSelectors.srcSubnetLabel,
            colSelectors.dstSubnetLabel
        ])

        // filter on SrcSubnetLabel Pods and DstIP 52.200.142.250
        cy.byTestID("column-filter-toggle").click().get('.pf-c-dropdown__menu').should('be.visible')
        cy.byTestID('src_subnet_label').click()
        cy.get('#autocomplete-search').type('Pods' + '{enter}')

        cy.byTestID("column-filter-toggle").click().get('.pf-c-dropdown__menu').should('be.visible')
        cy.byTestID('group-1-toggle').click().should('be.visible')
        cy.byTestID('dst_address').click()
        cy.get('#search').type('52.200.142.250' + '{enter}')

        netflowPage.waitForLokiQuery()

        // validate rows count=1, DstNamespace and DstName is n/a for external traffic
        cy.byTestID('table-composable').each((td) => {
            expect(td).attr("data-test-rows-count").to.contain(1)
        })

        // validate SrcSubnetLabel=Pods and DstSustomLabel=testcustomlabel for custom subnet labels
        cy.get('[data-test-td-column-id=SrcSubnetLabel]').each((td) => {
            expect(td).attr("data-test-td-value").to.contain('Pods')
        })
        cy.get('[data-test-td-column-id=DstSubnetLabel]').each((td) => {
            expect(td).to.contain('testcustomlabel')
        })

        // click on Back-on-Forth button
        cy.byTestID("back-and-forth-button").should('exist').click()

        // validate rows count=2
        cy.byTestID('table-composable').each((td) => {
            expect(td).attr("data-test-rows-count").to.contain(2)
        })

        // click on filters so that pop-up goes away
        cy.byTestID("column-filter-toggle").click().get('.pf-c-dropdown__menu').should('be.visible')
        cy.byTestID('group-0-toggle').click().should('be.visible')
        cy.byTestID('src_namespace').click()

        netflowPage.clearAllFilters()
    })

    afterEach("each test", function () {
        netflowPage.resetClearFilters()
    })

    after("all tests", function () {
        cy.adminCLI('oc delete -f cypress/fixtures/test-pod.yaml --ignore-not-found')
        Operator.deleteFlowCollector()
        cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
    })
})
