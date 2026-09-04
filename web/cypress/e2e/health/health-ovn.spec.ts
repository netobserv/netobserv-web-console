/// <reference types="cypress" />

describe('health-ovn', () => {
  beforeEach(() => {
    cy.visit('/console-network-health');
  });

  it('shows OVN Global and Nodes tabs with mocked alerts', () => {
    cy.get('[data-test="health-context-tab-ovn"]', { timeout: 60000 }).should('be.visible').click();
    cy.get('[data-test="health-ovn-summary"]', { timeout: 60000 }).should('be.visible');
    cy.get('[data-test="health-summary-netobserv-label"]').should('not.exist');
    cy.contains('OVN-Kubernetes platform alerts').should('be.visible');
    cy.get('[data-test="health-ovn-tab-global"]', { timeout: 60000 }).should('be.visible');
    cy.get('[data-test="health-ovn-tab-nodes"]', { timeout: 60000 }).should('be.visible');
    cy.get('[data-test="health-ovn-content"]', { timeout: 60000 }).should('be.visible');
    cy.contains('Cluster-wide OVN alerts').should('be.visible');
    cy.contains('There is no running ovn-kubernetes control plane.').should('be.visible');
    cy.get('[data-test="health-ovn-tab-nodes"]').click();
    cy.get('[data-test="health-ovn-content"]', { timeout: 60000 }).should('be.visible');
    cy.contains('OVN alerts per node').should('be.visible');
    cy.get('[data-test="health-card-ip-10-0-1-7.ec2.internal"]', { timeout: 60000 }).find('button').click();
    cy.get('[data-test="health-drawer-content"]', { timeout: 60000 }).should('be.visible');
    cy.contains('OVN Kubernetes is experiencing pod creation errors at an elevated rate.').should('be.visible');
  });

  it('shows runbook link for OVN alerts with runbooks', () => {
    cy.get('[data-test="health-context-tab-ovn"]', { timeout: 60000 }).click();
    cy.get('[data-test="health-ovn-summary"]', { timeout: 60000 }).should('be.visible');
    cy.get('[data-test="health-ovn-content"]', { timeout: 60000 }).should('be.visible');
    cy.contains('There is no running ovn-kubernetes control plane.').should('be.visible');
    cy.contains('tr', 'There is no running ovn-kubernetes control plane.')
      .find('[data-test="rule-details-actions"] button')
      .click();
    cy.contains('View runbook')
      .should('have.attr', 'href')
      .and('include', 'github.com/openshift/runbooks');
  });

  it('shows Kiali context tab from netobserv_io_health_context label', () => {
    cy.get('[data-test="health-context-tab-kiali"]', { timeout: 60000 }).should('be.visible').click();
    cy.get('[data-test="health-kiali-content"]', { timeout: 60000 }).should('be.visible');
    cy.contains('Kiali control plane is down.').should('be.visible');
  });

  it('shows OVN alert information drawer on OVN tab', () => {
    cy.get('[data-test="health-context-tab-ovn"]', { timeout: 60000 }).click();
    cy.get('[data-test="health-ovn-info-button"]').should('be.visible').click();
    cy.get('[data-test="health-ovn-info-drawer"]', { timeout: 60000 }).should('be.visible');
    cy.contains('Understanding OVN Alerts').should('be.visible');
    cy.contains('Not included in the NetObserv health score').should('be.visible');
  });
});
