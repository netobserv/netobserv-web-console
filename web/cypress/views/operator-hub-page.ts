import { listPage } from "@views/list-page";

const sourceActions = (name: string, action: string) => {
  cy.get('form[data-test-group-name="source"]', { timeout: 60000 })
    .then($source => {
      const hasMoreButton = $source.find('button:contains("more")').length > 0;
      if (hasMoreButton) {
        cy.wrap($source).find('button').contains('more').click();
      }
      if (action === 'check') {
        cy.wrap($source).find(`[data-test="source-${name}"] input[type="checkbox"]`).check()
      } else if (action === 'uncheck') {
        cy.wrap($source).find(`[data-test="source-${name}"] input[type="checkbox"]`).uncheck()
      } else {
        cy.wrap($source).find(`[data-test="source-${name}"]`);
      }
    })
};
export const installedOperators = {
  checkOperatorStatus: (csvName: string, csvStatus: string) => {
    cy.get('thead', { timeout: 60000 });
    cy.get('input[data-test="name-filter-input"]')
      .clear()
      .type(`${csvName}`)
      .then(() => {
        cy.get('input[data-test="name-filter-input"]').should('have.value', `${csvName}`);
      });
    cy.get(`[data-test-operator-row*="${csvName}"]`, { timeout: 120000 })
      .parents('tr')
      .children()
      .contains(`${csvStatus}`, { timeout: 120000 });
  },
  clickCSVName: (csvName: string) => {
    cy.get(`a[data-test-operator-row*="${csvName}"]`).click();
  },
  filterByName: (operatorName: string) => {
    cy.get('input[data-test="name-filter-input"]')
      .clear()
      .type(operatorName)
  }
}

export const operatorHubPage = {
  getAllTileLabels: () => {
    return cy.get('.co-catalog-tile').find('[role="status"]')
  },
  checkCustomCatalog: (name: string) => {
    sourceActions(name, 'view');
  },
  checkSourceCheckBox: (name: string) => {
    sourceActions(name, 'check');
  },
  uncheckSourceCheckBox: (name: string) => {
    sourceActions(name, 'uncheck');
  },
  checkInstallStateCheckBox: (state: string) => {
    cy.get('form[data-test-group-name="installState"]')
      .find(`[data-test="installState-${state}"]`)
      .find('[type="checkbox"]')
      .check();
  },
  checkInfraFeaturesCheckbox: (name: string) => {
    cy.get('form[data-test-group-name="infraFeatures"]')
      .then($btn => {
        const hasMoreButton = $btn.find('button:contains("more")').length > 0;
        if (hasMoreButton) {
          cy.wrap($btn).find('button').contains('more').click();
        }
        cy.wrap($btn).find(`[data-test="infraFeatures-${name}"] input[type="checkbox"]`).check();
      })
  },
  clickOperatorTile: (operatorName: string) => {
    cy.get(`button[id*="${operatorName}"]`).first().click({ force: true });
  },
  clickOperatorInstall: () => {
    cy.get('[data-test="install-operator"]').click({ force: true });
  },
  filter: (name: string) => {
    cy.get('input[type="text"]')
      .clear()
      .type(name);
  },
  // pass operator name that matches the Title on UI
  install: (name: string, csName: string, metrics: boolean = false) => {
    cy.visit(`/operatorhub/subscribe?pkg=${name}&catalog=${csName}&catalogNamespace=openshift-marketplace&targetNamespace=undefined`);
    // ignore warning pop up for community operators
    cy.get('body').then(body => {
      if (body.find('.modal-content').length) {
        cy.byTestID('confirm-action').click()
      }
    })
    // cy.get('[data-test-id="operator-install-btn"]').should('exist').click({ force: true });
    if (metrics) {
      cy.get('#enable-monitoring-checkbox').should('exist').check()
    }
    cy.byTestID('Enable-radio-input').click()
    cy.byTestID('install-operator').trigger('click')
    cy.get('#operator-install-page').should('exist')
    // Navigate to installed operators page
    cy.visit('/k8s/all-namespaces/operators.coreos.com~v1alpha1~ClusterServiceVersion');
    cy.contains('Installed Operators').should('exist');

    cy.contains(name).parents('tr').within(() => {
      cy.byTestID("status-text", { timeout: 180000 }).should('have.text', "Succeeded")
    })
  },
  installOperator: (operatorName: string, csName: string, installNamespace?: boolean) => {
    cy.visit(`/operatorhub/subscribe?pkg=${operatorName}&catalog=${csName}&catalogNamespace=openshift-marketplace&targetNamespace=undefined`);
    cy.get('body').should('be.visible');
    if (installNamespace) {
      cy.get('[data-test="A specific namespace on the cluster-radio-input"]').click();
      // Click element if it exists (with retry)
      cy.get('input[data-test="Select a Namespace-radio-input"]', { timeout: 10000 }).then(($els) => {
        if ($els.length) {
          cy.wrap($els.first()).click();
        }
      });
      cy.get('button#dropdown-selectbox').click();
      cy.contains('span', `${installNamespace}`).click();
    }
    cy.get('[data-test="install-operator"]').click();
  },
  installOperatorWithRecommendNamespace: (operatorName: string, csName: string) => {
    cy.visit(`/operatorhub/subscribe?pkg=${operatorName}&catalog=${csName}&catalogNamespace=openshift-marketplace&targetNamespace=undefined`);
    cy.get('body').should('be.visible');
    cy.get('input#operator-namespace-recommended').click();
    if (Cypress.$("#enable-monitoring-checkbox").length > 0) {
      cy.get('input#enable-monitoring-checkbox').click();
    };
    cy.get('[data-test="install-operator"]').click();
  },
  removeOperator: (csvName: string) => {
    listPage.rows.clickKebabAction(`${csvName}`, "Uninstall Operator");
    cy.get('#confirm-action').click();
    cy.get(`[data-test-operator-row*="${csvName}"]`).should('not.exist');
  },
  checkDeprecationIcon: () => {
    return cy.get('svg[class*="yellow-exclamation-icon"]')
  },
  checkDeprecationLabel: (criteria: string) => {
    cy.get('span').contains('Deprecated').should(criteria);
  },
  checkDeprecationPkgMsg: (message: string) => {
    cy.get('[data-test="deprecated-operator-warning-package"]').contains(message).should('exist');
  },
  checkDeprecationChannelMsg: (message: string) => {
    cy.get('[data-test="deprecated-operator-warning-channel"]').contains(message).should('exist');
  },
  checkDeprecationVersionMsg: (message: string) => {
    cy.get('[data-test="deprecated-operator-warning-version"]').contains(message).should('exist');
  },
  checkWarningInfo: (warningInfo: string) => {
    cy.get('[class*="alert__title"]').should('contain', `${warningInfo}`);
  },
  checkSTSWarningOnOperator: (operatorName: string, catalogSource: string, warningInfo: string, installNamespace: boolean, clusterType: string) => {
    //Check STS/WIFI warning message on operator details and installation page
    cy.visit(`/catalog/ns/default?keyword=${operatorName}&catalogType=operator&source=["${catalogSource}"]`);
    cy.get('.co-catalog-tile').click();
    operatorHubPage.checkWarningInfo(warningInfo);
    cy.get('a[data-test="catalog-details-modal-cta"]').click({ force: true });
    operatorHubPage.checkWarningInfo(warningInfo);
    // Check manual installation Mode is subscribe by default
    cy.get('input[value="Manual"]').should('have.attr', 'data-checked-state', 'true');
    // Check&Input specific inputs based on cluster type
    switch (clusterType) {
      case 'aws':
        cy.get('input[aria-label="role ARN"]').clear().type('testrolearn');
        break;
      case 'azure':
        cy.get('input[aria-label="Azure Client ID"]').clear().type('testazureclientid');
        cy.get('input[aria-label="Azure Tenant ID"]').clear().type('testazuretenantid');
        cy.get('input[aria-label="Azure Subscription ID"]').clear().type('testazuresubscriptionid');
        break;
      case 'gcp':
        cy.get('input[aria-label="GCP Project Number"]').clear().type('testgcpprojectid');
        cy.get('input[aria-label="GCP Pool ID"]').clear().type('testgcppoolid');
        cy.get('input[aria-label="GCP Provider ID"]').clear().type('testgcpproviderid');
        cy.get('input[aria-label="GCP Service Account Email"]').clear().type('testgcpemail');
        break;
      default:
        break;
    }
    // Install the operator into the selected namespace
    if (installNamespace) {
      cy.get('[data-test="A specific namespace on the cluster-radio-input"]').click();
      cy.get('button#dropdown-selectbox').click();
      cy.contains('span', `${installNamespace}`).click();
    }
    cy.get('[data-test="install-operator"]').click();
    cy.contains('Approve', { timeout: 240000 }).click();
  },
  cancel: () => {
    cy.get('button').contains('Cancel').click({ force: true });
  },
  checkRecommenedMonitoring: (packageName: string, catalogSource: string, operatorName: string, enableStatus: string) => {
    cy.visit(`/operatorhub/subscribe?pkg=${packageName}&catalog=${catalogSource}&catalogNamespace=openshift-marketplace&targetNamespace=undefined`);
    cy.contains(`${operatorName}`, { timeout: 30000 }).should('exist');
    cy.get('input#enable-monitoring-checkbox').should('have.attr', 'data-checked-state', `${enableStatus}`);
  }
};

export const operatorHubModal = {
  clickInstall: () => {
    cy.byLegacyTestID('operator-install-btn').click({ force: true });
  },
  selectChannel: (channel: string) => {
    cy.get('h5').contains('Channel').parent('div').within(() => {
      // click on button instead of div
      cy.get('button[data-test="operator-channel-select-toggle"]').click({ force: true });
    });
    cy.get(`li[data-test="channel-option-${channel}"]`).should('be.visible');
    cy.get(`button[id="${channel}"]`).click({ force: true });
  },
  selectVersion: (version: string) => {
    cy.get('h5').contains('Version').parent('div').within(() => {
      cy.get('button[data-test="operator-version-select-toggle"]').click({ force: true });
    });
    cy.get(`li[data-test*="${version}"]`).should('be.visible');
    cy.get(`button[id="${version}"]`).click({ force: true });
  },
};

export namespace OperatorHubSelector {
  export const SOURCE_MAP = new Map([
    ["certified", "Certified"],
    ["community", "Community"],
    ["red-hat", "Red Hat"],
    ["marketplace", "Marketplace"],
    ["custom-auto-source", "Custom-Auto-Source"]
  ]);
  export const CUSTOM_CATALOG = "custom-auto-source"
}

export const Operand = {
  switchToFormView: () => {
    cy.get('#form').scrollIntoView().click();
  },
  switchToYAMLView: () => {
    cy.get('#yaml').scrollIntoView().click();
  },
  submitCreation: () => {
    cy.byTestID("create-dynamic-form").scrollIntoView().click();
  },
  expandSpec: (id: string) => {
    cy.get(`#${id}`)
      .scrollIntoView()
      .should('have.attr', 'aria-expanded', 'false')
      .click();
  },
  collapseSpec: (id: string) => {
    cy.get(`#${id}`)
      .scrollIntoView()
      .should('have.attr', 'aria-expanded', 'true')
      .click();
  },
  clickAddNodeConfigAdvanced: () => {
    cy.get('#root_spec_nodeConfigAdvanced_add-btn')
      .scrollIntoView()
      .click();
    // this will expand 'Advanced configuration' where we set all affinities
    cy.get('#root_spec_nodeConfigAdvanced_accordion-content')
      .within(() => {
        cy.get('button[id*="expandable-section-toggle-"]')
          .first()
          .click()
      })
  },
  setRandomType: () => {
    cy.get('#root_spec_nodeConfigAdvanced_0_type').click();
    cy.get('#all-link').click()
  },
  expandNodeConfigAdvanced: () => {
    Operand.expandSpec('root_spec_nodeConfigAdvanced_accordion-toggle')
  },
  expandNodeAffinity: () => {
    Operand.expandSpec('root_spec_nodeConfigAdvanced_0_nodeAffinity_accordion-toggle')
  },
  expandPodAffinity: () => {
    Operand.expandSpec('root_spec_nodeConfigAdvanced_0_podAffinity_accordion-toggle')
  },
  expandPodAntiAffinity: () => {
    Operand.expandSpec('root_spec_nodeConfigAdvanced_0_podAntiAffinity_accordion-toggle')
  },
  collapseNodeAffinity: () => {
    Operand.collapseSpec('root_spec_nodeConfigAdvanced_0_nodeAffinity_accordion-toggle')
  },
  collapsePodAffinity: () => {
    Operand.collapseSpec('root_spec_nodeConfigAdvanced_0_podAffinity_accordion-toggle')
  },
  collapsePodAntiAffinity: () => {
    Operand.collapseSpec('root_spec_nodeConfigAdvanced_0_podAntiAffinity_accordion-toggle')
  },
  nodeAffinityAddRequired: (key: string, operator: string, value: string) => {
    cy.get('#root_spec_nodeConfigAdvanced_0_nodeAffinity_accordion-content')
      .within(() => {
        cy.byButtonText('Add required').click();
      })
    cy.get('.co-affinity-term')
      .last()
      .within(() => {
        cy.byButtonText('Add expression').click();
        Operand.addExpression(key, operator, value);
      })
  },
  nodeAffinityAddPreferred: (weight: string, key: string, operator: string, value: string) => {
    cy.get('#root_spec_nodeConfigAdvanced_0_nodeAffinity_accordion-content')
      .within(() => {
        cy.byButtonText('Add preferred').click()
      });
    cy.get('.co-affinity-term')
      .last()
      .within(() => {
        Operand.setWeight(weight);
        cy.byButtonText('Add expression').click();
        Operand.addExpression(key, operator, value);
      })
  },
  podAffinityAddRequired: (tpkey: string, key: string, operator: string, value: string) => {
    cy.get('#root_spec_nodeConfigAdvanced_0_podAffinity_accordion-content')
      .within(() => {
        cy.byButtonText('Add required').click()
      })
    cy.get('.co-affinity-term')
      .last()
      .within(() => {
        Operand.setTopologyKey(tpkey);
        cy.byButtonText('Add expression').click();
        Operand.addExpression(key, operator, value);
      })
  },
  podAntiAffinityAddPreferred: (weight: string, tpkey: string, key: string, operator: string, value: string) => {
    cy.get('#root_spec_nodeConfigAdvanced_0_podAntiAffinity_accordion-content')
      .within(() => {
        cy.byButtonText('Add preferred').click()
      })
    cy.get('.co-affinity-term')
      .last()
      .within(() => {
        Operand.setWeight(weight);
        Operand.setTopologyKey(tpkey);
        cy.byButtonText('Add expression').click();
        Operand.addExpression(key, operator, value);
      })
  },
  setWeight: (weight: string) => {
    cy.get('.co-affinity-term__weight-input')
      .last()
      .within(() => {
        cy.get('input').clear().type(weight)
      })
  },
  setTopologyKey: (key: string) => {
    cy.get('#topology-undefined').last().clear().type(key);
  },
  addExpression: (key: string, operator: string, value?: string) => {
    cy.get('.key-operator-value__name-field')
      .last()
      .within(() => {
        cy.get('input').clear().type(key)
      })
    cy.get('.key-operator-value__operator-field')
      .last()
      .within(() => {
        cy.byLegacyTestID('dropdown-button').click();
        cy.get(`button[data-test-dropdown-menu="${operator}"]`).click();
      })
    if (value) {
      cy.get('.key-operator-value__value-field')
        .last()
        .within(() => {
          cy.get('input').clear().type(value)
        })
    }
  }
}
