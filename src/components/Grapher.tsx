'use client';
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useProjectStore } from '@/store/project-store';
import type { SimTrace } from '@/circuit/types';
import { formatValue } from '@/circuit/utils';

interface CursorInfo {
  traceIdx: number;
  x: number;
  y: number;
  index: number;
}

export default function Grapher() {
  const store = useProjectStore();
  const { simResults, currentResultId } = store;
  const currentResult = simResults.find(r => r.id === currentResultId);
  const svgRef = useRef<SVGSVGElement>(null);

  const [visibleTraces, setVisibleTraces] = useState<Set<string>>(new Set());
  const [plotArea, setPlotArea] = useState({ left: 60, right: 20, top: 20, bottom: 40 });
  const [xLog, setXLog] = useState(false);
  const [yLog, setYLog] = useState(false);
  const [cursor1, setCursor1] = useState<CursorInfo | null>(null);
  const [cursor2, setCursor2] = useState<CursorInfo | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; values: { name: string; value: number; color: string }[] } | null>(null);
  const [autoScale, setAutoScale] = useState(true);

  // Initialize visible traces
  useEffect(() => {
    if (currentResult) {
      setVisibleTraces(new Set(currentResult.traces.map(t => t.id)));
    }
  }, [currentResultId]);

  if (!currentResult || currentResult.traces.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--cb-surface)]">
        <div className="text-sm text-[var(--cb-text-muted)]">
          No simulation results to display. Run a simulation first.
        </div>
      </div>
    );
  }

  const traces = currentResult.traces.filter(t => visibleTraces.has(t.id));
  const width = 800;
  const height = 400;
  const plotW = width - plotArea.left - plotArea.right;
  const plotH = height - plotArea.top - plotArea.bottom;

  // Calculate data bounds
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (const trace of traces) {
    for (let i = 0; i < trace.xData.length; i++) {
      const x = trace.xData[i];
      const y = trace.yData[i];
      if (isFinite(x)) { xMin = Math.min(xMin, x); xMax = Math.max(xMax, x); }
      if (isFinite(y)) { yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); }
    }
  }

  if (!isFinite(xMin)) { xMin = 0; xMax = 1; }
  if (!isFinite(yMin)) { yMin = -1; yMax = 1; }

  // Add margins
  const yRange = yMax - yMin || 1;
  yMin -= yRange * 0.05;
  yMax += yRange * 0.05;

  // Scale functions
  const scaleX = (x: number) => plotArea.left + ((x - xMin) / (xMax - xMin || 1)) * plotW;
  const scaleY = (y: number) => plotArea.top + plotH - ((y - yMin) / (yMax - yMin || 1)) * plotH;
  const invScaleX = (px: number) => xMin + ((px - plotArea.left) / plotW) * (xMax - xMin);

  // Generate axis ticks
  const generateTicks = (min: number, max: number, count: number): number[] => {
    const step = (max - min) / count;
    const ticks: number[] = [];
    for (let i = 0; i <= count; i++) {
      ticks.push(min + i * step);
    }
    return ticks;
  };

  const xTicks = generateTicks(xMin, xMax, 8);
  const yTicks = generateTicks(yMin, yMax, 6);

  // Mouse move for hover
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = (e.clientX - rect.left) / (rect.width / width);
    const py = (e.clientY - rect.top) / (rect.height / height);

    if (px < plotArea.left || px > width - plotArea.right) {
      setHoverInfo(null);
      return;
    }

    const xVal = invScaleX(px);
    const values: { name: string; value: number; color: string }[] = [];

    for (const trace of traces) {
      // Find nearest point
      let nearestIdx = 0;
      let nearestDist = Infinity;
      for (let i = 0; i < trace.xData.length; i++) {
        const d = Math.abs(trace.xData[i] - xVal);
        if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
      }
      values.push({ name: trace.name, value: trace.yData[nearestIdx], color: trace.color });
    }

    setHoverInfo({ x: px, y: py, values });
  }, [traces, plotArea, invScaleX]);

  // Toggle trace visibility
  const toggleTrace = (traceId: string) => {
    setVisibleTraces(prev => {
      const next = new Set(prev);
      next.has(traceId) ? next.delete(traceId) : next.add(traceId);
      return next;
    });
  };

  // Calculate measurements
  const computeMeasurements = (trace: SimTrace) => {
    let min = Infinity, max = -Infinity, sum = 0, sumSq = 0;
    for (let i = 0; i < trace.yData.length; i++) {
      const v = trace.yData[i];
      min = Math.min(min, v);
      max = Math.max(max, v);
      sum += v;
      sumSq += v * v;
    }
    const n = trace.yData.length;
    const avg = sum / n;
    const rms = Math.sqrt(sumSq / n);
    return { min, max, avg, rms, peakToPeak: max - min };
  };

  return (
    <div className="h-full flex flex-col bg-[var(--cb-surface)]">
      {/* Grapher toolbar */}
      <div className="flex items-center h-8 px-2 border-b border-[var(--cb-border)] gap-2 text-xs">
        <span className="font-semibold text-[var(--cb-text-secondary)]">Grapher</span>
        <div className="toolbar-sep" />
        <button className={`toolbar-btn text-[10px] ${autoScale ? 'active' : ''}`} onClick={() => setAutoScale(!autoScale)}>Auto</button>
        <button className={`toolbar-btn text-[10px] ${xLog ? 'active' : ''}`} onClick={() => setXLog(!xLog)}>Log X</button>
        <button className={`toolbar-btn text-[10px] ${yLog ? 'active' : ''}`} onClick={() => setYLog(!yLog)}>Log Y</button>
        <div className="toolbar-sep" />
        <span className="text-[var(--cb-text-muted)]">
          {currentResult.analysisType} | {traces.length} trace{traces.length !== 1 ? 's' : ''}
        </span>
        <div className="flex-1" />
        <button className="toolbar-btn text-[10px]" onClick={() => {
          // Export CSV
          if (traces.length === 0) return;
          let csv = traces.map(t => t.name).join(',') + '\n';
          const maxLen = Math.max(...traces.map(t => t.xData.length));
          for (let i = 0; i < maxLen; i++) {
            const row = traces.map(t => {
              const x = t.xData[i] ?? '';
              const y = t.yData[i] ?? '';
              return `${x},${y}`;
            });
            csv += row.join(',') + '\n';
          }
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'simulation_results.csv'; a.click();
          URL.revokeObjectURL(url);
        }}>Export CSV</button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Plot area */}
        <div className="flex-1 p-2">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-full border border-[var(--cb-border)] rounded bg-white"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverInfo(null)}
          >
            {/* Grid */}
            {xTicks.map((t, i) => (
              <g key={`x-${i}`}>
                <line x1={scaleX(t)} y1={plotArea.top} x2={scaleX(t)} y2={plotArea.top + plotH} stroke="#f0f0f0" strokeWidth="0.5" />
                <text x={scaleX(t)} y={height - plotArea.bottom + 14} textAnchor="middle" fontSize="9" fill="#999">
                  {formatAxisValue(t)}
                </text>
              </g>
            ))}
            {yTicks.map((t, i) => (
              <g key={`y-${i}`}>
                <line x1={plotArea.left} y1={scaleY(t)} x2={plotArea.left + plotW} y2={scaleY(t)} stroke="#f0f0f0" strokeWidth="0.5" />
                <text x={plotArea.left - 4} y={scaleY(t) + 3} textAnchor="end" fontSize="9" fill="#999">
                  {formatAxisValue(t)}
                </text>
              </g>
            ))}

            {/* Plot border */}
            <rect x={plotArea.left} y={plotArea.top} width={plotW} height={plotH} fill="none" stroke="#ddd" strokeWidth="0.5" />

            {/* Traces */}
            {traces.map(trace => {
              const points: string[] = [];
              for (let i = 0; i < trace.xData.length; i++) {
                const x = scaleX(trace.xData[i]);
                const y = scaleY(trace.yData[i]);
                points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
              }
              return (
                <path
                  key={trace.id}
                  d={points.join(' ')}
                  fill="none"
                  stroke={trace.color}
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              );
            })}

            {/* Cursor lines */}
            {hoverInfo && (
              <g>
                <line x1={hoverInfo.x} y1={plotArea.top} x2={hoverInfo.x} y2={plotArea.top + plotH} stroke="#888" strokeWidth="0.5" strokeDasharray="3 3" />
                {hoverInfo.values.map((v, i) => {
                  const trace = traces.find(t => t.name === v.name);
                  if (!trace) return null;
                  let nearestIdx = 0;
                  let nearestDist = Infinity;
                  for (let j = 0; j < trace.xData.length; j++) {
                    const d = Math.abs(trace.xData[j] - invScaleX(hoverInfo.x));
                    if (d < nearestDist) { nearestDist = d; nearestIdx = j; }
                  }
                  return (
                    <circle key={i} cx={scaleX(trace.xData[nearestIdx])} cy={scaleY(trace.yData[nearestIdx])} r="3" fill={v.color} stroke="white" strokeWidth="1" />
                  );
                })}
              </g>
            )}

            {/* Axis labels */}
            <text x={plotArea.left + plotW / 2} y={height - 4} textAnchor="middle" fontSize="10" fill="#666">
              {traces[0]?.xUnit || ''}
            </text>
            <text x={14} y={plotArea.top + plotH / 2} textAnchor="middle" fontSize="10" fill="#666" transform={`rotate(-90, 14, ${plotArea.top + plotH / 2})`}>
              {traces[0]?.yUnit || ''}
            </text>
          </svg>
        </div>

        {/* Legend & Measurements */}
        <div className="w-64 border-l border-[var(--cb-border)] overflow-y-auto text-xs">
          {/* Legend */}
          <div className="p-2 border-b border-[var(--cb-border)]">
            <div className="font-semibold text-[var(--cb-text-secondary)] mb-1">Traces</div>
            {currentResult.traces.map(trace => (
              <div key={trace.id} className="flex items-center gap-2 py-0.5 cursor-pointer hover:bg-[var(--cb-surface-alt)]"
                onClick={() => toggleTrace(trace.id)}>
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: visibleTraces.has(trace.id) ? trace.color : '#ccc' }}
                />
                <span className={`truncate ${visibleTraces.has(trace.id) ? '' : 'line-through text-[var(--cb-text-muted)]'}`}>
                  {trace.name}
                </span>
              </div>
            ))}
          </div>

          {/* Measurements */}
          <div className="p-2">
            <div className="font-semibold text-[var(--cb-text-secondary)] mb-1">Measurements</div>
            {traces.map(trace => {
              const m = computeMeasurements(trace);
              return (
                <div key={trace.id} className="mb-2">
                  <div className="font-medium" style={{ color: trace.color }}>{trace.name}</div>
                  <div className="grid grid-cols-2 gap-x-2 mono text-[11px] text-[var(--cb-text-muted)]">
                    <span>Min:</span><span>{m.min.toPrecision(4)}</span>
                    <span>Max:</span><span>{m.max.toPrecision(4)}</span>
                    <span>Avg:</span><span>{m.avg.toPrecision(4)}</span>
                    <span>RMS:</span><span>{m.rms.toPrecision(4)}</span>
                    <span>Vpp:</span><span>{m.peakToPeak.toPrecision(4)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hover info */}
          {hoverInfo && (
            <div className="p-2 border-t border-[var(--cb-border)] bg-[var(--cb-surface-alt)]">
              <div className="font-semibold text-[var(--cb-text-secondary)] mb-1">Cursor</div>
              <div className="mono text-[11px]">
                X = {invScaleX(hoverInfo.x).toPrecision(4)}
              </div>
              {hoverInfo.values.map((v, i) => (
                <div key={i} className="mono text-[11px]" style={{ color: v.color }}>
                  {v.name} = {v.value.toPrecision(4)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatAxisValue(val: number): string {
  if (Math.abs(val) === 0) return '0';
  if (Math.abs(val) >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
  if (Math.abs(val) >= 1e3) return `${(val / 1e3).toFixed(1)}k`;
  if (Math.abs(val) >= 1) return val.toFixed(2);
  if (Math.abs(val) >= 1e-3) return `${(val * 1e3).toFixed(1)}m`;
  if (Math.abs(val) >= 1e-6) return `${(val * 1e6).toFixed(1)}u`;
  if (Math.abs(val) >= 1e-9) return `${(val * 1e9).toFixed(1)}n`;
  return val.toExponential(1);
}