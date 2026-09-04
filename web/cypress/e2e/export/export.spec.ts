/// <reference types="cypress" />

const downloadsDir = 'cypress/downloads';

const expectSingleDownload = (extension: string, alias: string) => {
  const dest = `${downloadsDir}/${alias}.${extension}`;

  const pollForDownload = (attempt = 0): Cypress.Chainable<string> => {
    return cy.task<string[]>('listDownloadsByExtension', { dir: downloadsDir, extension }, { timeout: 15000 }).then(files => {
      if (files.length === 1) {
        return cy.wrap(files[0]);
      }
      if (attempt >= 30) {
        throw new Error(`Expected one .${extension} download, found ${files.length}: ${files.join(', ')}`);
      }
      return cy.wait(500).then(() => pollForDownload(attempt + 1));
    });
  };

  pollForDownload().then(file => {
    cy.task('renameDownload', { from: `${downloadsDir}/${file}`, to: dest });
    cy.readFile(dest, { timeout: 10000 }).should('exist');
    cy.task('deleteDownload', dest);
  });
};

describe('netflow-export', () => {
  beforeEach(() => {
    cy.openNetflowTrafficPage();
    cy.get('#clear-all-filters-button').click();
  });

  it('exports flows as CSV from table view', () => {
    cy.get('.tableTabButton').click();
    cy.byTestID('table-composable').should('exist');
    cy.showAdvancedOptions();
    cy.get('#export-button').click();
    cy.byTestID('flows-export-modal').should('be.visible');
    cy.byTestID('flows-export-modal').within(() => {
      cy.get('#flows-export-format-csv').should('be.checked');
      cy.byTestID('export-button').click();
    });
    expectSingleDownload('csv', 'flows_table');
  });

  it('exports flows as JSON from table view', () => {
    cy.get('.tableTabButton').click();
    cy.byTestID('table-composable').should('exist');
    cy.showAdvancedOptions();
    cy.get('#export-button').click();
    cy.byTestID('flows-export-modal').within(() => {
      cy.get('#flows-export-format-json').click();
      cy.byTestID('export-button').click();
    });
    expectSingleDownload('json', 'flows_table');
  });

  it('exports flows as spreadsheet from table view', () => {
    cy.get('.tableTabButton').click();
    cy.byTestID('table-composable').should('exist');
    cy.showAdvancedOptions();
    cy.get('#export-button').click();
    cy.byTestID('flows-export-modal').within(() => {
      cy.get('#flows-export-format-spreadsheet').click();
      cy.byTestID('export-button').click();
    });
    expectSingleDownload('xls', 'flows_table');
  });

  it('exports metrics report from topology view', () => {
    cy.get('.topologyTabButton').click();
    cy.get('.pf-topology-visualization-surface').should('exist');
    cy.get('[data-layer-id="default"]').children().its('length').should('be.gte', 5);
    cy.showAdvancedOptions();
    cy.get('#export-metrics-button').click();
    cy.byTestID('metrics-export-modal').should('be.visible');
    cy.byTestID('metrics-export-modal').within(() => {
      cy.get('#metrics-export-format-json').click();
      cy.byTestID('metrics-export-button').should('not.be.disabled');
      cy.byTestID('metrics-export-button').click();
    });
    expectSingleDownload('json', 'metrics_topology');
  });

  it('exports metrics report as CSV from overview view', () => {
    cy.get('li.overviewTabButton').click();
    cy.get('#overview-container').should('exist');
    cy.showAdvancedOptions();
    cy.get('#export-metrics-button').click();
    cy.byTestID('metrics-export-modal').within(() => {
      cy.get('#metrics-export-format-csv').should('be.checked');
      cy.byTestID('metrics-export-button').click();
    });
    expectSingleDownload('csv', 'metrics_overview');
  });
});
