/**
 * Console utility functions extracted for NetObserv use
 * These don't depend on external packages
 */

declare global {
  namespace Cypress {
    interface Chainable {
      visitAndWait(
        url: string,
        options?: Partial<Cypress.VisitOptions>,
        selector?: string,
      ): Chainable<Element>;
      dismissWelcomeModal(): Chainable<Element>;
    }
  }
}

// Configure Cypress behavior
Cypress.Cookies.debug(true);

Cypress.on('uncaught:exception', (err) => {
  console.error('Uncaught exception', err);

  // ResizeObserver loop errors are non-actionable and can be ignored
  if (typeof err.message === 'string' && err.message.includes('ResizeObserver loop')) {
    return false;
  }

  // Ignore known transient errors in console application
  const allowlistedErrors = [
    'listener is not a function',
    // Add other specific known transient error messages here
  ];
  if (typeof err.message === 'string' && allowlistedErrors.some((msg) => err.message === msg || err.message.includes(msg))) {
    return false;
  }

  return true; // test fails
});

Cypress.Commands.overwrite('log', (originalFn, message) => {
  cy.task('log', `      ${message}`, { log: false });
  originalFn(message);
});

const waitForElementToExist = (selector: string) =>
  cy.get(selector, { timeout: 30000 }).should('exist');

Cypress.Commands.add('visitAndWait', (url, options, selector = '#content') => {
  if (url !== '/') {
    cy.visit('/');
    waitForElementToExist('#content');
  }

  cy.visit(url, options);
  waitForElementToExist(selector);
});

Cypress.Commands.add('clickNavLink', (path: string[]) => {
  cy.get('#page-sidebar')
    .contains(path[0])
    .then(($navItem) => {
      if ($navItem.attr('aria-expanded') !== 'true') {
        cy.wrap($navItem).click();
      }
    });
  if (path.length === 2) {
    cy.get('#page-sidebar').contains(path[1]).click();
  }
});

Cypress.Commands.add('dismissWelcomeModal', () => {
  cy.get('body').then(($body) => {
    const modal = $body.find('[role="dialog"]');
    if (modal.length === 0) {
      return;
    }

    const closeBtn = modal.find('button[aria-label="Close"]');
    if (closeBtn.length > 0) {
      cy.get('[role="dialog"] button[aria-label="Close"]', { timeout: 5000 }).click({ force: true });
      // Wait for modal to be removed after clicking close
      cy.get('[role="dialog"]', { timeout: 5000 }).should('not.exist');
    }
    // If close button doesn't exist, just continue without trying to close
  });
});

export const checkErrors = () =>
  cy.window().then((win: any) => {
    if (win.windowError !== undefined) {
      // eslint-disable-next-line no-undef
      assert.isTrue(!win.windowError, win.windowError);
    }
  });

export const testName = `test-${Math.random()
  .toString(36)
  .replace(/[^a-z]+/g, '')
  .substr(0, 5)}`;

export const actions = Object.freeze({
  labels: 'Edit Labels',
  annotations: 'Edit Annotations',
  edit: 'Edit',
  delete: 'Delete',
});

const actionOnKind = (action: string, kind: string, humanizeKind: boolean) => {
  if (!humanizeKind) {
    return `${action} ${kind}`;
  }

  const humanizedKind = (kind.includes('~') ? kind.split('~')[2] : kind)
    .split(/(?=[A-Z])/)
    .join('');

  return `${action} ${humanizedKind}`;
};

export const editKind = (kind: string, humanizeKind: boolean) =>
  actionOnKind(actions.edit, kind, humanizeKind);

export const deleteKind = (kind: string, humanizeKind: boolean) =>
  actionOnKind(actions.delete, kind, humanizeKind);

export const create = (obj) => {
  const filename = [
    Cypress.config('screenshotsFolder').toString().replace('/cypress/screenshots', ''),
    `${obj.metadata.name}.${obj.kind.toLowerCase()}.json`,
  ].join('/');
  cy.writeFile(filename, JSON.stringify(obj));
  cy.exec(`oc create -f ${filename}`);
  cy.exec(`rm ${filename}`);
};
