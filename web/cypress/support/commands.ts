/* eslint-disable @typescript-eslint/no-namespace */

// Import Cypress custom commands
import { nav } from '@views/nav';
import './console-utilities';
import './selectors';

/// <reference types="cypress" />

/**
 * Escapes a string for safe use in shell commands
 * Wraps the value in single quotes and escapes any single quotes within
 */
function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}
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

/**
 * Clears only NetObserv plugin settings. Do not use cy.clearLocalStorage() —
 * wiping all keys drops Console auth/session state and causes /netflow-traffic 404s
 * and OAuth redirects in integration tests.
 */
Cypress.Commands.add('clearNetobservLocalStorage', () => {
  cy.window().then(win => {
    win.localStorage.removeItem('netobserv-plugin-settings');
  });
});

Cypress.Commands.add('openNetflowTrafficPage', (clearCache = true) => {
  if (clearCache) {
    // Reset plugin view prefs to defaults without clearing Console session
    cy.clearNetobservLocalStorage();
  }
  cy.visit(c.url);
  cy.get("#netflow-traffic-nav-item-link").click();
});

Cypress.Commands.add('openNetworkHealthPage', (clearCache = true) => {
  if (clearCache) {
    cy.clearLocalStorage();
  }
  cy.visit(c.url);
  cy.get('#network-health-nav-item-link').click();
});

Cypress.Commands.add('showAdvancedOptions', () => {
  cy.get('#show-view-options-button')
    .then(function ($button) {
      if ($button.text() === 'Hide advanced options') {
        return;
      } else {
        cy.get('#show-view-options-button').click();
      }
    })
});

Cypress.Commands.add('showDisplayOptions', () => {
  cy.get('[data-test="display-dropdown-container"]').then($container => {
    if ($container.find('[role="dialog"]:visible').length === 0) {
      cy.get('[data-test="display-dropdown-button"]').click();
    }
  });
});

Cypress.Commands.add('checkPanels', (panels = c.defaultPanelsCount) => {
  cy.get('#overview-flex').children().its('length').should('eq', panels);
});

Cypress.Commands.add('openPanelsModal', () => {
  cy.showAdvancedOptions();
  cy.get('#manage-overview-panels-button').click();
  cy.get('#overview-panels-modal').should('exist');
  cy.get('#overview-panels-modal').find('.pf-v6-c-data-list__item-content').should('have.length', c.availablePanelsCount);
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
  cy.get('#columns-modal').find('.pf-v6-c-data-list__item-content').should('have.length', c.availableColumnCount);
});

Cypress.Commands.add('selectPopupItems', (id, names) => {
  for (let i = 0; i < names.length; i++) {
    cy.get(id)
      .find('.pf-v6-c-modal-box__body')
      .contains(names[i])
      .closest('.pf-v6-c-data-list__item-row')
      .find('.pf-v6-c-data-list__check')
      .click();
  }
});

Cypress.Commands.add('checkPopupItems', (id, ids) => {
  for (let i = 0; i < ids.length; i++) {
    cy.get(id).find('.pf-v6-c-modal-box__body').find(`#${ids[i]}`).check();
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
  cy.get('.pf-v6-c-menu__content').filter(':visible').should('exist');
  cy.get('.pf-v6-c-menu__content').filter(':visible').find(`#${name}`).click();
});

Cypress.Commands.add('checkContent', (topology) => {
  if (topology) {
    cy.get('[data-layer-id="default"]').children().its('length').should('be.gte', 5);
  } else {
    cy.get('#table-container').find('tr').its('length').should('be.gte', 5);
  }
});

Cypress.Commands.add('addFilter', (filter, value, topology) => {
  cy.get('[aria-label="Open advanced search"]').click();
  cy.get('#column-filter-toggle').click();
  cy.get('#column-filter-dropdown').find(`#${filter}`).click();
  cy.get('#column-filter-dropdown').should('not.exist');
  cy.get('input[type="search"]').type(`${value}{enter}`);
  cy.checkContent(topology);
});

Cypress.Commands.add('changeQueryOption', (name, topology) => {
  cy.get('#filter-toolbar-search-filters').contains('Query options').click();
  cy.get('#query-options-popper').contains(name).click();
  cy.get('#filter-toolbar-search-filters').contains('Query options').click();
  cy.checkContent(topology);
});

Cypress.Commands.add('changeTimeRange', (name, topology) => {
  cy.get('#time-range-dropdown-dropdown').click();
  cy.get('.pf-v6-c-menu__content').filter(':visible').contains(name).click();
  cy.checkContent(topology);
});

Cypress.Commands.add('clickShowDuplicates', () => {
  cy.showAdvancedOptions();
  cy.showDisplayOptions();
  cy.get('#table-display-popper').contains('Show duplicates').click();
  cy.checkContent();
});

Cypress.Commands.add('changeMetricType', (name) => {
  cy.showAdvancedOptions();
  cy.showDisplayOptions();

  cy.get('#metricType-dropdown').click();
  cy.get('.pf-v6-c-menu__content').filter(':visible').contains(name).click();

  // For Packets metric, we expect a full page error due to mock timeout
  if (name === 'Packets') {
    cy.get('[data-test="error-state"]').should('exist');
  } else {
    // For other metrics (Bytes, etc.), we expect the topology to render successfully
    cy.get('[data-layer-id="default"]').children().its('length').should('be.gte', 5);
  }
});

Cypress.Commands.add('checkRecordField', (field, name, values) => {
  cy.get(`[data-test-id="drawer-field-${field}"]`).contains(name);
  values.forEach(v => {
    cy.get(`[data-test-id="drawer-field-${field}"]`)
      .children('.record-field-content,.record-field-flex-container')
      .should('contain', v);
  });
});


Cypress.Commands.add('setupNetworkIdleTracking', (method: string = 'GET', urlPattern: string = '/api/**') => {
  cy.wrap({
    requestCount: 0,
    lastRequestTime: 0,
    startTime: Date.now()
  }).as('networkIdleTracker');

  cy.intercept(method, urlPattern, (req) => {
    cy.get('@networkIdleTracker').then((tracker: Cypress.networkIdleTracker) => {
      tracker.requestCount++;
      tracker.lastRequestTime = Date.now();
    });
    req.continue();
  }).as('networkIdleActivity');
});


Cypress.Commands.add('waitForNetworkIdle', (idleTime: number = 3000, timeout: number = 120000) => {
  cy.get('@networkIdleTracker', { timeout: timeout })
    .then((tracker: Cypress.networkIdleTracker) => {
      const startTime = Date.now();

      const checkIdleCondition = () => {
        const now = Date.now();

        if (tracker.requestCount > 0 && (now - tracker.lastRequestTime) >= idleTime) {
          return true;
        }

        if (tracker.requestCount === 0 && (now - startTime) >= idleTime) {
          return true;
        }

        if (now - startTime > timeout) {
          throw new Error('Timed out waiting for network idle.');
        }

        return false;
      };

      const pollUntilIdle = () => {
        const isIdle = checkIdleCondition();

        if (isIdle) {
          return;
        } else {
          return cy.wait(1000, { log: false }).then(pollUntilIdle);
        }
      };

      return cy.then(pollUntilIdle);
    });
});

Cypress.Commands.add("switchPerspective", (perspective: string) => {

  /* if side bar is collapsed then expand it
  before switching perspecting */
  cy.get('body').then((body) => {
    if (body.find('.pf-m-collapsed').length > 0) {
      cy.get('#nav-toggle').click()
    }
  });
  nav.sidenav.switcher.changePerspectiveTo(perspective);
  nav.sidenav.switcher.shouldHaveText(perspective);
});

// Execute OpenShift CLI commands (from openshift-tests-private/frontend)
Cypress.Commands.add('adminCLI', (command: string, options?: Partial<Cypress.ExecOptions>) => {
  const kubeconfig = Cypress.env('KUBECONFIG_PATH');
  cy.log(`Run admin command: ${command}`);
  cy.exec(`${command} --kubeconfig ${kubeconfig}`, options);
});

// to avoid influence from upstream login change
Cypress.Commands.add('uiLogin', (provider: string, username: string, password: string) => {
  const baseUrl = Cypress.config('baseUrl');
  const baseOrigin = new URL(baseUrl!).origin;

  cy.clearAllCookies();
  cy.visit('/');

  // Wait for redirect to OAuth login page
  cy.url({ timeout: 30000 }).should('match', /\/login|\/oauth\/authorize/).then((url) => {
    const currentUrl = new URL(url);

    cy.log(`Current URL: ${url}`);
    cy.log(`Current origin: ${currentUrl.origin}`);
    cy.log(`Base origin: ${baseOrigin}`);

    // We're on OAuth server (different origin), use cy.origin()
    cy.origin(currentUrl.origin, { args: { username, password, provider } }, ({ username, password, provider }) => {
      // Click the login button on the OAuth page
      cy.get('[data-test-id="login"]', { timeout: 10000 }).should('be.visible').click();

      // Check if we need to select identity provider
      cy.get('body').then(($body) => {
        if ($body.text().includes(provider)) {
          cy.contains(provider).should('be.visible').click();
        } else if ($body.find('li.idp').length > 0) {
          // Using the last idp if provider name not found
          cy.get('li.idp').last().click();
        }
      });

      // Wait for the login form to be ready
      cy.get('#inputUsername', { timeout: 10000 }).should('be.visible').type(username);
      cy.get('#inputPassword').should('be.visible').type(password);
      cy.get('button[type=submit]').should('be.visible').click();
    });
  });

  // Wait for redirect back and verify login
  cy.byTestID("username", { timeout: 120000 }).should('be.visible');
});

Cypress.Commands.add('uiLogout', () => {
  cy.window().then((win: any) => {
    if (win.SERVER_FLAGS?.authDisabled) {
      cy.log('Skipping logout, console is running with auth disabled');
      return;
    }
    cy.log('Loggin out UI');
    cy.byTestID('user-dropdown-toggle').click();
    cy.byTestID('log-out').should('be.visible');
    cy.byTestID('log-out').click({ force: true });
  })
});

Cypress.Commands.add("cliLogin", (username?: string, password?: string) => {
  const kubeconfig = Cypress.env('KUBECONFIG_PATH');
  const loginUsername = username || Cypress.env('LOGIN_USERNAME');
  const loginPassword = password || Cypress.env('LOGIN_PASSWORD');

  if (!kubeconfig || !loginUsername || !loginPassword) {
    throw new Error('cliLogin requires KUBECONFIG_PATH, LOGIN_USERNAME, and LOGIN_PASSWORD');
  }

  cy.exec(`oc whoami --show-server=true --kubeconfig ${escapeShellArg(kubeconfig)}`, { log: false })
    .then(result => {
      const hostapi = result.stdout.trim();
      cy.log(`Server: ${hostapi}`);
      return cy.exec(
        `oc login -u ${escapeShellArg(loginUsername)} -p ${escapeShellArg(loginPassword)} ${escapeShellArg(hostapi)} --insecure-skip-tls-verify=true --kubeconfig ${escapeShellArg(kubeconfig)}`,
        { failOnNonZeroExit: true, log: false }
      );
    })
    .its('code')
    .should('eq', 0);
});

Cypress.Commands.add('retryTask', (command, expectedOutput, options?) => {
  const { retries, interval } = options || DEFAULT_RETRY_OPTIONS;
  const retryTaskFn = (currentRetries) => {
    return cy.adminCLI(command)
      .then(result => {
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

Cypress.Commands.add("checkCommandResult", (command, expectedoutput, options?) => {
  return cy.retryTask(command, expectedoutput, options)
    .then(conditionMet => {
      if (conditionMet) {
        return;
      } else {
        throw new Error(`"${command}" failed to meet expectedoutput ${expectedoutput} within ${options?.retries || 'default'} retries`);
      }
    })
});

declare global {
  namespace Cypress {
    interface Chainable {
      openNetflowTrafficPage(clearCache?: boolean): Chainable<void>
      openNetworkHealthPage(clearCache?: boolean): Chainable<void>
      showAdvancedOptions(): Chainable<void>
      showDisplayOptions(): Chainable<void>
      checkPanels(panels?: number): Chainable<void>
      openPanelsModal(): Chainable<void>
      checkColumns(groups?: number, cols?: number): Chainable<void>
      openColumnsModal(): Chainable<void>
      selectPopupItems(id: string, names: string[]): Chainable<void>
      checkPopupItems(id: string, ids: string[]): Chainable<void>
      sortColumn(name: string): Chainable<void>
      dropdownSelect(id: string, name: string): Chainable<void>
      checkContent(topology?: boolean): Chainable<void>
      addFilter(filter: string, value: string, topology?: boolean): Chainable<void>
      changeQueryOption(name: string, topology?: boolean): Chainable<void>
      changeTimeRange(name: string, topology?: boolean): Chainable<void>
      changeMetricType(name: string): Chainable<void>
      checkRecordField(field: string, name: string, values: string[]): Chainable<void>
      clickShowDuplicates(): Chainable<void>
      adminCLI(command: string, options?: Partial<Cypress.ExecOptions>): Chainable<void>
      clearNetobservLocalStorage(): Chainable<void>
      uiLogin(provider: string, username: string, password: string): Chainable<void>
      uiLogout(): Chainable<void>
      cliLogin(username?: string, password?: string): Chainable<void>
      switchPerspective(perspective: string): Chainable<void>
      checkCommandResult(command: string, expectedoutput: string, options?: { retries?: number; interval?: number }): Chainable<void>
      retryTask(condition: string, expectedoutput: string, options?: { retries?: number; interval?: number }): Chainable<void>




      /**
       * Sets up network interception to track active requests for idle detection.
       * This command *must* be called before `cy.waitForNetworkIdle`
       *
       * @param method HTTP method to intercept (default: 'GET')
       * @param urlPattern URL pattern to intercept (default: '/api/**')
       */
      setupNetworkIdleTracking(method?: string, urlPattern?: string): Chainable<void>

      /**
       * Waits until no intercepted requests (matching the patterns
       * set in `setupNetworkIdleTracking`) have been active for `idleTime`,
       * or until the `timeout` is reached.
       *
       * @param idleTime How long the network must be idle (in ms)
       * @param timeout Total time to wait before timing out (in ms)
       */
      waitForNetworkIdle(idleTime?: number, timeout?: number): Chainable<void>

      networkIdleTracker: {
        requestCount: number;
        lastRequestTime: number;
        startTime: number;
      };
    }
  }
}
