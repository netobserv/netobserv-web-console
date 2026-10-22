import { netflowPage } from "@views/netflow-page";
import { Operator } from "@views/netobserv";

describe.skip('NetObserv developer view', { tags: ['Network_Observability'] }, function () {
    let user1 = '', user2 = '', user3 = '', user1Passwd = '', user2Passwd = '', user3Passwd = '', idp = '';

    before('any test', function () {
        cy.env(['LOGIN_USERS', 'LOGIN_IDP']).then(({ LOGIN_USERS, LOGIN_IDP }) => {
            const loginUsers = LOGIN_USERS.split(',');
            if (loginUsers.length < 5) {
                this.skip();
            }
            [user1, user1Passwd] = loginUsers[2].split(':');
            [user2, user2Passwd] = loginUsers[3].split(':');
            [user3, user3Passwd] = loginUsers[4].split(':');
            idp = LOGIN_IDP;
            cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${user1}`)
            cy.uiLogin(idp, user1, user1Passwd)
            
            Operator.install()
            cy.checkStorageClass(this)
            Operator.createFlowcollector()
        })
    })

    it("(OCP-75874, aramesha) should verify developer view - Loki DataSource", function () {
        // verify Netflow traffic tab
        netflowPage.visit()
        cy.checkNetflowTraffic()
    })

    it("(OCP-75874, OCP-73876 aramesha) should verify developer view - Prom DataSource", function () {
        // Deploy flowcollector with Loki disabled
        Operator.createFlowcollector("LokiDisabled")

        // Provide user2 and user3 with netobserv-metrics-reader role to view prom queries
        cy.adminCLI(`oc adm policy add-cluster-role-to-user netobserv-metrics-reader ${user2}`)
        cy.adminCLI(`oc adm policy add-cluster-role-to-user netobserv-metrics-reader ${user3}`)

        // Deploy client server manifests logged in as user2
        cy.cliLogin(`${user2}`, `${user2Passwd}`)
        cy.adminCLI(`oc create -f cypress/fixtures/testuser-server-client.yaml`)

        // Logout from console as user1 and login as user2
        cy.uiLogout().then(() => {
            cy.visit(Cypress.config('baseUrl') || '/')
        })
        cy.uiLogin(idp, user2, user2Passwd)

        // Verify Netflow traffic tab Developer view as user2
        netflowPage.visit(false)
        cy.checkNetflowTraffic("Disabled")

        // Add view role for test-server project to user3
        cy.adminCLI(`oc adm policy add-role-to-user view ${user3} -n test-server`)

        // Logout from console as user2 and login as user3
        cy.uiLogout().then(() => {
            cy.visit(Cypress.config('baseUrl') || '/')
        })
        cy.uiLogin(idp, user3, user3Passwd)

        // verify Netflow traffic page as user3
        netflowPage.visit(false)
        cy.checkNetflowTraffic("Disabled")

        cy.adminCLI(`oc adm policy remove-cluster-role-from-user netobserv-metrics-reader ${user2}`)
        cy.adminCLI(`oc adm policy remove-cluster-role-from-user netobserv-metrics-reader ${user3}`)
    })

    after("all tests", function () {
        cy.adminCLI(`oc login -u system:admin`)
        cy.adminCLI(`oc delete flowcollector cluster`)
        cy.adminCLI(`oc delete project test-server --ignore-not-found`)
        cy.adminCLI(`oc delete project test-client --ignore-not-found`)
        cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${user1}`)
    })
})
