import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { Record } from '../../../../api/ipfix';
import { getProxyRecords } from '../../../../api/proxy';
import { ProxyRecords } from '../proxy-records';

jest.mock('../../../../api/proxy', () => ({ getProxyRecords: jest.fn() }));
const fetchRecords = getProxyRecords as jest.Mock;
const record = { fields: {}, labels: {}, key: 1 } as Record;

const response = {
  records: [
    {
      ProxyClientAddr: '192.0.2.1',
      ProxyClientPort: 40000,
      ProxyStartMs: 1000,
      ProxyEndMs: 2000,
      ProxyInstance: 'router-1'
    },
    {
      ProxyClientAddr: '192.0.2.2',
      ProxyClientPort: 40001,
      ProxyStartMs: 1100,
      ProxyEndMs: 1900,
      ProxyInstance: 'router-1'
    }
  ],
  searchStartMs: 1000,
  searchEndMs: 9000,
  pending: true,
  limitReached: false
};

describe('HAProxy related clients', () => {
  beforeEach(() => fetchRecords.mockReset());
  it('queries only when requested and preserves multiple clients', async () => {
    fetchRecords.mockResolvedValue(response);
    render(<ProxyRecords record={record} />);
    expect(fetchRecords).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Find related clients'));
    await screen.findByText('192.0.2.1:40000');
    expect(screen.getByText('192.0.2.2:40001')).toBeInTheDocument();
    expect(screen.getByText('Results may be incomplete')).toBeInTheDocument();
    expect(fetchRecords).toHaveBeenCalledTimes(1);
  });
  it('shows lookup errors', async () => {
    fetchRecords.mockRejectedValue(new Error('Loki unavailable'));
    render(<ProxyRecords record={record} />);
    fireEvent.click(screen.getByText('Find related clients'));
    await screen.findByText('Loki unavailable');
  });
  it('clears results and aborts when selecting another flow', async () => {
    fetchRecords.mockResolvedValue(response);
    const { rerender } = render(<ProxyRecords record={record} />);
    fireEvent.click(screen.getByText('Find related clients'));
    await screen.findByText('192.0.2.1:40000');
    const signal = fetchRecords.mock.calls[0][1] as AbortSignal;
    rerender(<ProxyRecords record={{ ...record, key: 2 }} />);
    await waitFor(() => expect(screen.queryByText('192.0.2.1:40000')).not.toBeInTheDocument());
    expect(signal.aborted).toBe(true);
  });
});
