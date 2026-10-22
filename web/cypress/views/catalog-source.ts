export const catalogSources = {
    navToOperatorHubSources: () => {
        cy.visit('k8s/cluster/config.openshift.io~v1~OperatorHub/cluster/sources')
        cy.get('#yaml-create').should('exist')
    },
    getOCPVersion: () => {
        cy.env(['KUBECONFIG_PATH']).then(({ KUBECONFIG_PATH }) => {
            const cmd = `oc version -o json --kubeconfig=${KUBECONFIG_PATH} | grep openshiftVersion | awk -F'"' '{print $4}' | awk -F'.' '{print $1"."$2}' `
            cy.exec(cmd).then(result => {
                expect(result.stderr).to.be.empty
                cy.wrap(result.stdout).as('VERSION')
            })
        })
    },
    createCustomCatalog: (image: any, catalogName: string, displayName: string) => {
        catalogSources.navToOperatorHubSources()
        // create custom catalog only if its not already present
        cy.env(['KUBECONFIG_PATH']).then(({ KUBECONFIG_PATH }) => {
            const cmd = `oc get -n openshift-marketplace catalogsource ${catalogName} --kubeconfig=${KUBECONFIG_PATH} 2>&1`
            cy.exec(cmd, { failOnNonZeroExit: false }).then(result => {
                cy.wrap(result.stdout).then((out) => {
                    if (out.includes("NotFound")) {
                        cy.byTestID('item-create').should('exist').click()
                        cy.byTestID('catalog-source-name').type(catalogName)
                        cy.get('#catalog-source-display-name').type(displayName)
                        cy.get('#catalog-source-publisher').type('ocp-qe')
                        cy.byTestID('catalog-source-image').type(image)
                        cy.byTestID('save-changes').click()
                    }
                })
            })
            cy.byTestID(catalogName).should('exist')
            cy.checkCommandResult(`oc get catalogsource ${catalogName} -n openshift-marketplace -o jsonpath='{.status.connectionState.lastObservedState}'`, 'READY', { retries: 6, interval: 10000 });
        })
    }
}
