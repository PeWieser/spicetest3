'use client';
import React, { useState, useCallback } from 'react';
import { useProjectStore } from '@/store/project-store';
import { formatValue } from '@/circuit/utils';

interface Props {
  onClose: () => void;
  position: { x: number; y: number };
  onMove: (pos: { x: number; y: number }) => void;
}

type Waveform = 'sine' | 'square' | 'triangle' | 'sawtooth' | 'dc';

export default function FunctionGenerator({ onClose, position, onMove }: Props) {
  const store = useProjectStore();
  const [waveform, setWaveform] = useState<Waveform>('sine');
  const [frequency, setFrequency] = useState(1000);
  const [amplitude, setAmplitude] = useState(5);
  const [offset, setOffset] = useState(0);
  const [dutyCycle, setDutyCycle] = useState(50);
  const [phase, setPhase] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleTitleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [position]);

  // Generate waveform preview
  const previewPoints: string[] = [];
  const previewW = 200;
  const previewH = 60;
  const nPoints = 200;

  for (let i = 0; i < nPoints; i++) {
    const t = (i / nPoints) * 2 * Math.PI;
    let y = 0;
    switch (waveform) {
      case 'sine':
        y = Math.sin(t + (phase * Math.PI / 180));
        break;
      case 'square':
        y = (t % (2 * Math.PI)) < Math.PI ? 1 : -1;
        break;
      case 'triangle':
        y = 2 * Math.abs(2 * ((t / (2 * Math.PI)) % 1) - 1) - 1;
        break;
      case 'sawtooth':
        y = 2 * ((t / (2 * Math.PI)) % 1) - 1;
        break;
      case 'dc':
        y = 0;
        break;
    }
    y = offset + amplitude * y;
    const px = (i / nPoints) * previewW;
    const py = previewH / 2 - (y / (amplitude * 2 + Math.abs(offset) + 0.1)) * (previewH / 2 - 5);
    previewPoints.push(`${i === 0 ? 'M' : 'L'} ${px} ${py}`);
  }

  return (
    <div
      className="instrument-window"
      style={{ left: position.x, top: position.y, width: 320 }}
      onMouseMove={e => { if (isDragging) onMove({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y }); }}
      onMouseUp={() => setIsDragging(false)}
    >
      <div className="instrument-titlebar" onMouseDown={handleTitleMouseDown}>
        <span className="flex-1">Function Generator</span>
        <button className="toolbar-btn w-5 h-5 text-[10px]" onClick={onClose}>✕</button>
      </div>

      <div className="p-3 space-y-3">
        {/* Waveform preview */}
        <svg viewBox={`0 0 ${previewW} ${previewH}`} className="w-full border border-[var(--cb-border)] rounded bg-[#0a0a14]">
          <line x1={0} y1={previewH / 2} x2={previewW} y2={previewH / 2} stroke="#1a1a2e" strokeWidth="0.5" />
          <path d={previewPoints.join(' ')} fill="none" stroke="#22c55e" strokeWidth="1.5" />
        </svg>

        {/* Waveform selection */}
        <div className="flex gap-1">
          {(['sine', 'square', 'triangle', 'sawtooth', 'dc'] as Waveform[]).map(wf => (
            <button
              key={wf}
              className={`flex-1 text-xs py-1 rounded border ${
                waveform === wf
                  ? 'bg-[var(--cb-accent)] text-white border-[var(--cb-accent)]'
                  : 'border-[var(--cb-border)] hover:bg-[var(--cb-surface-alt)]'
              }`}
              onClick={() => setWaveform(wf)}
            >
              {wf === 'sine' ? '~' : wf === 'square' ? '⊓' : wf === 'triangle' ? '△' : wf === 'sawtooth' ? '⟋' : '—'}
              <div className="text-[9px] capitalize">{wf}</div>
            </button>
          ))}
        </div>

        {/* Parameters */}
        <div className="space-y-2 text-xs">
          <div className="prop-row">
            <span className="prop-label">Frequency</span>
            <div className="prop-value flex items-center gap-1">
              <input type="number" className="flex-1 mono" value={frequency}
                onChange={e => setFrequency(Number(e.target.value))} step="100" />
              <span className="text-[var(--cb-text-muted)]">Hz</span>
            </div>
          </div>

          <div className="prop-row">
            <span className="prop-label">Amplitude</span>
            <div className="prop-value flex items-center gap-1">
              <input type="number" className="flex-1 mono" value={amplitude}
                onChange={e => setAmplitude(Number(e.target.value))} step="0.5" />
              <span className="text-[var(--cb-text-muted)]">Vpk</span>
            </div>
          </div>

          <div className="prop-row">
            <span className="prop-label">DC Offset</span>
            <div className="prop-value flex items-center gap-1">
              <input type="number" className="flex-1 mono" value={offset}
                onChange={e => setOffset(Number(e.target.value))} step="0.5" />
              <span className="text-[var(--cb-text-muted)]">V</span>
            </div>
          </div>

          <div className="prop-row">
            <span className="prop-label">Phase</span>
            <div className="prop-value flex items-center gap-1">
              <input type="number" className="flex-1 mono" value={phase}
                onChange={e => setPhase(Number(e.target.value))} step="15" />
              <span className="text-[var(--cb-text-muted)]">°</span>
            </div>
          </div>

          {waveform === 'square' && (
            <div className="prop-row">
              <span className="prop-label">Duty Cycle</span>
              <div className="prop-value flex items-center gap-1">
                <input type="range" className="flex-1" min={1} max={99} value={dutyCycle}
                  onChange={e => setDutyCycle(Number(e.target.value))} />
                <span className="mono w-8 text-right">{dutyCycle}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Output info */}
        <div className="bg-[var(--cb-surface-alt)] rounded p-2 text-xs">
          <div className="text-[var(--cb-text-muted)] mb-1">Output</div>
          <div className="mono space-y-0.5">
            <div>Frequency: {formatValue(frequency, 'Hz')}</div>
            <div>Amplitude: {amplitude} Vpk</div>
            <div>Vpp: {(amplitude * 2).toFixed(1)} V</div>
            <div>Vrms: {(amplitude / Math.sqrt(2)).toFixed(2)} V</div>
          </div>
        </div>

        {/* Set source in simulation */}
        <button
          className="w-full text-xs py-1.5 bg-[var(--cb-accent)] text-white rounded"
          onClick={() => {
            // Find the first sine source or voltage source and update its params
            const sheet = store.getCurrentSheet();
            const src = sheet.components.find(c => c.symbolId === 'sine_source' || c.symbolId === 'voltage_source');
            if (src) {
              store.updateComponentProperty(src.id, 'frequency', String(frequency));
              store.updateComponentProperty(src.id, 'amplitude', String(amplitude));
              store.updateComponentProperty(src.id, 'offset', String(offset));
              store.updateComponentProperty(src.id, 'phase', String(phase));
            }
          }}
        >
          Apply to Source
        </button>
      </div>
    </div>
  );
}