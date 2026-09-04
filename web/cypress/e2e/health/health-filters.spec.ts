/// <reference types="cypress" />

import { networkHealthFiltersSelectors, networkHealthSelectors } from '../../views/network-health'

describe('network-health filters', () => {
  beforeEach(() => {
    cy.openNetworkHealthPage();
    cy.get(networkHealthFiltersSelectors.toolbar).should('exist');
  });

  it('filters cards by severity', () => {
    cy.get(networkHealthSelectors.namespace).click();

    cy.get(networkHealthFiltersSelectors.severityToggle).click();
    cy.get(networkHealthFiltersSelectors.option('health-severity-filter', 'critical')).click();
    // Close the menu
    cy.get(networkHealthFiltersSelectors.severityToggle).click();

    cy.location('search').should('include', 'healthSeverity=critical');
    cy.get(networkHealthFiltersSelectors.clearAll).should('exist');

    // Every visible card must now be a critical one (data is mock-generated, so there may be zero cards)
    cy.get('body').then($body => {
      const cards = $body.find(networkHealthSelectors.nodeCard);
      if (cards.length > 0) {
        cy.wrap(cards).each($card => {
          cy.wrap($card).should('have.class', 'critical');
        });
      }
    });
  });

  it('searches by name or description', () => {
    cy.get(networkHealthFiltersSelectors.nameInput).type('drop');
    cy.location('search').should('include', 'healthName=drop');
  });

  it('persists filters across tab navigation and page reload', () => {
    cy.get(networkHealthFiltersSelectors.statusToggle).click();
    cy.get(networkHealthFiltersSelectors.option('health-status-filter', 'firing')).click();
    cy.get(networkHealthFiltersSelectors.statusToggle).click();
    cy.location('search').should('include', 'healthStatus=firing');

    // Switching tabs must not reset the filter
    cy.get(networkHealthSelectors.workload).click();
    cy.get(networkHealthFiltersSelectors.clearAll).should('exist');
    cy.location('search').should('include', 'healthStatus=firing');

    // Reloading the page must restore the filter from the URL
    cy.reload();
    cy.get(networkHealthFiltersSelectors.toolbar).should('exist');
    cy.get(networkHealthFiltersSelectors.clearAll).should('exist');
    cy.location('search').should('include', 'healthStatus=firing');
  });

  it('clears all filters', () => {
    cy.get(networkHealthFiltersSelectors.modeToggle).click();
    cy.get(networkHealthFiltersSelectors.option('health-mode-filter', 'recording')).click();
    cy.get(networkHealthFiltersSelectors.modeToggle).click();
    cy.get(networkHealthFiltersSelectors.clearAll).should('exist').click();

    cy.get(networkHealthFiltersSelectors.clearAll).should('not.exist');
    cy.location('search').should('not.include', 'healthMode');
  });
});
