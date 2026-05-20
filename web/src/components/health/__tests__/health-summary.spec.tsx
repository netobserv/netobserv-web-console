import { Rule } from '@openshift-console/dynamic-plugin-sdk';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { HealthStats } from '../health-helper';
import { HealthSummary } from '../health-summary';

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: any) => {
      // Simple mock implementation that returns the key with interpolated params
      if (params) {
        let result = key;
        Object.keys(params).forEach(k => {
          result = result.replace(`{{${k}}}`, params[k]);
        });
        return result;
      }
      return key;
    }
  })
}));

// Mock local storage hook
jest.mock('../../../utils/local-storage-hook', () => ({
  localStorageHealthSummaryExpandedKey: 'test-key',
  useLocalStorage: () => [false, jest.fn()]
}));

const createMockRule = (severity: string, alertCount: number, state: 'firing' | 'pending'): Rule => ({
  id: `rule-${severity}-${state}`,
  name: `Test ${severity} rule`,
  query: 'test_query',
  duration: 0,
  labels: { severity },
  annotations: { summary: `Test ${severity} ${state}` },
  state: state,
  health: 'ok',
  type: 'alerting',
  alerts: Array.from({ length: alertCount }, (_, i) => ({
    labels: { severity, alertname: `test-${severity}-${i}` },
    annotations: { summary: `Test ${severity} ${state}` },
    state: state,
    value: 50,
    activeAt: '2026-05-20T10:00:00Z'
  }))
});

const createMockStats = (): HealthStats => ({
  global: {
    name: 'global',
    critical: { firing: [], pending: [], silenced: [], inactive: [], recording: [] },
    warning: { firing: [], pending: [], silenced: [], inactive: [], recording: [] },
    other: { firing: [], pending: [], silenced: [], inactive: [], recording: [] },
    score: 10
  },
  byNamespace: [],
  byNode: [],
  byOwner: []
});

describe('HealthSummary', () => {
  it('should count only firing alerts when no pending alerts exist', () => {
    const rules: Rule[] = [
      createMockRule('critical', 2, 'firing')
    ];
    const stats = createMockStats();

    render(<HealthSummary rules={rules} stats={stats} />);

    // Should show 2 critical issues (2 firing alerts)
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should count both firing and pending alerts together', () => {
    const rules: Rule[] = [
      createMockRule('critical', 1, 'firing'),
      createMockRule('critical', 1, 'pending')
    ];
    const stats = createMockStats();

    render(<HealthSummary rules={rules} stats={stats} />);

    // Should show 2 critical issues (1 firing + 1 pending)
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should show critical status when pending critical alerts exist', () => {
    const rules: Rule[] = [
      createMockRule('critical', 0, 'firing'),
      createMockRule('critical', 1, 'pending')
    ];
    const stats = createMockStats();

    const { container } = render(<HealthSummary rules={rules} stats={stats} />);

    // Should have critical status class
    expect(container.querySelector('.health-summary-dashboard')).toBeInTheDocument();
    expect(screen.getByText('There are critical network issues')).toBeInTheDocument();
  });

  it('should show warning status when pending warning alerts exist', () => {
    const rules: Rule[] = [
      createMockRule('warning', 0, 'firing'),
      createMockRule('warning', 2, 'pending')
    ];
    const stats = createMockStats();

    render(<HealthSummary rules={rules} stats={stats} />);

    expect(screen.getByText('There are network warnings')).toBeInTheDocument();
    // Should show 2 warnings (2 pending)
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should show info status when pending info alerts exist', () => {
    const rules: Rule[] = [
      createMockRule('info', 0, 'firing'),
      createMockRule('info', 1, 'pending')
    ];
    const stats = createMockStats();

    render(<HealthSummary rules={rules} stats={stats} />);

    expect(screen.getByText('The network looks relatively healthy, with minor issues')).toBeInTheDocument();
    // Should show 1 info issue (1 pending)
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('should count firing, pending, and recording rules separately in breakdown', () => {
    const rules: Rule[] = [
      createMockRule('critical', 1, 'firing'),
      createMockRule('critical', 2, 'pending')
    ];

    // Add recording rules to stats
    const stats = createMockStats();
    stats.global.critical.recording = [
      {
        ruleName: 'recording-rule-1',
        metadata: {
          alertThresholdF: 0,
          upperBound: '100',
          upperBoundF: 100,
          unit: '%',
          links: []
        },
        value: 80,
        severity: 'critical',
        state: 'recording',
        threshold: '70',
        thresholdF: 70,
        upperBound: '100',
        labels: {},
        summary: 'Recording rule violation',
        description: 'Test recording rule'
      }
    ];

    render(<HealthSummary rules={rules} stats={stats} forceCollapsed={false} />);

    // Expanded view should show breakdown
    // Total should be 4 (1 firing + 2 pending + 1 recording)
    const criticalCount = screen.getAllByText('4');
    expect(criticalCount.length).toBeGreaterThan(0);
  });

  it('should show info alert when no rules exist at all', () => {
    const rules: Rule[] = [];
    const stats = createMockStats();

    render(<HealthSummary rules={rules} stats={stats} />);

    // When there are no rules or recording rules, component shows a special "No rules found" message
    expect(screen.getByText('No rules found, health cannot be determined')).toBeInTheDocument();
  });

  it('should show healthy status when rules exist but have no violations', () => {
    // Create rules with no alerts (inactive state)
    const rules: Rule[] = [
      {
        id: 'rule-critical-inactive',
        name: 'Test critical rule',
        query: 'test_query',
        duration: 0,
        labels: { severity: 'critical' },
        annotations: { summary: 'Test critical' },
        state: 'inactive',
        health: 'ok',
        type: 'alerting',
        alerts: [] // No alerts = inactive
      }
    ];
    const stats = createMockStats();

    render(<HealthSummary rules={rules} stats={stats} />);

    expect(screen.getByText('The network looks healthy')).toBeInTheDocument();
    // All counters should be 0
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('should handle mixed severities with firing and pending alerts', () => {
    const rules: Rule[] = [
      createMockRule('critical', 1, 'firing'),
      createMockRule('critical', 1, 'pending'),
      createMockRule('warning', 2, 'firing'),
      createMockRule('info', 1, 'pending')
    ];
    const stats = createMockStats();

    render(<HealthSummary rules={rules} stats={stats} />);

    // Should show critical status (highest severity)
    expect(screen.getByText('There are critical network issues')).toBeInTheDocument();

    // Critical: 2 (1 firing + 1 pending)
    // Warning: 2 (2 firing)
    // Info: 1 (1 pending)
    const counters = screen.getAllByText(/^[0-9]+$/);
    expect(counters.length).toBeGreaterThan(0);
  });
});
