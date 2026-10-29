import { areChartsSizedForExport, restoreSvgStyles, saveAndInlineSvgStyles, waitForExportLayout } from '../export';

describe('saveAndInlineSvgStyles', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('inlines computed fill and stroke on SVG elements and restores them', () => {
    document.body.innerHTML = `
      <style>
        .label-bg { fill: rgb(255, 255, 255); stroke: rgb(106, 110, 115); }
        .label-text { fill: rgb(21, 21, 21); font-size: 14px; }
      </style>
      <svg id="topology" width="200" height="100">
        <rect class="label-bg" width="80" height="20" />
        <text class="label-text" x="4" y="14">node-a</text>
      </svg>
    `;

    const svg = document.getElementById('topology')!;
    const rect = svg.querySelector('rect')!;
    const text = svg.querySelector('text')!;

    expect(rect.getAttribute('fill')).toBeNull();
    expect(text.getAttribute('fill')).toBeNull();

    const saved = saveAndInlineSvgStyles(svg);

    expect(rect.getAttribute('fill')).toBe('rgb(255, 255, 255)');
    expect(rect.getAttribute('stroke')).toBe('rgb(106, 110, 115)');
    expect(text.getAttribute('fill')).toBe('rgb(21, 21, 21)');
    expect(text.style.fontSize).toBe('14px');

    restoreSvgStyles(saved);

    expect(rect.getAttribute('fill')).toBeNull();
    expect(rect.style.fill).toBe('');
    expect(text.getAttribute('fill')).toBeNull();
    expect(text.style.fontSize).toBe('');
  });

  it('walks nested svg icons inside the topology surface', () => {
    document.body.innerHTML = `
      <style>
        .icon { color: rgb(57, 63, 68); }
        .icon path { fill: currentColor; }
      </style>
      <svg id="topology" width="100" height="100">
        <g class="icon">
          <svg width="24" height="24">
            <path d="M0 0" />
          </svg>
        </g>
      </svg>
    `;

    const svg = document.getElementById('topology')!;
    const iconPath = svg.querySelector('path')!;
    const saved = saveAndInlineSvgStyles(svg);

    expect(iconPath.getAttribute('fill')).toBe('rgb(57, 63, 68)');

    restoreSvgStyles(saved);
    expect(iconPath.getAttribute('fill')).toBeNull();
  });

  it('does not inline invisible edge background hit areas', () => {
    document.body.innerHTML = `
      <style>
        .pf-topology__edge__background {
          stroke: transparent;
          fill: none;
          stroke-width: 10px;
        }
      </style>
      <svg id="topology" width="100" height="100">
        <path class="pf-topology__edge__background" d="M0 0 L50 50" />
      </svg>
    `;

    const svg = document.getElementById('topology')!;
    const background = svg.querySelector('path')!;
    const saved = saveAndInlineSvgStyles(svg);

    expect(saved.some(entry => entry.element === background)).toBe(false);
    expect(background.style.strokeWidth).toBe('');
    expect(background.getAttribute('stroke')).toBeNull();

    restoreSvgStyles(saved);
  });

  it('inlines dotted edge dash styles', () => {
    document.body.innerHTML = `
      <style>
        .pf-topology__edge__link.pf-m-dotted {
          stroke: rgb(106, 110, 115);
          stroke-width: 1px;
          stroke-dasharray: 2;
          stroke-dashoffset: 2;
          fill-opacity: 0;
        }
      </style>
      <svg id="topology" width="100" height="100">
        <path class="pf-topology__edge__link pf-m-dotted" d="M0 0 L50 50" />
      </svg>
    `;

    const svg = document.getElementById('topology')!;
    const link = svg.querySelector('path')!;
    const saved = saveAndInlineSvgStyles(svg);

    expect(link.getAttribute('stroke')).toBe('rgb(106, 110, 115)');
    expect(link.style.strokeDasharray).toBe('2');
    expect(link.getAttribute('stroke-dasharray')).toBe('2');
    expect(link.style.strokeDashoffset).toBe('2');
    expect(link.getAttribute('stroke-dashoffset')).toBe('2');
    expect(link.getAttribute('fill')).toBe('none');

    restoreSvgStyles(saved);
    expect(link.getAttribute('stroke-dasharray')).toBeNull();
  });

  it('clears inherited fill on light-theme edge links and applies dotted dash pattern', () => {
    document.body.innerHTML = `
      <style>
        .pf-topology__edge {
          fill: rgb(106, 110, 115);
          stroke: rgb(106, 110, 115);
        }
        .pf-topology__edge__link {
          fill-opacity: 0;
          stroke: rgb(106, 110, 115);
          stroke-width: 1px;
          stroke-dasharray: 0;
        }
        .pf-topology__edge__link.pf-m-dotted {
          stroke-dasharray: 2;
          stroke-dashoffset: 2;
        }
      </style>
      <svg id="topology" width="100" height="100">
        <g class="pf-topology__edge">
          <path class="pf-topology__edge__link pf-m-dotted" d="M0 0 L50 50" />
        </g>
      </svg>
    `;

    const svg = document.getElementById('topology')!;
    const edgeGroup = svg.querySelector('.pf-topology__edge') as SVGGElement;
    const link = svg.querySelector('.pf-topology__edge__link') as SVGPathElement;
    const saved = saveAndInlineSvgStyles(svg);

    expect(edgeGroup.style.fill).toBe('');
    expect(link.getAttribute('fill')).toBe('none');
    expect(link.style.fill).toBe('none');
    expect(link.getAttribute('stroke-dasharray')).toBe('2');
    expect(link.getAttribute('stroke-dashoffset')).toBe('2');

    restoreSvgStyles(saved);
  });
});

describe('chart layout readiness', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('detects when chart svg dimensions match their containers', () => {
    document.body.innerHTML = `
      <div id="overview-graph-list">
        <div class="metrics-content-div" style="width: 400px; height: 300px">
          <svg width="400" height="300"></svg>
        </div>
      </div>
    `;

    const root = document.getElementById('overview-graph-list')!;
    expect(areChartsSizedForExport(root)).toBe(true);
  });

  it('waits until chart svg dimensions match their containers', async () => {
    document.body.innerHTML = `
      <div id="overview-graph-list">
        <div class="metrics-content-div" style="width: 400px; height: 300px">
          <svg width="120" height="80"></svg>
        </div>
      </div>
    `;

    const root = document.getElementById('overview-graph-list')!;
    const chart = root.querySelector('.metrics-content-div') as HTMLElement;
    const svg = chart.querySelector('svg') as SVGSVGElement;

    expect(areChartsSizedForExport(root)).toBe(false);

    const layoutReady = waitForExportLayout(root, { quietMs: 50, timeoutMs: 1000 });
    setTimeout(() => {
      svg.setAttribute('width', '400');
      svg.setAttribute('height', '300');
    }, 100);

    await layoutReady;
    expect(areChartsSizedForExport(root)).toBe(true);
  });

  it('resolves quickly when charts are already sized', async () => {
    document.body.innerHTML = `
      <div id="overview-graph-list">
        <div class="metrics-content-div" style="width: 400px; height: 300px">
          <svg width="400" height="300"></svg>
        </div>
      </div>
    `;

    const root = document.getElementById('overview-graph-list')!;
    const OriginalRO = window.ResizeObserver;
    const observe = jest.fn();
    window.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe,
      unobserve: jest.fn(),
      disconnect: jest.fn()
    })) as unknown as typeof ResizeObserver;

    try {
      await waitForExportLayout(root);
      expect(window.ResizeObserver).not.toHaveBeenCalled();
      expect(observe).not.toHaveBeenCalled();
    } finally {
      window.ResizeObserver = OriginalRO;
    }
  });
});
