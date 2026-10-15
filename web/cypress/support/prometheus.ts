const promCurl = (path: string): string =>
  `oc exec -n openshift-monitoring -c prometheus prometheus-k8s-0 -- ` +
  `sh -c "curl -sf 'http://localhost:9090${path}' 2>/dev/null"`;

// Extra context collected only on timeout and appended to the failure message.
export interface AlertDiagnostic {
  label: string;
  command: string;
  // Defaults to the first 500 characters of stdout.
  format?: (stdout: string) => string;
}

export interface WaitForAlertsOptions {
  // Defaults to 18 attempts every 10s, i.e. 3 minutes.
  attempts?: number;
  intervalMs?: number;
  diagnostics?: AlertDiagnostic[];
}

const defaultFormat = (stdout: string): string => stdout.substring(0, 500) || '(empty)';

// Prefix match on the alertname label: a template name matches every variant the operator
// generates from it ('DNSNxDomain' -> 'DNSNxDomain_PerDstNamespaceWarning'), while the anchor
// keeps it from matching a runbook URL or annotation that merely mentions the name.
const isPresent = (payload: string, name: string): boolean => payload.includes(`"alertname":"${name}`);

const describeDuration = (attempts: number, intervalMs: number): string => {
  const minutes = Math.round((attempts * intervalMs) / 60000);
  return minutes >= 1 ? `${minutes} minute(s)` : `${Math.round((attempts * intervalMs) / 1000)}s`;
};

const failWithDiagnostics = (
  missing: string[],
  attempts: number,
  intervalMs: number,
  diagnostics: AlertDiagnostic[]
): void => {
  const collected: string[] = [];
  const runNext = (index: number): void => {
    if (index >= diagnostics.length) {
      throw new Error(
        `${missing.join(', ')} not firing after ${describeDuration(attempts, intervalMs)} of polling. ` +
          `${collected.join(' ')}${collected.length > 0 ? ' ' : ''}` +
          'Check gather-extra artifacts for operator/FLP logs and Prometheus state.'
      );
    }
    const diagnostic = diagnostics[index];
    cy.adminCLI(diagnostic.command, { failOnNonZeroExit: false, timeout: 120000 }).then((result: Cypress.Exec) => {
      collected.push(`${diagnostic.label}: ${(diagnostic.format ?? defaultFormat)(result.stdout || '')}.`);
      runNext(index + 1);
    });
  };
  runNext(0);
};

/**
 * Wait until every named alert is active in Prometheus.
 *
 * All names must be satisfied by the same poll: rule groups are evaluated on staggered schedules,
 * so checking them one after another can observe two states that were never true at once. Pages
 * reading alerts fetch once per visit, so an alert that starts firing later never reaches the DOM.
 */
export const waitForAlertsFiring = (names: string[], options: WaitForAlertsOptions = {}): void => {
  const { attempts = 18, intervalMs = 10000, diagnostics = [] } = options;

  const poll = (attempt = 0): void => {
    cy.adminCLI(promCurl('/api/v1/alerts'), { failOnNonZeroExit: false, timeout: 120000 }).then(
      (result: Cypress.Exec) => {
        const missing = names.filter(name => !isPresent(result.stdout || '', name));
        cy.log(`waiting on alerts: ${missing.join(', ') || 'none'} (attempt ${attempt + 1}/${attempts})`);
        if (missing.length === 0) {
          return;
        }
        if (attempt < attempts) {
          cy.wait(intervalMs);
          poll(attempt + 1);
        } else {
          failWithDiagnostics(missing, attempts, intervalMs, diagnostics);
        }
      }
    );
  };

  poll();
};

// PromQL instant query, safe for queries containing {} or [].
export const promQueryCommand = (query: string): string =>
  `oc exec -n openshift-monitoring -c prometheus prometheus-k8s-0 -- ` +
  `sh -c "curl -s --fail-with-body -G 'http://localhost:9090/api/v1/query' ` +
  `--data-urlencode 'query=${query}'"`;
