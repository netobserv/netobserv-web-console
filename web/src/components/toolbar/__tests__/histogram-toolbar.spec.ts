import { getZoomedTimeRange } from '../histogram-toolbar';

describe('getZoomedTimeRange', () => {
  it('expands the displayed interval without clipping it at the refresh time', () => {
    const displayedRange = { from: 1_000, to: 1_600 };

    expect(getZoomedTimeRange(displayedRange, false, 1_500_000)).toEqual({ from: 700, to: 1_600 });
  });

  it('clamps a short displayed interval to the default range when zooming out', () => {
    const displayedRange = { from: 1_000, to: 1_100 };

    expect(getZoomedTimeRange(displayedRange, false, 2_200_000)).toEqual({ from: 900, to: 1_200 });
  });

  it('preserves the normal expansion when the displayed interval is just under the default range', () => {
    expect(getZoomedTimeRange({ from: 1_000, to: 1_299 }, false, 2_200_000)).toEqual({ from: 851, to: 1_448 });
    expect(getZoomedTimeRange({ from: 1_000, to: 1_300 }, false, 2_200_000)).toEqual({ from: 850, to: 1_450 });
  });

  it('zooms in around the displayed interval and respects the minimum range', () => {
    expect(getZoomedTimeRange({ from: 1_000, to: 2_200 }, true, 2_200_000)).toEqual({ from: 1_300, to: 1_900 });
    expect(getZoomedTimeRange({ from: 1_000, to: 1_200 }, true, 2_200_000)).toBeUndefined();
  });
});
