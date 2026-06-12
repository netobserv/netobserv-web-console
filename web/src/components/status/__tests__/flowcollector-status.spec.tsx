import { useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import { render } from '@testing-library/react';
import * as React from 'react';
import { getFlowCollectorOverallStatus } from '../../forms/utils';
import { FlowCollectorStatusIndicator } from '../flowcollector-status-indicator';

describe('getFlowCollectorOverallStatus', () => {
  it('should return loading when CR is undefined', () => {
    expect(getFlowCollectorOverallStatus(undefined, null)).toEqual({ status: 'loading' });
  });

  it('should return error on load error', () => {
    expect(getFlowCollectorOverallStatus(undefined, 'some error')).toEqual({ status: 'error', message: 'some error' });
  });

  it('should return onHold when execution mode is OnHold', () => {
    const cr = { spec: { execution: { mode: 'OnHold' } } };
    expect(getFlowCollectorOverallStatus(cr, null)).toEqual({ status: 'onHold' });
  });

  it('should return pending when no conditions', () => {
    const cr = { spec: {} };
    expect(getFlowCollectorOverallStatus(cr, null)).toEqual({ status: 'pending' });
  });

  it('should return ready when Ready condition is True', () => {
    const cr = {
      status: { conditions: [{ type: 'Ready', status: 'True', reason: 'Ready' }] }
    };
    expect(getFlowCollectorOverallStatus(cr, null)).toEqual({ status: 'ready' });
  });

  it('should return degraded when Ready is True with reason Ready,Degraded', () => {
    const cr = {
      status: {
        conditions: [{ type: 'Ready', status: 'True', reason: 'Ready,Degraded' }]
      }
    };
    expect(getFlowCollectorOverallStatus(cr, null)).toEqual({ status: 'degraded' });
  });

  it('should return pending when Ready condition is missing', () => {
    const cr = {
      status: { conditions: [{ type: 'AgentReady', status: 'True', reason: 'Ready' }] }
    };
    expect(getFlowCollectorOverallStatus(cr, null)).toEqual({ status: 'pending' });
  });

  it('should return pending when Ready is False with reason Pending', () => {
    const cr = {
      status: {
        conditions: [
          { type: 'Ready', status: 'False', reason: 'Pending' },
          { type: 'PluginReady', status: 'False', reason: 'DeploymentNotReady' }
        ]
      }
    };
    expect(getFlowCollectorOverallStatus(cr, null)).toEqual({ status: 'pending' });
  });

  it('should return error when Ready is False with non-Pending reason', () => {
    const cr = {
      status: {
        conditions: [
          { type: 'Ready', status: 'False', reason: 'Failed' },
          { type: 'PluginNotReady', status: 'True', reason: 'CrashLoopBackOff', message: 'Plugin fails to start' }
        ]
      }
    };
    expect(getFlowCollectorOverallStatus(cr, null)).toEqual({ status: 'error', message: 'Plugin fails to start' });
  });

  it('should return ready when Ready is True regardless of other conditions', () => {
    const cr = {
      status: {
        conditions: [
          { type: 'Ready', status: 'True', reason: 'Ready' },
          { type: 'ConfigurationIssue', status: 'True', reason: 'Warnings' },
          { type: 'LokiWarning', status: 'True', reason: 'LokiStackWarnings' }
        ]
      }
    };
    expect(getFlowCollectorOverallStatus(cr, null)).toEqual({ status: 'ready' });
  });
});

const useK8sWatchResourceMock = useK8sWatchResource as jest.Mock;

describe('<FlowCollectorStatusIndicator />', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render a clickable button', () => {
    useK8sWatchResourceMock.mockReturnValue([null, false, null]);
    const { container } = render(<FlowCollectorStatusIndicator />);
    const button = container.querySelector('#flowcollector-status-indicator');
    expect(button).toBeTruthy();
  });

  it('should render spinner when CR is loading', () => {
    useK8sWatchResourceMock.mockReturnValue([null, false, null]);
    const { container } = render(<FlowCollectorStatusIndicator />);
    expect(container.querySelector('[role="progressbar"]')).toBeTruthy();
  });

  it('should render icon when CR is ready', () => {
    useK8sWatchResourceMock.mockReturnValue([
      { status: { conditions: [{ type: 'Ready', status: 'True', reason: 'Ready' }] } },
      true,
      null
    ]);
    const { container } = render(<FlowCollectorStatusIndicator />);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelector('[role="progressbar"]')).toBeFalsy();
  });

  it('should render icon on load error', () => {
    useK8sWatchResourceMock.mockReturnValue([null, false, 'load error']);
    const { container } = render(<FlowCollectorStatusIndicator />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('should render icon for degraded', () => {
    useK8sWatchResourceMock.mockReturnValue([
      { status: { conditions: [{ type: 'Ready', status: 'True', reason: 'Ready,Degraded' }] } },
      true,
      null
    ]);
    const { container } = render(<FlowCollectorStatusIndicator />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('should render icon for pending', () => {
    useK8sWatchResourceMock.mockReturnValue([
      { status: { conditions: [{ type: 'Ready', status: 'False', reason: 'Pending' }] } },
      true,
      null
    ]);
    const { container } = render(<FlowCollectorStatusIndicator />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('should render icon for onHold', () => {
    useK8sWatchResourceMock.mockReturnValue([{ spec: { execution: { mode: 'OnHold' } } }, true, null]);
    const { container } = render(<FlowCollectorStatusIndicator />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
