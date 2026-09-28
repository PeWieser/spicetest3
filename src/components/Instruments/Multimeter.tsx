'use client';
import React, { useState, useCallback } from 'react';
import { useProjectStore } from '@/store/project-store';
import { formatValue } from '@/circuit/utils';

interface Props {
  onClose: () => void;
  position: { x: number; y: number };
  onMove: (pos: { x: number; y: number }) => void;
}

type MeasureMode = 'DCV' | 'ACV' | 'DCI' | 'ACI' | 'R' | 'Freq';

export default function Multimeter({ onClose, position, onMove }: Props) {
  const store = useProjectStore();
  const [mode, setMode] = useState<MeasureMode>('DCV');
  const [autoRange, setAutoRange] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const { simResults, currentResultId } = store;
  const currentResult = simResults.find(r => r.id === currentResultId);

  // Get measurement value
  const getReading = (): string => {
    if (!currentResult) return '---';
    const traces = currentResult.traces;
    const measurements = currentResult.measurements;

    if (mode === 'DCV' || mode === 'ACV') {
      // Get first voltage trace
      const vTrace = traces.find(t => t.name.startsWith('V('));
      if (!vTrace) return '---';
      if (mode === 'DCV') {
        const last = vTrace.yData[vTrace.yData.length - 1];
        return last.toPrecision(5);
      }
      // AC: compute RMS
      let sumSq = 0;
      const mean = vTrace.yData.reduce((s, v) => s + v, 0) / vTrace.yData.length;
      for (let i = 0; i < vTrace.yData.length; i++) {
        sumSq += (vTrace.yData[i] - mean) ** 2;
      }
      return Math.sqrt(sumSq / vTrace.yData.length).toPrecision(5);
    }

    if (mode === 'DCI' || mode === 'ACI') {
      const iTrace = traces.find(t => t.name.startsWith('I('));
      if (!iTrace) return '---';
      const last = iTrace.yData[iTrace.yData.length - 1];
      return last.toPrecision(5);
    }

    if (Object.keys(measurements).length > 0) {
      const first = Object.values(measurements)[0];
      return typeof first === 'number' ? first.toPrecision(5) : '---';
    }

    return '---';
  };

  const getUnit = (): string => {
    switch (mode) {
      case 'DCV': case 'ACV': return 'V';
      case 'DCI': case 'ACI': return 'A';
      case 'R': return 'Ω';
      case 'Freq': return 'Hz';
    }
  };

  const reading = getReading();
  const unit = getUnit();

  return (
    <div
      className="instrument-window"
      style={{ left: position.x, top: position.y, width: 280 }}
      onMouseMove={e => { if (isDragging) onMove({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y }); }}
      onMouseUp={() => setIsDragging(false)}
    >
      <div className="instrument-titlebar" onMouseDown={e => { setIsDragging(true); setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y }); }}>
        <span className="flex-1">Digital Multimeter</span>
        <button className="toolbar-btn w-5 h-5 text-[10px]" onClick={onClose}>✕</button>
      </div>

      <div className="p-3 space-y-3">
        {/* Display */}
        <div className="bg-[#0a0a14] rounded-lg p-4 text-center">
          <div className="text-[10px] text-[#666] mb-1">{mode === 'DCV' ? 'DC VOLTAGE' : mode === 'ACV' ? 'AC VOLTAGE' : mode === 'DCI' ? 'DC CURRENT' : mode === 'ACI' ? 'AC CURRENT' : mode === 'R' ? 'RESISTANCE' : 'FREQUENCY'}</div>
          <div className="text-3xl font-mono text-[#22c55e] tracking-wider">
            {reading === '---' ? '---' : formatValue(parseFloat(reading))}
          </div>
          <div className="text-xs text-[#666] mt-1">{unit}{autoRange ? ' (Auto)' : ''}</div>
        </div>

        {/* Mode selection */}
        <div className="grid grid-cols-3 gap-1">
          {(['DCV', 'ACV', 'DCI', 'ACI', 'R', 'Freq'] as MeasureMode[]).map(m => (
            <button
              key={m}
              className={`text-xs py-2 rounded font-medium ${
                mode === m
                  ? 'bg-[var(--cb-accent)] text-white'
                  : 'bg-[var(--cb-surface-alt)] border border-[var(--cb-border)] hover:bg-[var(--cb-border)]'
              }`}
              onClick={() => setMode(m)}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Options */}
        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={autoRange} onChange={e => setAutoRange(e.target.checked)} />
            Auto Range
          </label>
          <button className="ml-auto text-xs px-2 py-0.5 rounded border border-[var(--cb-border)]" onClick={() => store.runSim()}>
            Refresh
          </button>
        </div>

        {/* Source selection */}
        <div className="text-xs">
          <div className="text-[var(--cb-text-muted)] mb-1">Source</div>
          <select className="w-full text-xs">
            <option value="">Auto-detect from circuit</option>
            {currentResult?.traces.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}