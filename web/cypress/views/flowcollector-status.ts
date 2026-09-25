export namespace flowcollectorStatusSelectors {
    export const statusIndicator = '#flowcollector-status-indicator'
    export const statusButton = 'button[aria-label="FlowCollector status"]'
    export const statusTooltip = '#flowcollector-status-tooltip'
    export const readyRow = '[id=Ready-row]'
    export const agentReadyRow = '[id=WaitingEBPFAgents-row]'
    export const pluginReadyRow = '[id=WaitingWebConsole-row]'
    export const monitoringReadyRow = '[id=WaitingMonitoring-row]'
    export const configIssueRow = '[id=ConfigurationIssue-row]'
    export const flpMonolithRow = '[id=WaitingFLPMonolith-row]'
    export const lokiStackRow = '[id=WaitingLokiStack-row]'
    export const flpParentRow = '[id=WaitingFLPParent-row]'
}

export const flowcollectorStatusPage = {
    visit: () => {
        cy.visit('k8s/cluster/flows.netobserv.io~v1beta2~FlowCollector/status')
        cy.contains('Network Observability FlowCollector', { timeout: 120000 }).should('exist')
    }
}
