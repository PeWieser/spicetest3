// CircuitBench Utilities - Value parsing, coordinate math, transforms

import type { Point, Transform, Orientation } from './types';

// ─── Engineering Value Parsing ──────────────────────────────────────────

const PREFIX_MAP: Record<string, number> = {
  'f': 1e-15, 'p': 1e-12, 'n': 1e-9, 'u': 1e-6, 'µ': 1e-6,
  'm': 1e-3, '': 1, 'k': 1e3, 'K': 1e3, 'meg': 1e6, 'M': 1e6,
  'G': 1e9, 'T': 1e12,
};

export function parseValue(str: string): number {
  if (!str) return 0;
  const s = str.trim();
  const num = parseFloat(s);
  if (!isNaN(num) && String(num).length === s.length) return num;

  for (const [prefix, mult] of Object.entries(PREFIX_MAP).sort((a, b) => b[0].length - a[0].length)) {
    if (prefix && s.endsWith(prefix)) {
      const n = parseFloat(s.slice(0, -prefix.length));
      if (!isNaN(n)) return n * mult;
    }
  }
  const parsed = parseFloat(s);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatValue(value: number, unit?: string, precision: number = 3): string {
  if (value === 0) return `0${unit ? unit : ''}`;
  const absVal = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  const thresholds: [number, string][] = [
    [1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'],
    [1, ''], [1e-3, 'm'], [1e-6, 'u'], [1e-9, 'n'],
    [1e-12, 'p'], [1e-15, 'f'],
  ];

  for (const [threshold, prefix] of thresholds) {
    if (absVal >= threshold) {
      const scaled = absVal / threshold;
      const formatted = scaled.toFixed(precision).replace(/\.?0+$/, '');
      return `${sign}${formatted}${prefix}${unit || ''}`;
    }
  }
  return `${sign}${absVal.toExponential(precision)}${unit || ''}`;
}

// ─── Coordinate Transforms ─────────────────────────────────────────────

const GRID_SIZE = 10; // base grid in schematic units

export function snapToGrid(val: number, gridSize: number = GRID_SIZE): number {
  return Math.round(val / gridSize) * gridSize;
}

export function snapPoint(p: Point, gridSize: number = GRID_SIZE): Point {
  return { x: snapToGrid(p.x, gridSize), y: snapToGrid(p.y, gridSize) };
}

export function rotatePoint(p: Point, origin: Point, angle: Orientation): Point {
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: origin.x + Math.round(dx * cos - dy * sin),
    y: origin.y + Math.round(dx * sin + dy * cos),
  };
}

export function mirrorPoint(p: Point, origin: Point, axis: 'horizontal' | 'vertical'): Point {
  if (axis === 'horizontal') {
    return { x: p.x, y: 2 * origin.y - p.y };
  }
  return { x: 2 * origin.x - p.x, y: p.y };
}

export function transformPoint(p: Point, origin: Point, transform: Transform): Point {
  let pt = { ...p };
  pt = rotatePoint(pt, { x: 0, y: 0 }, transform.orientation);
  if (transform.mirror === 'horizontal') {
    pt = { x: pt.x, y: -pt.y };
  } else if (transform.mirror === 'vertical') {
    pt = { x: -pt.x, y: pt.y };
  }
  return { x: origin.x + pt.x, y: origin.y + pt.y };
}

export function getAbsolutePinPosition(
  relPin: Point,
  compPos: Point,
  transform: Transform
): Point {
  return transformPoint(relPin, compPos, transform);
}

// ─── Geometry ──────────────────────────────────────────────────────────

export function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function manhattanDistance(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function pointOnSegment(p: Point, a: Point, b: Point, tolerance: number = 5): boolean {
  const d = distance(a, b);
  const d1 = distance(p, a);
  const d2 = distance(p, b);
  return Math.abs(d1 + d2 - d) < tolerance;
}

export function rectContainsPoint(rect: { x: number; y: number; w: number; h: number }, p: Point): boolean {
  return p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;
}

export function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function boundingBox(points: Point[]): { x: number; y: number; w: number; h: number } {
  if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// ─── Orthogonal Routing ────────────────────────────────────────────────

export function routeOrthogonal(from: Point, to: Point): Point[] {
  const s = snapPoint(from);
  const e = snapPoint(to);
  
  if (s.x === e.x || s.y === e.y) {
    return [s, e];
  }
  
  // L-shaped routing: go horizontal first, then vertical
  return [s, { x: e.x, y: s.y }, e];
}

// ─── Unique ID generation ──────────────────────────────────────────────

let idCounter = 0;
export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${++idCounter}`;
}

// ─── Color Assignment for Probes/Traces ─────────────────────────────────

const TRACE_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c',
  '#0891b2', '#be185d', '#65a30d', '#7c3aed', '#0284c7',
];

export function getTraceColor(index: number): string {
  return TRACE_COLORS[index % TRACE_COLORS.length];
}

// ─── Unit Labels ───────────────────────────────────────────────────────

export function unitForAnalysis(analysisType: string, signal: string): { xUnit: string; yUnit: string } {
  switch (analysisType) {
    case 'transient':
      return { xUnit: 's', yUnit: signal.startsWith('I') ? 'A' : 'V' };
    case 'ac':
      return { xUnit: 'Hz', yUnit: signal.startsWith('I') ? 'A' : 'V' };
    case 'dcSweep':
    case 'paramSweep':
      return { xUnit: 'V', yUnit: signal.startsWith('I') ? 'A' : 'V' };
    case 'op':
      return { xUnit: '', yUnit: signal.startsWith('I') ? 'A' : 'V' };
    default:
      return { xUnit: '', yUnit: '' };
  }
}