import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';

import { localStoragePluginKey, localStorageSamplingBannerDismissedKey } from '../../../utils/local-storage-hook';
import { SamplingBanner } from '../sampling-banner';

// Mock the url module
const mockNavigate = jest.fn();
jest.mock('../../../utils/url', () => ({
  flowCollectorPath: () => '/k8s/cluster/flows.netobserv.io~v1beta2~FlowCollector/setup',
  useNavigate: () => mockNavigate
}));

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'Sampling is enabled') return 'Sampling is enabled';
      if (key === 'View sampling & resource usage') return 'View sampling & resource usage';
      if (
        key ===
        'Not all network flows are captured. Current sampling rate is 1:{{rate}}, meaning approximately 1 in every {{rate}} packets is captured.'
      ) {
        return `Not all network flows are captured. Current sampling rate is 1:${params?.rate}, meaning approximately 1 in every ${params?.rate} packets is captured.`;
      }
      return key;
    }
  })
}));

describe('<SamplingBanner />', () => {
  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockClear();
  });

  it('should render when sampling > 1', () => {
    const { container } = render(<SamplingBanner samplingValue={50} />);

    expect(container.querySelector('[data-test="sampling-banner"]')).toBeTruthy();
    expect(screen.getByText('Sampling is enabled')).toBeTruthy();
  });

  it('should not render when sampling = 0', () => {
    const { container } = render(<SamplingBanner samplingValue={0} />);
    expect(container.querySelector('[data-test="sampling-banner"]')).toBeFalsy();
  });

  it('should not render when sampling = 1', () => {
    const { container } = render(<SamplingBanner samplingValue={1} />);
    expect(container.querySelector('[data-test="sampling-banner"]')).toBeFalsy();
  });

  it('should dismiss and save to localStorage', async () => {
    const { container } = render(<SamplingBanner samplingValue={50} />);

    expect(container.querySelector('[data-test="sampling-banner"]')).toBeTruthy();

    const closeButton = container.querySelector('[data-test-id="sampling-banner-close"]');
    expect(closeButton).toBeTruthy();

    await act(async () => {
      fireEvent.click(closeButton!);
    });

    await waitFor(() => {
      expect(container.querySelector('[data-test="sampling-banner"]')).toBeFalsy();
    });

    const stored = JSON.parse(localStorage.getItem(localStoragePluginKey)!);
    expect(stored[localStorageSamplingBannerDismissedKey]).toBe(true);
  });

  it('should not render if dismissed', () => {
    localStorage.setItem(localStoragePluginKey, JSON.stringify({ [localStorageSamplingBannerDismissedKey]: true }));

    const { container } = render(<SamplingBanner samplingValue={50} />);
    expect(container.querySelector('[data-test="sampling-banner"]')).toBeFalsy();
  });

  it('should navigate on action link click', async () => {
    const { container } = render(<SamplingBanner samplingValue={50} />);

    expect(container.querySelector('[data-test="sampling-banner"]')).toBeTruthy();

    const actionLink = container.querySelector('[data-test-id="sampling-action-link"]');
    expect(actionLink).toBeTruthy();

    await act(async () => {
      fireEvent.click(actionLink!);
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      '/k8s/cluster/flows.netobserv.io~v1beta2~FlowCollector/setup?tab=consumption'
    );
  });
});
