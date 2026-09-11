import { netflowPage } from "@views/netflow-page"
import { Operator } from "@views/netobserv"

const CLIENT_NS = "test-client-56222"
const SERVER_NS = "test-server-56222"
var patch = [{
    "op": "$op",
    "path": "/spec/consolePlugin/quickFilters",
    "value": [
        {
            "default": true,
            "filter": {
                "dst_namespace": CLIENT_NS,
                "src_namespace": SERVER_NS
            },
            "name": "Test NS"
        }
    ]
}]

describe('(OCP-56222) Quick Filters test', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
        cy.uiLogin(Cypress.env('LOGIN_IDP'), Cypress.env('LOGIN_USERNAME'), Cypress.env('LOGIN_PASSWORD'))

        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector()

        // create test server and client pods
        cy.adminCLI('oc apply -f cypress/fixtures/test-server-client.yaml')

        // Wait for pods to be created
        cy.wait(10000)

        // Wait for pods to be ready
        cy.adminCLI('oc wait --for=condition=Ready pod -l app=nginx -n test-server-56222 --timeout=120s', { timeout: 140000 })
        cy.adminCLI('oc wait --for=condition=Ready pod -n test-client-56222 client --timeout=120s', { timeout: 140000 })
    })

    beforeEach('any netflow table test', function () {
        netflowPage.visit()
        cy.get('#tabs-container').contains('Traffic flows').click()
        cy.byTestID("table-composable").should('exist')
    })


    it("(OCP-56222, memodi) should verify quick filters add", function () {
        const addQuickFilterPatch = JSON.stringify(patch).replace('$op', 'add')
        cy.adminCLI(`oc patch flowcollector/cluster --type json -p \'${addQuickFilterPatch}\'`)
        // Wait for FC reconciliation and plugin to reload with updated config
        cy.adminCLI(`oc wait --for=condition=Ready flowcollector/cluster --timeout=180s`, { timeout: 200000 })
        cy.adminCLI(`oc rollout status deployment/netobserv-plugin -n netobserv --timeout=120s`, {
            failOnNonZeroExit: false, timeout: 140000
        })
        cy.visit('/netflow-traffic')
        cy.get('#tabs-container').contains('Traffic flows').click()
        cy.byTestID("table-composable").should('exist')
        cy.contains("Quick filters", { timeout: 30000 }).should('be.visible').click()
        cy.get('#quick-filters-dropdown').should('be.visible').within(() => {
            cy.contains("Test NS").should('exist')
            cy.contains('label', "Test NS").find('input[type="checkbox"]').should('exist').click()
        })

        // verify source and destination NS are test-server and test-client respectively
        cy.get('[data-test-td-column-id=SrcK8S_Namespace]').each((td) => {
            expect(td).to.contain(SERVER_NS)
        })
        cy.get('[data-test-td-column-id=DstK8S_Namespace]').each((td) => {
            expect(td).to.contain(CLIENT_NS)
        })

        cy.get('#quick-filters-dropdown')
            .contains('label', "Test NS")
            .find('input[type="checkbox"]')
            .should('exist')
            .click()
        cy.get('#filters').should('not.exist')
    })

    it("(OCP-56222, memodi) should verify quick filters remove", function () {
        const addQuickFilterPatch = JSON.stringify(patch).replace('$op', 'remove')
        cy.adminCLI(`oc patch flowcollector/cluster --type json -p \'${addQuickFilterPatch}\'`)
        // Wait for FC reconciliation and plugin to reload with updated config
        cy.adminCLI(`oc wait --for=condition=Ready flowcollector/cluster --timeout=180s`, { timeout: 200000 })
        cy.adminCLI(`oc rollout status deployment/netobserv-plugin -n netobserv --timeout=120s`, {
            failOnNonZeroExit: false, timeout: 140000
        })
        cy.visit('/netflow-traffic')
        cy.get('#tabs-container').contains('Traffic flows').click()
        cy.byTestID("table-composable").should('exist')
        cy.contains("Quick filters").should('exist').click()
        cy.get('#quick-filters-dropdown label').should('exist').each((ele, index, $list) => {
            cy.wrap(ele).should('not.contain', "Test NS")
        })
    })

    afterEach("test", function () {
        netflowPage.resetClearFilters()
    })

    after("all tests", function () {
        cy.adminCLI('oc delete -f cypress/fixtures/test-server-client.yaml --ignore-not-found')
        cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
    })
})
