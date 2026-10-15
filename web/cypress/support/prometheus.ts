const promCurl = (path: string): string =>
  `oc exec -n openshift-monitoring -c prometheus prometheus-k8s-0 -- ` +
  `sh -c "curl -sf 'http://localhost:9090${path}' 2>/dev/null"`;

interface ActiveAlert {
  labels?: Record<string, string>;
  state?: string;
}

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
  // Alertname alone shows up while still `pending`, so only this state counts. Default 'firing'.
  state?: string;
  // Alerts must also carry these labels, e.g. { namespace: 'dns-traffic' }, so unrelated
  // namespaces firing the same alert do not satisfy the wait.
  labels?: Record<string, string>;
  diagnostics?: AlertDiagnostic[];
}

const defaultFormat = (stdout: string): string => stdout.substring(0, 500) || '(empty)';

const parseAlerts = (stdout: string): ActiveAlert[] => {
  try {
    return (JSON.parse(stdout)?.data?.alerts || []) as ActiveAlert[];
  } catch (e) {
    cy.log(`waitForAlertsFiring: failed to parse /api/v1/alerts response: ${(e as Error).message}`);
    return [];
  }
};

// Prefix match, so a template name covers every variant the operator generates from it
// ('DNSNxDomain' -> 'DNSNxDomain_PerDstNamespaceWarning').
const matchesName = (alert: ActiveAlert, name: string): boolean =>
  (alert.labels?.alertname || '').startsWith(name);

const hasLabels = (alert: ActiveAlert, labels: Record<string, string>): boolean =>
  Object.entries(labels).every(([key, value]) => alert.labels?.[key] === value);

const summarize = (alerts: ActiveAlert[]): string =>
  alerts.length > 0
    ? alerts.map(a => `${a.labels?.alertname}[namespace=${a.labels?.namespace}]=${a.state}`).join(', ')
    : '(no matching alerts present yet)';

const failWithDiagnostics = (
  missing: string[],
  summary: string,
  attempts: number,
  intervalMs: number,
  diagnostics: AlertDiagnostic[]
): void => {
  const minutes = Math.round((attempts * intervalMs) / 60000);
  const collected: string[] = [];
  const runNext = (index: number): void => {
    if (index >= diagnostics.length) {
      throw new Error(
        `${missing.join(', ')} not firing after ${minutes} minute(s) of polling. ` +
          `Last observed states: ${summary}. ` +
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
 * Wait until every named alert is firing in Prometheus.
 *
 * All names must be satisfied by the same poll: rule groups are evaluated on staggered schedules,
 * so checking them one after another can observe two states that were never true at once. Pages
 * reading alerts fetch once per visit, so an alert that starts firing later never reaches the DOM.
 */
export const waitForAlertsFiring = (names: string[], options: WaitForAlertsOptions = {}): void => {
  const { attempts = 18, intervalMs = 10000, state = 'firing', labels = {}, diagnostics = [] } = options;

  const poll = (attempt = 0): void => {
    cy.adminCLI(promCurl('/api/v1/alerts'), { failOnNonZeroExit: false, timeout: 120000 }).then(
      (result: Cypress.Exec) => {
        const alerts = parseAlerts(result.stdout || '');
        // Summarize every alert matching a wanted name, including the ones filtered out below:
        // "firing in the wrong namespace" is the detail worth seeing when this times out.
        const named = alerts.filter(a => names.some(name => matchesName(a, name)));
        const missing = names.filter(
          name => !named.some(a => matchesName(a, name) && a.state === state && hasLabels(a, labels))
        );
        const summary = summarize(named);
        cy.log(`waiting on alerts: ${missing.join(', ') || 'none'} (attempt ${attempt + 1}/${attempts}). ${summary}`);
        if (missing.length === 0) {
          return;
        }
        if (attempt < attempts) {
          cy.wait(intervalMs);
          poll(attempt + 1);
        } else {
          failWithDiagnostics(missing, summary, attempts, intervalMs, diagnostics);
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
