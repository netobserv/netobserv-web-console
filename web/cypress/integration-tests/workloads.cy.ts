import { Operator } from "@views/netobserv"

const pagesToVisit = ["/k8s/ns/netobserv/core~v1~Pod",
    "/k8s/ns/netobserv/apps~v1~Deployment",
    "/k8s/ns/openshift-dns/daemonsets",
    "/k8s/ns/netobserv/apps~v1~ReplicaSet",
]

describe('(OCP-70972) Netflow traffic pages on workloads', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.env(['LOGIN_IDP', 'LOGIN_USERNAME', 'LOGIN_PASSWORD']).then(({ LOGIN_IDP, LOGIN_USERNAME, LOGIN_PASSWORD }) => {
            cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${LOGIN_USERNAME}`)
            cy.uiLogin(LOGIN_IDP, LOGIN_USERNAME, LOGIN_PASSWORD)
        })

        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector()
    })

    it('(OCP-70972, memodi), netflow traffic pages should appear on workloads', { tags: ["@smoke"] }, function () {
        pagesToVisit.forEach((page) => {
            cy.clearNetobservLocalStorage()
            cy.visitNetflowTrafficTab(page)
        })
    })
    after("after all tests", function () {
        cy.env(['LOGIN_USERNAME']).then(({ LOGIN_USERNAME }) => {
            cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${LOGIN_USERNAME}`)
        })
    })

})
