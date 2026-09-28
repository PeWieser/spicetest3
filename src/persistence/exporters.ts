// CircuitBench - Client-side exporters (SVG / PNG / PDF)
// No server round-trip: everything is produced in the browser so the app can
// run from a purely static Cloudflare Pages deployment.

import { downloadTextFile, safeFileName } from './local';

function serialiseSvg(svg: SVGSVGElement): string | null {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  // Bake the CSS custom properties in, otherwise the exported file has no colours.
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  const vars = ['--cb-canvas-bg', '--cb-grid', '--cb-grid-major', '--cb-wire', '--cb-component', '--cb-pin', '--cb-selection', '--cb-accent', '--cb-text-secondary'];
  const declared = vars.map(v => `${v}:${getComputedStyle(document.documentElement).getPropertyValue(v).trim()}`).join(';');
  style.textContent = `svg{${declared}}`;
  clone.insertBefore(style, clone.firstChild);

  // Replace var() references with resolved values
  const resolved = vars.reduce<Record<string, string>>((acc, v) => {
    acc[v] = getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#000';
    return acc;
  }, {});
  clone.querySelectorAll('*').forEach(el => {
    for (const attr of ['fill', 'stroke']) {
      const val = el.getAttribute(attr);
      if (val && val.startsWith('var(')) {
        const key = val.slice(4, -1).trim();
        if (resolved[key]) el.setAttribute(attr, resolved[key]);
      }
    }
  });

  const bbox = svg.getBBox();
  const pad = 20;
  clone.setAttribute('viewBox', `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`);
  clone.setAttribute('width', String(Math.round(bbox.width + pad * 2)));
  clone.setAttribute('height', String(Math.round(bbox.height + pad * 2)));
  clone.removeAttribute('class');

  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
}

export function exportSvg(svg: SVGSVGElement | null, name: string): boolean {
  if (!svg) return false;
  const data = serialiseSvg(svg);
  if (!data) return false;
  downloadTextFile(safeFileName(name, '.svg'), data, 'image/svg+xml;charset=utf-8');
  return true;
}

export function exportPng(svg: SVGSVGElement | null, name: string, scale = 2): Promise<boolean> {
  return new Promise(resolve => {
    if (!svg) return resolve(false);
    const data = serialiseSvg(svg);
    if (!data) return resolve(false);

    const bbox = svg.getBBox();
    const w = Math.max(1, Math.round((bbox.width + 40) * scale));
    const h = Math.max(1, Math.round((bbox.height + 40) * scale));

    const img = new Image();
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data)}`;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(false);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--cb-canvas-bg').trim() || '#fafafa';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        if (!blob) return resolve(false);
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = safeFileName(name, '.png');
        a.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        resolve(true);
      }, 'image/png');
    };
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

export function exportPdf(svg: SVGSVGElement | null, name: string): boolean {
  if (!svg || typeof window === 'undefined') return false;
  const data = serialiseSvg(svg);
  if (!data) return false;

  // Print pipeline -> "Save as PDF" is the native, dependency-free path.
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return false;
  const bbox = svg.getBBox();
  win.document.write(`<!doctype html><html><head><title>${name}</title>
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      body { margin: 0; font-family: -apple-system, system-ui, sans-serif; }
      h1 { font-size: 12pt; font-weight: 600; margin: 0 0 6pt; }
      svg { width: 100%; height: auto; }
    </style></head><body>
    <h1>${name}</h1>
    ${data.replace('<svg', '<svg style="width:100%;height:auto"')}
    <script>window.onload = () => setTimeout(() => window.print(), 250);<\/script>
    </body></html>`);
  win.document.close();
  void bbox;
  return true;
}

// ─── CSV export for simulation traces ──────────────────────────────────

export function buildTraceCsv(
  columns: { name: string; x: ArrayLike<number>; y: ArrayLike<number> }[],
): string {
  if (columns.length === 0) return '';
  const len = Math.max(...columns.map(c => c.x.length));
  const single = columns.length === 1;
  const header = single
    ? ['t', columns[0].name]
    : columns.flatMap((c, i) => [`t_${i}_${c.name}`, c.name]);
  const rows: string[] = [header.join(',')];

  for (let i = 0; i < len; i++) {
    const row = single
      ? [String(columns[0].x[i]), String(columns[0].y[i])]
      : columns.flatMap(c => [String(c.x[i]), String(c.y[i])]);
    rows.push(row.join(','));
  }
  return rows.join('\n');
}
