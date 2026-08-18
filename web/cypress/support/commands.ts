/* eslint-disable @typescript-eslint/no-namespace */

/// <reference types="cypress" />
// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
//
// declare global {
//   namespace Cypress {
//     interface Chainable {
//       login(email: string, password: string): Chainable<void>
//       drag(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       dismiss(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       visit(originalFn: CommandOriginalFn, url: string, options: Partial<VisitOptions>): Chainable<Element>
//     }
//   }
// }

import * as c from './const';
import { guidedTour } from '@views/tour';

Cypress.Commands.add('clearNetobservLocalStorage', () => {
  cy.window().then(win => {
    win.localStorage.removeItem('netobserv-plugin-settings')
  })
})

Cypress.Commands.add('openNetflowTrafficPage', (clearCache = true) => {
  if (clearCache) {
    //clear local storage to ensure to be in default view = overview
    cy.clearNetobservLocalStorage();
  }
  cy.visit(c.url);
  cy.get("#netflow-traffic-nav-item-link").click();
});

Cypress.Commands.add('showAdvancedOptions', () => {
  cy.get('#show-view-options-button')
    .then(function ($button) {
      if ($button.text() === 'Hide advanced options') {
        return;
      } else {
        cy.get('#show-view-options-button').click();
        cy.get('[data-test-id="view-options-toolbar"]').should('be.visible');
      }
    })
});

Cypress.Commands.add('showDisplayOptions', () => {
  cy.get('#display-dropdown-container').children().first()
    .then(function ($div) {
      if ($div.hasClass('pf-m-expanded')) {
        return;
      } else {
        cy.get('#display-dropdown-container').click();
      }
    })
});

Cypress.Commands.add('checkPanels', (panels = c.defaultPanelsCount) => {
  cy.get('#overview-flex').children().its('length').should('eq', panels);
});

Cypress.Commands.add('openPanelsModal', () => {
  cy.showAdvancedOptions();
  cy.get('#manage-overview-panels-button').click();
  cy.get('#overview-panels-modal').should('exist');
  cy.get('#overview-panels-modal').find('.pf-c-data-list__item-content').should('have.length', c.availablePanelsCount);
});

Cypress.Commands.add('checkColumns', (groups = c.defaultColumnGroupCount, cols = c.defaultColumnCount) => {
  if (groups === 0) {
    //Should not have nested columns
    cy.get('thead>tr').should('have.length', 1);

    //Should have correct number of columns
    cy.get('thead>tr').children().should('have.length', cols);
  } else {
    //Should have nested columns
    cy.get('#table-container').get('thead>tr').should('have.length', 2);

    //Should have correct number of groups (regrouping of several columns)
    cy.get('thead>tr').eq(0).children().should('have.length', groups);
    //Should have correct number of columns
    cy.get('thead>tr').eq(1).children().should('have.length', cols);
  }
});

Cypress.Commands.add('openColumnsModal', () => {
  cy.showAdvancedOptions();
  cy.get('#manage-columns-button').click();
  cy.get('#columns-modal').should('exist');
  cy.get('#columns-modal').find('.pf-c-data-list__item-content').should('have.length', c.availableColumnCount);
});

Cypress.Commands.add('selectPopupItems', (id, names) => {
  for (let i = 0; i < names.length; i++) {
    cy.get(id).get('.modal-body').contains(names[i])
      .closest('.pf-c-data-list__item-row').find('.pf-c-data-list__check').click();
  }
});

Cypress.Commands.add('checkPopupItems', (id, ids) => {
  for (let i = 0; i < ids.length; i++) {
    cy.get(id).find('.modal-body').find(`#${ids[i]}`).check();
  }
});

Cypress.Commands.add('sortColumn', (name) => {
  cy.get('thead').contains(name).click();
  cy.get('[aria-sort="ascending"]').should('have.length', 1);
  cy.get('[aria-sort="descending"]').should('have.length', 0);
  cy.get('thead').contains(name).click();
  cy.get('[aria-sort="ascending"]').should('have.length', 0);
  cy.get('[aria-sort="descending"]').should('have.length', 1);
});

Cypress.Commands.add('dropdownSelect', (id, name) => {
  cy.get(`#${id}`).click();
  cy.get('.pf-c-dropdown__menu').should('exist');
  cy.get('.pf-c-dropdown__menu').find(`#${name}`).click();
});

Cypress.Commands.add('checkContent', (topology) => {
  if (topology) {
    cy.get('[data-layer-id="default"]').children().its('length').should('be.gte', 5);
  } else {
    cy.get('#table-container').find('tr').its('length').should('be.gte', 5);
  }
});

Cypress.Commands.add('addFilter', (filter, value, topology) => {
  cy.get('#column-filter-toggle').click();
  cy.get('.pf-c-accordion__expanded-content-body').find(`#${filter}`).click();
  cy.get('.pf-c-accordion__expanded-content-body').should('not.exist');
  cy.get('#column-filter-dropdown').parent().children().eq(1).type(`${value}{enter}`);
  cy.checkContent(topology);
});

Cypress.Commands.add('changeQueryOption', (name, topology) => {
  cy.get('#filter-toolbar-search-filters').contains('Query options').click();
  cy.get('#query-options-dropdown').contains(name).click();
  cy.get('#filter-toolbar-search-filters').contains('Query options').click();
  cy.checkContent(topology);
});

Cypress.Commands.add('changeTimeRange', (name, topology) => {
  cy.get('#time-range-dropdown-dropdown').click();
  cy.get('.pf-c-dropdown__menu').contains(name).click();
  cy.checkContent(topology);
});

Cypress.Commands.add('changeMetricFunction', (name) => {
  cy.showAdvancedOptions();
  cy.showDisplayOptions();

  cy.get('#metricFunction-dropdown').click();
  cy.get('.pf-c-dropdown__menu').contains(name).click();
  cy.get('[data-layer-id="default"]').children().its('length').should('be.gte', 5);
});

Cypress.Commands.add('changeMetricType', (name) => {
  cy.showAdvancedOptions();
  cy.showDisplayOptions();

  cy.get('#metricType-dropdown').click();
  cy.get('.pf-c-dropdown__menu').contains(name).click();
  cy.get('[data-layer-id="default"]').children().its('length').should('be.gte', 5);
});

Cypress.Commands.add('checkRecordField', (field, name, values) => {
  cy.get(`[data-test-id="drawer-field-${field}"]`).contains(name);
  values.forEach(v => {
    cy.get(`[data-test-id="drawer-field-${field}"]`)
      .children('.record-field-content,.record-field-flex-container')
      .should('contain', v);
  });
});

declare global {
  namespace Cypress {
    interface Chainable {
      clearNetobservLocalStorage(): Chainable<void>
      openNetflowTrafficPage(clearCache?: boolean): Chainable<void>
      showAdvancedOptions(): Chainable<Element>
      showDisplayOptions(): Chainable<Element>
      checkPanels(panels?: number): Chainable<Element>
      openPanelsModal(): Chainable<Element>
      checkColumns(groups?: number, cols?: number): Chainable<Element>
      openColumnsModal(): Chainable<Element>
      selectPopupItems(id: string, names: string[]): Chainable<Element>
      checkPopupItems(id: string, ids: string[]): Chainable<Element>
      sortColumn(name: string): Chainable<Element>
      dropdownSelect(id: string, name: string): Chainable<Element>
      checkContent(topology?: boolean): Chainable<Element>
      addFilter(filter: string, value: string, topology?: boolean): Chainable<Element>
      changeQueryOption(name: string, topology?: boolean): Chainable<Element>
      changeTimeRange(name: string, topology?: boolean): Chainable<Element>
      changeMetricFunction(name: string): Chainable<Element>
      changeMetricType(name: string): Chainable<Element>
      checkRecordField(field: string, name: string, values: string[]): Chainable<Element>
      switchPerspective(perspective: string): Chainable<Element>
      login(provider: string, username: string, password: string): Chainable<Element>
      uiLogin(provider: string, username: string, password: string): Chainable<Element>
      uiLogout(): Chainable<Element>
      cliLogin(username?: string, password?: string, hostapi?: string): Chainable<Element>
      adminCLI(command: string, options?: any): Chainable<Element>
      retryTask(condition: string, expectedoutput: string, options?: any): Chainable<boolean>
      checkCommandResult(condition: string, expectedoutput: string, options?: any): Chainable<void>
    }
  }
}
const kubeconfig = Cypress.env('KUBECONFIG_PATH');
const DEFAULT_RETRY_OPTIONS = { retries: 3, interval: 10000 };

Cypress.Commands.add("switchPerspective", (perspective: string) => {
    cy.get('body').then(($body) => {
        if ($body.find('.pf-m-collapsed').length > 0) {
            cy.get('#nav-toggle').click()
        }

        const currentPerspective = $body.find('[data-test-id="perspective-switcher-toggle"]').text();
        if (currentPerspective.includes(perspective)) {
            cy.log('Already on ' + perspective + ' perspective');
            return;
        }

        cy.byLegacyTestID('perspective-switcher-toggle').click();
        cy.byLegacyTestID(`perspective-switcher-menu-option-${perspective.toLowerCase()}`).click();
    });
});

Cypress.Commands.add("cliLogin", (username?, password?, hostapi?) => {
  const loginUsername = username || Cypress.env('LOGIN_USERNAME');
  const loginPassword = password || Cypress.env('LOGIN_PASSWORD');
  const hostapiurl = hostapi || Cypress.env('HOST_API');
  cy.exec(`oc login -u ${loginUsername} -p ${loginPassword} ${hostapiurl} --insecure-skip-tls-verify=true`, { failOnNonZeroExit: false })
    .then(result => {
      cy.log(result.stderr);
      cy.log(result.stdout);
  });
});

Cypress.Commands.add("adminCLI", (command: string, options?: {}) => {
  cy.log(`Run admin command: ${command}`)
  cy.exec(`${command} --kubeconfig ${kubeconfig}`, options)
});

Cypress.Commands.add('retryTask', (command: string, expectedOutput: string, options?: any) => {
  const { retries, interval } = options || DEFAULT_RETRY_OPTIONS;

  const retryTaskFn = (currentRetries: number): Cypress.Chainable<boolean> => {
    return cy.exec(`${command} --kubeconfig ${kubeconfig}`)
      .then((result: any) => {
        if (result.stdout.includes(expectedOutput)) {
          return cy.wrap(true);
        } else if (currentRetries < retries) {
          return cy.wait(interval).then(() => retryTaskFn(currentRetries + 1));
        } else {
          return cy.wrap(false);
        }
      });
  };
  return retryTaskFn(0);
});

Cypress.Commands.add("checkCommandResult", (command: string, expectedoutput: string, options?: any) => {
  cy.retryTask(command, expectedoutput, options)
    .then((conditionMet: boolean) =>{
      if (!conditionMet) {
        throw new Error(`"${command}" failed to meet expectedoutput ${expectedoutput} within ${options.retries} retries`);
      }
    })
});

Cypress.Commands.add('uiLogin', (provider: string, username: string, password: string)=> {
  cy.clearCookie('openshift-session-token');
  cy.visit('/');
  cy.window().then((win: any) => {
    if(win.SERVER_FLAGS?.authDisabled) {
      cy.task('log', 'Skipping login, console is running with auth disabled');
      return;
    }
  cy.get('[data-test-id="login"]').should('be.visible');
  cy.get('body').then(($body) => {
    if ($body.text().includes(provider)) {
      cy.contains(provider).should('be.visible').click();
    }else if ($body.find('li.idp').length > 0) {
      cy.get('li.idp').last().click();
    }
  });
  cy.get('#inputUsername').type(username);
  cy.get('#inputPassword').type(password);
  cy.get('button[type=submit]').click();
  cy.byTestID("username", {timeout: 120000})
    .should('be.visible');
  });
  guidedTour.close();
  cy.switchPerspective('Administrator');
});

Cypress.Commands.add('login', (provider: string, username: string, password: string) => {
  cy.uiLogin(provider, username, password);
});

Cypress.Commands.add('uiLogout', () => {
  cy.window().then((win: any) => {
    if (win.SERVER_FLAGS?.authDisabled){
      cy.log('Skipping logout, console is running with auth disabled');
      return;
    }
    cy.log('Loggin out UI');
    cy.byTestID('user-dropdown').click();
    cy.byTestID('log-out').should('be.visible');
    cy.byTestID('log-out').click({ force: true });
  })
});
