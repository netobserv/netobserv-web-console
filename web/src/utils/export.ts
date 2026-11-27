import { toPng } from '@jpinsonneau/html-to-image'; // slightly modified from 'html-to-image' to fix a browser freeze. See NETOBSERV-2314.

const EXPORT_BACKGROUND = {
  dark: '#0f1214',
  light: '#f0f0f0'
} as const;

const SVG_GRAPHICAL_TAGS = new Set([
  'circle',
  'ellipse',
  'line',
  'path',
  'polygon',
  'polyline',
  'rect',
  'stop',
  'text',
  'tspan',
  'use'
]);

const INLINE_STYLE_PROPS = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-dashoffset',
  'fill-opacity',
  'opacity',
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'stop-color'
] as const;

const PRESENTATION_ATTRS = new Set(['fill', 'stroke', 'stop-color', 'stroke-dasharray', 'stroke-dashoffset']);

// Hit-area paths: inlining stroke-width without a visible stroke renders as a solid highlight band.
const SKIP_INLINE_CLASSES = ['pf-topology__edge__background'];

const EDGE_GROUP_CLASS = 'pf-topology__edge';
const EDGE_LINK_CLASS = 'pf-topology__edge__link';

// PatternFly edge modifiers; used when animation resets computed dash styles to 0.
const EDGE_DASH_STYLES: Record<string, { strokeDasharray: string; strokeDashoffset: string }> = {
  'pf-m-dotted': { strokeDasharray: '2', strokeDashoffset: '2' },
  'pf-m-dashed': { strokeDasharray: '4 2', strokeDashoffset: '6' },
  'pf-m-dashed-md': { strokeDasharray: '8 2', strokeDashoffset: '10' },
  'pf-m-dashed-lg': { strokeDasharray: '16 2', strokeDashoffset: '18' },
  'pf-m-dashed-xl': { strokeDasharray: '32 2', strokeDashoffset: '34' }
};

type SavedSvgStyle = {
  element: SVGElement;
  attrs: Map<string, string | null>;
  styles: Map<string, string>;
};

type ExportableElement = HTMLElement | SVGSVGElement;

const isVisibleValue = (value: string): boolean =>
  !!value && value !== 'none' && value !== 'transparent' && value !== 'rgba(0, 0, 0, 0)';

const shouldSkipElement = (element: SVGElement): boolean =>
  SKIP_INLINE_CLASSES.some(className => element.classList.contains(className));

const shouldSkipPropertyOnElement = (element: Element, prop: string): boolean => {
  // Group-level fill/stroke is inherited by children and breaks edge link dashes in export.
  if (element.classList.contains(EDGE_GROUP_CLASS) && (prop === 'fill' || prop === 'stroke' || prop === 'color')) {
    return true;
  }
  return false;
};

const getEdgeDashStyles = (element: Element): { strokeDasharray: string; strokeDashoffset: string } | null => {
  for (const [className, styles] of Object.entries(EDGE_DASH_STYLES)) {
    if (element.classList.contains(className)) {
      return styles;
    }
  }
  return null;
};

const isZeroDashValue = (value: string): boolean => value === 'none' || value === '0' || value === '0px';

const hasVisibleStroke = (element: Element, computed: CSSStyleDeclaration): boolean =>
  isVisibleValue(resolveStyleValue(element, computed, 'stroke'));

const shouldInlineProperty = (
  element: Element,
  computed: CSSStyleDeclaration,
  prop: string,
  value: string
): boolean => {
  if (!value || value === 'initial' || value === 'inherit') {
    return false;
  }

  if (shouldSkipPropertyOnElement(element, prop)) {
    return false;
  }

  const isPresentationAttr = PRESENTATION_ATTRS.has(prop);

  if (prop === 'fill' && computed.getPropertyValue('fill-opacity') === '0') {
    return false;
  }

  if ((prop === 'stroke-width' || prop === 'stroke-opacity') && !hasVisibleStroke(element, computed)) {
    return false;
  }

  if (prop === 'stroke-dasharray' || prop === 'stroke-dashoffset') {
    return !isZeroDashValue(value);
  }

  return (
    prop === 'opacity' ||
    prop === 'color' ||
    prop === 'fill-opacity' ||
    prop.startsWith('font-') ||
    (isPresentationAttr && isVisibleValue(value)) ||
    (!isPresentationAttr && value !== 'none')
  );
};

const resolveStyleValue = (element: Element, computed: CSSStyleDeclaration, prop: string): string => {
  let value = computed.getPropertyValue(prop);
  if (prop === 'fill' && value.toLowerCase() === 'currentcolor') {
    value = computed.getPropertyValue('color');
    if (value.toLowerCase() === 'currentcolor' && element.parentElement) {
      value = window.getComputedStyle(element.parentElement).getPropertyValue('color');
    }
  }
  return value;
};

const applyEdgeLinkExportStyles = (element: SVGElement, entry: SavedSvgStyle): void => {
  if (!element.classList.contains(EDGE_LINK_CLASS)) {
    return;
  }

  if (!entry.attrs.has('fill')) {
    entry.attrs.set('fill', element.getAttribute('fill'));
  }
  element.setAttribute('fill', 'none');
  if (!entry.styles.has('fill')) {
    entry.styles.set('fill', element.style.getPropertyValue('fill'));
  }
  element.style.setProperty('fill', 'none');

  if (!entry.styles.has('fill-opacity')) {
    entry.styles.set('fill-opacity', element.style.getPropertyValue('fill-opacity'));
  }
  element.style.setProperty('fill-opacity', '0');

  const dashStyles = getEdgeDashStyles(element);
  if (!dashStyles) {
    return;
  }

  if (!entry.attrs.has('stroke-dasharray')) {
    entry.attrs.set('stroke-dasharray', element.getAttribute('stroke-dasharray'));
  }
  element.setAttribute('stroke-dasharray', dashStyles.strokeDasharray);
  if (!entry.styles.has('stroke-dasharray')) {
    entry.styles.set('stroke-dasharray', element.style.getPropertyValue('stroke-dasharray'));
  }
  element.style.setProperty('stroke-dasharray', dashStyles.strokeDasharray);

  if (!entry.attrs.has('stroke-dashoffset')) {
    entry.attrs.set('stroke-dashoffset', element.getAttribute('stroke-dashoffset'));
  }
  element.setAttribute('stroke-dashoffset', dashStyles.strokeDashoffset);
  if (!entry.styles.has('stroke-dashoffset')) {
    entry.styles.set('stroke-dashoffset', element.style.getPropertyValue('stroke-dashoffset'));
  }
  element.style.setProperty('stroke-dashoffset', dashStyles.strokeDashoffset);
};

const collectSvgElements = (root: Element): Element[] => {
  const elements = root instanceof SVGSVGElement || root.tagName.toLowerCase() === 'svg' ? [root] : [];
  return elements.concat(Array.from(root.querySelectorAll('svg, svg *')));
};

/**
 * html-to-image does not inline computed styles on SVG descendants, so CSS variables
 * (PatternFly theme tokens) are lost in exports. Inline resolved values temporarily.
 */
export const saveAndInlineSvgStyles = (root: Element): SavedSvgStyle[] => {
  const saved: SavedSvgStyle[] = [];

  for (const element of collectSvgElements(root)) {
    if (!(element instanceof SVGElement) || shouldSkipElement(element)) {
      continue;
    }

    const computed = window.getComputedStyle(element);
    const entry: SavedSvgStyle = { element, attrs: new Map(), styles: new Map() };
    let modified = false;
    const tag = element.tagName.toLowerCase();

    for (const prop of INLINE_STYLE_PROPS) {
      const value = resolveStyleValue(element, computed, prop);
      if (!shouldInlineProperty(element, computed, prop, value)) {
        continue;
      }

      const isPresentationAttr = PRESENTATION_ATTRS.has(prop);

      entry.styles.set(prop, element.style.getPropertyValue(prop));
      element.style.setProperty(prop, value);
      modified = true;

      if (isPresentationAttr && (SVG_GRAPHICAL_TAGS.has(tag) || tag === 'svg')) {
        entry.attrs.set(prop, element.getAttribute(prop));
        element.setAttribute(prop, value);
      }
    }

    if (element.classList.contains(EDGE_LINK_CLASS)) {
      applyEdgeLinkExportStyles(element, entry);
    }

    if (modified || entry.attrs.size > 0 || entry.styles.size > 0) {
      saved.push(entry);
    }
  }

  return saved;
};

export const restoreSvgStyles = (saved: SavedSvgStyle[]): void => {
  for (const { element, attrs, styles } of saved) {
    for (const [prop, value] of styles) {
      if (value) {
        element.style.setProperty(prop, value);
      } else {
        element.style.removeProperty(prop);
      }
    }
    for (const [attr, value] of attrs) {
      if (value === null) {
        element.removeAttribute(attr);
      } else {
        element.setAttribute(attr, value);
      }
    }
  }
};

const getExportDimensions = (element: ExportableElement): { width?: number; height?: number } => {
  const rect = element.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    return { width: rect.width, height: rect.height };
  }
  return {};
};

const CHART_CONTAINER_SELECTOR = '.metrics-content-div';
const LAYOUT_SIZE_TOLERANCE_PX = 20;
const DEFAULT_LAYOUT_QUIET_MS = 50;
const DEFAULT_LAYOUT_TIMEOUT_MS = 3000;

const getElementSize = (element: HTMLElement): { width: number; height: number } => {
  let width = element.clientWidth;
  let height = element.clientHeight;

  if (width <= 0 || height <= 0) {
    const rect = element.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
  }

  if (width <= 0 || height <= 0) {
    const style = window.getComputedStyle(element);
    width = parseFloat(style.width) || 0;
    height = parseFloat(style.height) || 0;
  }

  return { width, height };
};

const getSvgRenderedSize = (svg: SVGSVGElement): { width: number; height: number } => {
  const rect = svg.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    return { width: rect.width, height: rect.height };
  }

  const attrWidth = Number(svg.getAttribute('width'));
  const attrHeight = Number(svg.getAttribute('height'));
  if (attrWidth > 0 && attrHeight > 0) {
    return { width: attrWidth, height: attrHeight };
  }

  return { width: 0, height: 0 };
};

export const areChartsSizedForExport = (root: Element): boolean => {
  const charts = root.querySelectorAll(CHART_CONTAINER_SELECTOR);
  if (charts.length === 0) {
    return true;
  }

  return Array.from(charts).every(chart => {
    const container = chart as HTMLElement;
    const containerSize = getElementSize(container);
    if (containerSize.width <= 0 || containerSize.height <= 0) {
      return false;
    }

    const svg = container.querySelector('svg');
    if (!svg) {
      return false;
    }

    const svgSize = getSvgRenderedSize(svg);
    return (
      Math.abs(svgSize.width - containerSize.width) <= LAYOUT_SIZE_TOLERANCE_PX &&
      Math.abs(svgSize.height - containerSize.height) <= LAYOUT_SIZE_TOLERANCE_PX
    );
  });
};

const waitForNextPaint = (): Promise<void> =>
  new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });

/**
 * Wait for overview charts to finish resizing before capture.
 * Victory charts update one frame after their container ResizeObserver fires.
 */
export const waitForExportLayout = (
  root: Element | null | undefined,
  options?: { quietMs?: number; timeoutMs?: number; requireResize?: boolean }
): Promise<void> => {
  if (!root) {
    return Promise.resolve();
  }

  if (!options?.requireResize && areChartsSizedForExport(root)) {
    return waitForNextPaint();
  }

  const quietMs = options?.quietMs ?? DEFAULT_LAYOUT_QUIET_MS;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_LAYOUT_TIMEOUT_MS;

  return new Promise(resolve => {
    let finished = false;
    let readySince: number | null = null;
    let pollRaf = 0;

    const targets = Array.from(
      new Set([
        root,
        ...Array.from(root.querySelectorAll(`${CHART_CONTAINER_SELECTOR}, #overview-flex, #overview-graph-list`))
      ])
    );

    const finish = async () => {
      if (finished) {
        return;
      }
      finished = true;
      observers.forEach(observer => observer.disconnect());
      clearTimeout(timeoutTimer);
      cancelAnimationFrame(pollRaf);
      await waitForNextPaint();
      resolve();
    };

    const onLayoutChange = () => {
      readySince = null;
    };

    const poll = () => {
      if (finished) {
        return;
      }

      if (areChartsSizedForExport(root)) {
        if (readySince === null) {
          readySince = performance.now();
        }
        if (performance.now() - readySince >= quietMs) {
          void finish();
          return;
        }
      } else {
        readySince = null;
      }

      pollRaf = requestAnimationFrame(poll);
    };

    const observers = targets.map(target => {
      const observer = new ResizeObserver(onLayoutChange);
      observer.observe(target);
      return observer;
    });

    const timeoutTimer = setTimeout(() => {
      void finish();
    }, timeoutMs);

    pollRaf = requestAnimationFrame(poll);
  });
};

export const exportToPng = (
  name: string,
  element: ExportableElement | undefined,
  isDark?: boolean,
  id?: string,
  callback?: () => void
): Promise<void> => {
  if (element) {
    const savedStyles = saveAndInlineSvgStyles(element);
    const dimensions = getExportDimensions(element);

    // html-to-image typings only list HTMLElement, but SVGSVGElement is supported at runtime.
    return toPng(element as unknown as HTMLElement, {
      cacheBust: true,
      backgroundColor: isDark ? EXPORT_BACKGROUND.dark : EXPORT_BACKGROUND.light,
      ...dimensions
    })
      .then(dataUrl => {
        const link = document.createElement('a');
        if (id) {
          link.download = `${name}_${id}.png`;
        } else {
          link.download = `${name}.png`;
        }
        link.href = dataUrl;
        link.click();
      })
      .catch(err => {
        console.error(err);
      })
      .finally(() => {
        restoreSvgStyles(savedStyles);
        callback?.();
      });
  }

  console.error('exportToPng called but element is undefined');
  callback?.();
  return Promise.resolve();
};
