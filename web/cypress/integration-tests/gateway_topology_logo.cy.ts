import { netflowPage, topologyPage, topologySelectors } from "@views/netflow-page"
import { Operator } from "@views/netobserv"
import { verifyResourceSVGLogo } from "@views/netobserv-logo"

describe("(OCP-87215) Gateway API owner metadata", { tags: ['Network_Observability'] }, function () {
    const gatewayNS = 'netobserv-gateway-test'
    const gatewayName = 'test-gateway-owner'
    before('any test', function () {
        cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
        cy.uiLogin(Cypress.env('LOGIN_IDP'), Cypress.env('LOGIN_USERNAME'), Cypress.env('LOGIN_PASSWORD'))

        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector("FlowRTT")

        cy.adminCLI('oc apply -f cypress/fixtures/gateway-api.yaml')

        // Wait for pods to be ready
        cy.wait(5000)
        cy.adminCLI('oc wait --for=condition=Ready pod -l app=traffic-generator -n netobserv-gateway-test --timeout=120s', { timeout: 140000 })
        cy.adminCLI('oc wait --for=condition=Ready pod -l app=echo-server -n netobserv-gateway-test --timeout=120s', { timeout: 140000 })
    })

    beforeEach("navigate to topology view", function () {
        topologyPage.setupWithNamespaceFilter(gatewayNS)
    })

    it("(OCP-87215, kapjain) Gateway owner logo", function () {
        topologyPage.selectScopeGroup("owner")
        topologyPage.isViewRendered()

        cy.get(topologySelectors.node, { timeout: 80000 }).should('have.length.greaterThan', 0)

        cy.byTestID('search-topology-element-input').should('exist').clear().type(gatewayName)

        verifyResourceSVGLogo('Gateway', gatewayName)
    })

    afterEach("test", function () {
        netflowPage.clearAllFilters()
    })

    after("all tests", function () {
        cy.adminCLI('oc delete -f cypress/fixtures/gateway-api.yaml --ignore-not-found', { failOnNonZeroExit: false, timeout: 120000 })
        Operator.deleteFlowCollector()
        cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
    })
})
