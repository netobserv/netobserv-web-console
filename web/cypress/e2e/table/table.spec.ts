/// <reference types="cypress" />

import * as c from '../../support/const'

describe('netflow-table', () => {
  function reload(clearCache = true) {
    cy.openNetflowTrafficPage(clearCache);
    //move to table view
    cy.get('.tableTabButton').click();
    //clear default app filters
    if (clearCache === true) {
      cy.get('#clear-all-filters-button').click();
    }
  }

  beforeEach(() => {
    reload();
  });

  it('displays table and rows', () => {
    cy.get('#table-container').should('exist');
    // Rows are virtualized, so only the visible rows are mounted in the DOM.
    cy.get('#table-container').find('tbody tr[data-test^="tr-"]').its('length').should('be.gt', 0);
    cy.get('#flowsCount').contains('+ Flows');

    cy.addFilter('namespace', c.namespace);
    cy.addFilter('name', c.pod);
    cy.changeQueryOption('1000');
    cy.clickShowDuplicates();
    cy.changeTimeRange('Last 1 day');
  });



  it('manage columns', () => {
    //first open modal
    cy.openColumnsModal();

    //Unselect all columns
    cy.get('#columns-modal').contains('Select all').click();
    cy.get('#columns-modal').contains('Unselect all').click();

    //Select column using checkboxes
    cy.checkPopupItems('#columns-modal', ['StartTime', 'K8S_Object', 'AddrPort', 'Packets']);

    //Save
    cy.get('#columns-modal').contains('Save').click();
    //Should not have nested columns and have 4 columns
    cy.checkColumns(0, 4);

    //reload the page without clearing cache
    reload(false);

    //Should have remembered the columns
    cy.checkColumns(0, 4);

    //reopen modal
    cy.openColumnsModal();

    //Select all columns
    cy.get('#columns-modal').contains('Select all').click();

    //Save
    cy.get('#columns-modal').contains('Save').click();
    cy.checkColumns(c.availableColumnGroupCount, c.availableColumnCount);

    //reopen modal
    cy.openColumnsModal();

    //Unselect all columns
    cy.get('#columns-modal').contains('Unselect all').click();

    //Save should be disabled
    cy.get('#columns-modal').contains('Save').should('be.disabled');

    //Select some columns
    cy.selectPopupItems('#columns-modal', ['Start Time', 'Names', 'Packets']);

    //Save new columns
    cy.get('#columns-modal').contains('Save').click();

    //Should not have nested columns and have 3 columns
    cy.checkColumns(0, 3);

    //reopen modal
    cy.openColumnsModal();

    //add End Time, Owners, Ports
    //remove Packets
    cy.selectPopupItems('#columns-modal', ['End Time', 'Owners', 'Ports', 'Packets']);

    //Save new columns
    cy.get('#columns-modal').contains('Save').click();

    //Should not have nested columns and have 5 columns
    cy.checkColumns(0, 5);

    //reopen modal
    cy.openColumnsModal();

    //Restore default columns
    cy.get('#columns-modal').contains('Restore default columns').click();

    //Save default columns
    cy.get('#columns-modal').contains('Save').click();
    cy.checkColumns();
  });

  it('sort columns', () => {
    //TODO: check data after each sort
    cy.sortColumn('Name');
    cy.sortColumn('Namespace');
    cy.sortColumn('Port');
    cy.sortColumn('Packets');
  });
})
