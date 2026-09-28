'use client';
import React, { useState, useRef, useCallback } from 'react';
import { useProjectStore } from '@/store/project-store';
import type { SimTrace } from '@/circuit/types';
import { formatValue } from '@/circuit/utils';

interface OscilloscopeProps {
  onClose: () => void;
  position: { x: number; y: number };
  onMove: (pos: { x: number; y: number }) => void;
}

export default function Oscilloscope({ onClose, position, onMove }: OscilloscopeProps) {
  const store = useProjectStore();
  const { simResults, currentResultId } = store;
  const currentResult = simResults.find(r => r.id === currentResultId);

  const [channels, setChannels] = useState([
    { enabled: true, color: '#2563eb', scale: 1, offset: 0, coupling: 'DC' as 'DC' | 'AC' | 'GND', probeId: '' },
    { enabled: true, color: '#dc2626', scale: 1, offset: 0, coupling: 'DC' as 'DC' | 'AC' | 'GND', probeId: '' },
    { enabled: false, color: '#16a34a', scale: 1, offset: 0, coupling: 'DC' as 'DC' | 'AC' | 'GND', probeId: '' },
    { enabled: false, color: '#9333ea', scale: 1, offset: 0, coupling: 'DC' as 'DC' | 'AC' | 'GND', probeId: '' },
  ]);

  const [timeDiv, setTimeDiv] = useState(1e-3); // 1ms/div
  const [triggerLevel, setTriggerLevel] = useState(0);
  const [triggerSource, setTriggerSource] = useState(0);
  const [triggerEdge, setTriggerEdge] = useState<'rising' | 'falling'>('rising');
  const [isRunning, setIsRunning] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const traces = currentResult?.traces || [];
  const sheet = store.getCurrentSheet();
  const probes = sheet.probes;

  // Get traces for enabled channels
  const getChannelTrace = (chIdx: number): SimTrace | null => {
    const ch = channels[chIdx];
    if (!ch.enabled) return null;
    // Map channel to trace by probe or by index
    if (ch.probeId) {
      const probe = probes.find(p => p.id === ch.probeId);
      if (probe?.netId) {
        return traces.find(t => t.name.includes(probe.netId || '')) || traces[chIdx] || null;
      }
    }
    return traces[chIdx] || null;
  };

  // Oscilloscope display dimensions
  const divW = 50; // pixels per division
  const divH = 40;
  const divsX = 10;
  const divsY = 8;
  const plotW = divW * divsX;
  const plotH = divH * divsY;

  // Mouse drag for window movement
  const handleTitleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      onMove({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
    }
  }, [isDragging, dragOffset, onMove]);

  const handleMouseUp = () => setIsDragging(false);

  // Compute measurements
  const computeMeasurement = (trace: SimTrace | null) => {
    if (!trace || trace.yData.length === 0) return null;
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
    const freq = estimateFrequency(trace);
    return { min, max, avg, rms, freq, pp: max - min };
  };

  const estimateFrequency = (trace: SimTrace): number => {
    if (trace.yData.length < 10) return 0;
    // Find zero crossings
    let crossings = 0;
    for (let i = 1; i < trace.yData.length; i++) {
      if ((trace.yData[i - 1] < 0 && trace.yData[i] >= 0) || (trace.yData[i - 1] >= 0 && trace.yData[i] < 0)) {
        crossings++;
      }
    }
    const totalTime = trace.xData[trace.xData.length - 1] - trace.xData[0];
    return crossings > 0 ? crossings / (2 * totalTime) : 0;
  };

  return (
    <div
      className="instrument-window"
      style={{ left: position.x, top: position.y, width: 720 }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Title bar */}
      <div
        className="instrument-titlebar"
        onMouseDown={handleTitleMouseDown}
      >
        <span className="flex-1">Oscilloscope</span>
        <button className="toolbar-btn w-5 h-5 text-[10px]" onClick={onClose}>✕</button>
      </div>

      <div className="flex">
        {/* Display */}
        <div className="flex-1 p-2">
          <svg viewBox={`0 0 ${plotW} ${plotH}`} className="w-full border border-[var(--cb-border)] rounded bg-[#0a0a14]">
            {/* Grid lines */}
            {Array.from({ length: divsX + 1 }, (_, i) => (
              <line key={`gx-${i}`} x1={i * divW} y1={0} x2={i * divW} y2={plotH} stroke="#1a1a2e" strokeWidth="0.5" />
            ))}
            {Array.from({ length: divsY + 1 }, (_, i) => (
              <line key={`gy-${i}`} x1={0} y1={i * divH} x2={plotW} y2={i * divH} stroke="#1a1a2e" strokeWidth="0.5" />
            ))}
            {/* Center lines */}
            <line x1={plotW / 2} y1={0} x2={plotW / 2} y2={plotH} stroke="#2a2a4e" strokeWidth="0.5" />
            <line x1={0} y1={plotH / 2} x2={plotW} y2={plotH / 2} stroke="#2a2a4e" strokeWidth="0.5" />

            {/* Waveforms */}
            {channels.map((ch, chIdx) => {
              const trace = getChannelTrace(chIdx);
              if (!trace || trace.yData.length === 0) return null;

              const points: string[] = [];
              const tStart = trace.xData[0];
              const tEnd = trace.xData[trace.xData.length - 1];

              for (let i = 0; i < trace.xData.length; i++) {
                const x = ((trace.xData[i] - tStart) / (tEnd - tStart || 1)) * plotW;
                const y = plotH / 2 - (trace.yData[i] * ch.scale + ch.offset) * (plotH / 20);
                points.push(`${i === 0 ? 'M' : 'L'} ${x} ${Math.max(0, Math.min(plotH, y))}`);
              }

              return (
                <path key={chIdx} d={points.join(' ')} fill="none" stroke={ch.color} strokeWidth="1.5" />
              );
            })}

            {/* Trigger indicator */}
            <line x1={0} y1={plotH / 2 - triggerLevel * (plotH / 20)} x2={plotW} y2={plotH / 2 - triggerLevel * (plotH / 20)}
              stroke="#ff0" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.5" />

            {/* Trigger arrow */}
            <polygon points={`${triggerEdge === 'rising' ? '10,20 10,10 20,15' : '10,10 10,20 20,15'}`} fill="#ff0" opacity="0.5" />
          </svg>

          {/* Time/div indicator */}
          <div className="flex justify-between mt-1 text-[10px] mono text-[var(--cb-text-muted)]">
            <span>T/div: {formatValue(timeDiv, 's')}</span>
            <span>{isRunning ? 'RUNNING' : 'STOPPED'}</span>
          </div>
        </div>

        {/* Controls panel */}
        <div className="w-48 border-l border-[var(--cb-border)] p-2 text-xs space-y-2 overflow-y-auto" style={{ maxHeight: 400 }}>
          {/* Channel settings */}
          {channels.map((ch, i) => (
            <div key={i} className="border border-[var(--cb-border)] rounded p-1.5">
              <div className="flex items-center gap-1 mb-1">
                <input
                  type="checkbox"
                  checked={ch.enabled}
                  onChange={e => {
                    const next = [...channels];
                    next[i] = { ...next[i], enabled: e.target.checked };
                    setChannels(next);
                  }}
                />
                <span className="font-semibold" style={{ color: ch.color }}>CH{i + 1}</span>
              </div>
              {ch.enabled && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[var(--cb-text-muted)] w-14">V/Div:</span>
                    <select
                      className="text-xs flex-1"
                      value={ch.scale}
                      onChange={e => {
                        const next = [...channels];
                        next[i] = { ...next[i], scale: Number(e.target.value) };
                        setChannels(next);
                      }}
                    >
                      {[0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10].map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[var(--cb-text-muted)] w-14">Coupling:</span>
                    <select
                      className="text-xs flex-1"
                      value={ch.coupling}
                      onChange={e => {
                        const next = [...channels];
                        next[i] = { ...next[i], coupling: e.target.value as 'DC' | 'AC' | 'GND' };
                        setChannels(next);
                      }}
                    >
                      <option value="DC">DC</option>
                      <option value="AC">AC</option>
                      <option value="GND">GND</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[var(--cb-text-muted)] w-14">Probe:</span>
                    <select
                      className="text-xs flex-1"
                      value={ch.probeId}
                      onChange={e => {
                        const next = [...channels];
                        next[i] = { ...next[i], probeId: e.target.value };
                        setChannels(next);
                      }}
                    >
                      <option value="">Trace {i + 1}</option>
                      {probes.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Time/div */}
          <div className="border border-[var(--cb-border)] rounded p-1.5">
            <div className="font-semibold mb-1">Time Base</div>
            <div className="flex items-center gap-1">
              <span className="text-[var(--cb-text-muted)] w-14">T/Div:</span>
              <select
                className="text-xs flex-1"
                value={timeDiv}
                onChange={e => setTimeDiv(Number(e.target.value))}
              >
                {[1e-6, 2e-6, 5e-6, 1e-5, 2e-5, 5e-5, 1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3, 1e-2, 2e-2, 5e-2, 0.1].map(v => (
                  <option key={v} value={v}>{formatValue(v, 's')}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Trigger */}
          <div className="border border-[var(--cb-border)] rounded p-1.5">
            <div className="font-semibold mb-1">Trigger</div>
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[var(--cb-text-muted)] w-14">Source:</span>
              <select className="text-xs flex-1" value={triggerSource}
                onChange={e => setTriggerSource(Number(e.target.value))}>
                {channels.map((_, i) => (
                  <option key={i} value={i}>CH{i + 1}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[var(--cb-text-muted)] w-14">Level:</span>
              <input type="number" className="text-xs flex-1" value={triggerLevel}
                onChange={e => setTriggerLevel(Number(e.target.value))} step="0.1" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[var(--cb-text-muted)] w-14">Edge:</span>
              <button className={`text-xs px-1.5 py-0.5 rounded border ${triggerEdge === 'rising' ? 'bg-[var(--cb-accent)] text-white' : ''}`}
                onClick={() => setTriggerEdge('rising')}>↑</button>
              <button className={`text-xs px-1.5 py-0.5 rounded border ${triggerEdge === 'falling' ? 'bg-[var(--cb-accent)] text-white' : ''}`}
                onClick={() => setTriggerEdge('falling')}>↓</button>
            </div>
          </div>

          {/* Run/Stop */}
          <div className="flex gap-1">
            <button
              className={`flex-1 text-xs py-1 rounded font-medium ${isRunning ? 'bg-[var(--cb-success)] text-white' : 'bg-[var(--cb-error)] text-white'}`}
              onClick={() => {
                if (!isRunning) store.runSim();
                setIsRunning(!isRunning);
              }}
            >
              {isRunning ? 'RUN' : 'STOP'}
            </button>
            <button className="flex-1 text-xs py-1 rounded border border-[var(--cb-border)]" onClick={() => store.runSim()}>
              Single
            </button>
          </div>

          {/* Measurements */}
          {traces.length > 0 && (
            <div className="border border-[var(--cb-border)] rounded p-1.5">
              <div className="font-semibold mb-1">Measurements</div>
              {channels.filter(c => c.enabled).map((ch, ci) => {
                const trace = getChannelTrace(ci);
                const m = computeMeasurement(trace);
                if (!m) return null;
                return (
                  <div key={ci} className="mb-1">
                    <div className="font-medium" style={{ color: ch.color }}>CH{ci + 1}</div>
                    <div className="mono text-[10px] text-[var(--cb-text-muted)] space-y-0.5">
                      <div>Vpp: {m.pp.toPrecision(3)} V</div>
                      <div>RMS: {m.rms.toPrecision(3)} V</div>
                      <div>Freq: {m.freq > 0 ? formatValue(m.freq, 'Hz') : 'N/A'}</div>
                      <div>Max: {m.max.toPrecision(3)} V</div>
                      <div>Min: {m.min.toPrecision(3)} V</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}