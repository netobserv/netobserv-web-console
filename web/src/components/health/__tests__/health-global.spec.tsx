import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { ContextSingleton } from '../../../utils/context';
import { HealthGlobal } from '../health-global';
import { AlertState, HealthItem, HealthStat, Severity } from '../health-helper';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: (key: string, params?: any) => {
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

const mockItem = (severity: Severity, state: AlertState, summary: string): HealthItem => ({
  ruleName: summary,
  labels: { alertname: summary, severity },
  severity,
  state,
  ruleID: '',
  description: `${summary} description`,
  summary,
  threshold: '10',
  thresholdF: 10,
  upperBound: '100',
  metadata: {
    alertThresholdF: 10,
    alertThreshold: '10',
    upperBoundF: 100,
    upperBound: '100',
    unit: '%',
    links: []
  },
  value: 50,
  activeAt: '2026-05-20T10:00:00Z'
});

const emptyPerState = () => ({
  firing: [] as HealthItem[],
  pending: [] as HealthItem[],
  silenced: [] as HealthItem[],
  recording: [] as HealthItem[],
  inactive: [] as string[]
});

const createMockInfo = (): HealthStat => ({
  name: 'global',
  score: 5,
  critical: {
    ...emptyPerState(),
    firing: [mockItem('critical', 'firing', 'Critical firing')],
    silenced: [mockItem('critical', 'silenced', 'Critical silenced')]
  },
  warning: {
    ...emptyPerState(),
    pending: [mockItem('warning', 'pending', 'Warning pending')]
  },
  other: {
    ...emptyPerState(),
    recording: [mockItem('info', 'recording', 'Info recording')],
    silenced: [mockItem('info', 'silenced', 'Info silenced')]
  }
});

const byTest = (container: HTMLElement, testId: string): HTMLElement => {
  const el = container.querySelector(`[data-test="${testId}"]`);
  if (!el) {
    throw new Error(`expected [data-test="${testId}"]`);
  }
  return el as HTMLElement;
};

const getRowsCount = (): number => {
  const table = screen.getByRole('grid', { name: 'Rule details' });
  return Number(table.getAttribute('data-test-rows-count'));
};

describe('HealthGlobal', () => {
  const modes: Array<{ name: string; standalone: boolean }> = [
    { name: 'plugin', standalone: false },
    { name: 'standalone', standalone: true }
  ];

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows loading spinner and hides violations content', () => {
    const { container } = render(<HealthGlobal info={createMockInfo()} isLoading />);

    expect(byTest(container, 'health-global-loading')).toBeInTheDocument();
    expect(screen.queryByText('Global rule violations')).not.toBeInTheDocument();
    expect(container.querySelector('[data-test="health-global-strip"]')).toBeNull();
  });

  it('shows empty state when there are no violations', () => {
    const info: HealthStat = {
      name: 'global',
      score: 10,
      critical: emptyPerState(),
      warning: emptyPerState(),
      other: emptyPerState()
    };

    const { container } = render(<HealthGlobal info={info} />);

    expect(screen.getByText('No violations found')).toBeInTheDocument();
    expect(container.querySelector('[data-test="health-global-strip"]')).toBeNull();
  });

  it('includes silenced items in severity chip counts', () => {
    const { container } = render(<HealthGlobal info={createMockInfo()} />);

    expect(byTest(container, 'health-global-filter-critical')).toHaveTextContent('2 critical issues');
    expect(byTest(container, 'health-global-filter-warning')).toHaveTextContent('1 warnings');
    expect(byTest(container, 'health-global-filter-info')).toHaveTextContent('2 info metrics');
    expect(screen.getByText('2 silenced issues')).toBeInTheDocument();
  });

  modes.forEach(({ name, standalone }) => {
    describe(`${name} mode`, () => {
      beforeEach(() => {
        jest.spyOn(ContextSingleton, 'isStandalone').mockReturnValue(standalone);
      });

      it('toggles each severity filter with aria-pressed and filtered row counts', async () => {
        const user = userEvent.setup();
        const { container } = render(<HealthGlobal info={createMockInfo()} />);

        // critical firing + silenced + warning pending + info recording + info silenced
        expect(getRowsCount()).toBe(5);

        const critical = byTest(container, 'health-global-filter-critical');
        const warning = byTest(container, 'health-global-filter-warning');
        const info = byTest(container, 'health-global-filter-info');

        expect(critical).toHaveAttribute('aria-pressed', 'false');
        expect(warning).toHaveAttribute('aria-pressed', 'false');
        expect(info).toHaveAttribute('aria-pressed', 'false');

        await user.click(critical);
        expect(critical).toHaveAttribute('aria-pressed', 'true');
        expect(warning).toHaveAttribute('aria-pressed', 'false');
        expect(info).toHaveAttribute('aria-pressed', 'false');
        expect(getRowsCount()).toBe(2);
        const table = screen.getByRole('grid', { name: 'Rule details' });
        expect(within(table).getByText('Critical firing')).toBeInTheDocument();
        expect(within(table).getByText('Critical silenced')).toBeInTheDocument();

        await user.click(critical);
        expect(critical).toHaveAttribute('aria-pressed', 'false');
        expect(getRowsCount()).toBe(5);

        await user.click(warning);
        expect(warning).toHaveAttribute('aria-pressed', 'true');
        expect(critical).toHaveAttribute('aria-pressed', 'false');
        expect(getRowsCount()).toBe(1);

        await user.click(info);
        expect(info).toHaveAttribute('aria-pressed', 'true');
        expect(warning).toHaveAttribute('aria-pressed', 'false');
        expect(getRowsCount()).toBe(2);
      });
    });
  });
});
