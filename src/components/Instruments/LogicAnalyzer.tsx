'use client';
import React, { useState, useCallback } from 'react';
import { useProjectStore } from '@/store/project-store';

interface Props {
  onClose: () => void;
  position: { x: number; y: number };
  onMove: (pos: { x: number; y: number }) => void;
}

export default function LogicAnalyzer({ onClose, position, onMove }: Props) {
  const store = useProjectStore();
  const [numChannels, setNumChannels] = useState(8);
  const [displayMode, setDisplayMode] = useState<'binary' | 'hex' | 'decimal'>('binary');
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const { simResults, currentResultId } = store;
  const currentResult = simResults.find(r => r.id === currentResultId);

  // Generate logic data from traces
  const getChannelData = (chIdx: number): boolean[] => {
    const trace = currentResult?.traces[chIdx];
    if (!trace) return [];
    return Array.from(trace.yData).map(v => v > 2.5); // TTL threshold
  };

  const plotW = 500;
  const chH = 20;
  const plotH = numChannels * chH;

  return (
    <div
      className="instrument-window"
      style={{ left: position.x, top: position.y, width: 560 }}
      onMouseMove={e => { if (isDragging) onMove({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y }); }}
      onMouseUp={() => setIsDragging(false)}
    >
      <div className="instrument-titlebar" onMouseDown={e => { setIsDragging(true); setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y }); }}>
        <span className="flex-1">Logic Analyzer</span>
        <button className="toolbar-btn w-5 h-5 text-[10px]" onClick={onClose}>✕</button>
      </div>

      <div className="p-3 space-y-2">
        {/* Display */}
        <div className="flex">
          {/* Channel labels */}
          <div className="w-16 flex-shrink-0">
            {Array.from({ length: numChannels }, (_, i) => (
              <div key={i} className="text-[10px] mono text-right pr-2" style={{ height: chH, lineHeight: `${chH}px` }}>
                CH{i}
              </div>
            ))}
          </div>

          {/* Waveform display */}
          <svg viewBox={`0 0 ${plotW} ${plotH}`} className="flex-1 border border-[var(--cb-border)] rounded bg-[#0a0a14]">
            {/* Channel backgrounds */}
            {Array.from({ length: numChannels }, (_, i) => (
              <rect key={i} x={0} y={i * chH} width={plotW} height={chH} fill={i % 2 === 0 ? '#0a0a14' : '#0d0d1a'} />
            ))}

            {/* Channel waveforms */}
            {Array.from({ length: numChannels }, (_, chIdx) => {
              const data = getChannelData(chIdx);
              if (data.length === 0) return null;

              const points: string[] = [];
              const sampleW = plotW / data.length;

              for (let i = 0; i < data.length; i++) {
                const x = i * sampleW;
                const yHigh = chIdx * chH + 3;
                const yLow = (chIdx + 1) * chH - 3;
                const y = data[i] ? yHigh : yLow;
                points.push(`L ${x} ${y}`);
                points.push(`L ${x + sampleW} ${y}`);
              }

              // Add transitions
              const pathParts: string[] = [];
              let prevHigh = data[0];
              for (let i = 0; i < data.length; i++) {
                const x = i * sampleW;
                const yHigh = chIdx * chH + 3;
                const yLow = (chIdx + 1) * chH - 3;
                if (i === 0) {
                  pathParts.push(`M ${x} ${data[i] ? yHigh : yLow}`);
                }
                if (i > 0 && data[i] !== prevHigh) {
                  // Draw transition line
                  pathParts.push(`L ${x} ${prevHigh ? yLow : yHigh}`);
                  prevHigh = data[i];
                }
                const y = data[i] ? yHigh : yLow;
                pathParts.push(`L ${x + sampleW} ${y}`);
              }

              return (
                <path key={chIdx} d={pathParts.join(' ')} fill="none" stroke="#22c55e" strokeWidth="1.5" />
              );
            })}

            {/* Grid lines */}
            {Array.from({ length: numChannels }, (_, i) => (
              <line key={i} x1={0} y1={i * chH} x2={plotW} y2={i * chH} stroke="#1a1a2e" strokeWidth="0.5" />
            ))}
          </svg>
        </div>

        {/* Controls */}
        <div className="flex gap-2 text-xs">
          <div>
            <label className="text-[var(--cb-text-muted)]">Channels</label>
            <select className="text-xs" value={numChannels} onChange={e => setNumChannels(Number(e.target.value))}>
              {[4, 8, 16, 32].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[var(--cb-text-muted)]">Display</label>
            <select className="text-xs" value={displayMode} onChange={e => setDisplayMode(e.target.value as any)}>
              <option value="binary">Binary</option>
              <option value="hex">Hex</option>
              <option value="decimal">Decimal</option>
            </select>
          </div>
          <div className="flex-1" />
          <button className="text-xs px-2 py-0.5 rounded bg-[var(--cb-accent)] text-white" onClick={() => store.runSim()}>
            Capture
          </button>
        </div>

        {/* Data display */}
        {currentResult && (
          <div className="bg-[var(--cb-surface-alt)] rounded p-2 text-xs mono overflow-x-auto">
            <div className="text-[var(--cb-text-muted)] mb-1">Channel Data</div>
            {Array.from({ length: Math.min(numChannels, currentResult.traces.length) }, (_, i) => {
              const trace = currentResult.traces[i];
              if (!trace) return null;
              const lastVal = trace.yData[trace.yData.length - 1];
              const isHigh = lastVal > 2.5;
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-8 text-[var(--cb-text-muted)]">CH{i}</span>
                  <span className={`w-4 h-4 rounded-sm ${isHigh ? 'bg-[var(--cb-success)]' : 'bg-[var(--cb-border)]'}`} />
                  <span>{isHigh ? '1' : '0'}</span>
                  <span className="text-[var(--cb-text-muted)]">{lastVal.toFixed(2)}V</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}