'use client';
import React, { useState, useCallback } from 'react';
import { useProjectStore } from '@/store/project-store';
import { formatValue } from '@/circuit/utils';

interface Props {
  onClose: () => void;
  position: { x: number; y: number };
  onMove: (pos: { x: number; y: number }) => void;
}

export default function BodePlotter({ onClose, position, onMove }: Props) {
  const store = useProjectStore();
  const [startFreq, setStartFreq] = useState(1);
  const [stopFreq, setStopFreq] = useState(1e6);
  const [logScale, setLogScale] = useState(true);
  const [showPhase, setShowPhase] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const { simResults, currentResultId } = store;
  const currentResult = simResults.find(r => r.id === currentResultId);

  // Check if we have AC results
  const acResult = currentResult?.analysisType === 'ac' ? currentResult : simResults.find(r => r.analysisType === 'ac');
  const traces = acResult?.traces || [];
  const magTrace = traces.find(t => t.name.includes('MAG'));
  const phaseTrace = traces.find(t => t.name.includes('PHASE'));

  const plotW = 400;
  const plotH = 150;

  return (
    <div
      className="instrument-window"
      style={{ left: position.x, top: position.y, width: 460 }}
      onMouseMove={e => { if (isDragging) onMove({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y }); }}
      onMouseUp={() => setIsDragging(false)}
    >
      <div className="instrument-titlebar" onMouseDown={e => { setIsDragging(true); setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y }); }}>
        <span className="flex-1">Bode Plotter</span>
        <button className="toolbar-btn w-5 h-5 text-[10px]" onClick={onClose}>✕</button>
      </div>

      <div className="p-3 space-y-2">
        {/* Magnitude plot */}
        <div>
          <div className="text-[10px] text-[var(--cb-text-muted)] mb-1">Magnitude (dB)</div>
          <svg viewBox={`0 0 ${plotW} ${plotH}`} className="w-full border border-[var(--cb-border)] rounded bg-[#0a0a14]">
            {magTrace ? (() => {
              const points: string[] = [];
              let yMin = Infinity, yMax = -Infinity;
              const dbData = magTrace.yData.map(v => 20 * Math.log10(Math.max(Math.abs(v), 1e-20)));
              for (const d of dbData) { yMin = Math.min(yMin, d); yMax = Math.max(yMax, d); }
              if (yMax - yMin < 1) { yMin -= 5; yMax += 5; }

              for (let i = 0; i < magTrace.xData.length; i++) {
                const x = logScale
                  ? ((Math.log10(Math.max(magTrace.xData[i], startFreq)) - Math.log10(startFreq)) / (Math.log10(stopFreq) - Math.log10(startFreq))) * plotW
                  : ((magTrace.xData[i] - startFreq) / (stopFreq - startFreq)) * plotW;
                const y = plotH - ((dbData[i] - yMin) / (yMax - yMin)) * plotH;
                points.push(`${i === 0 ? 'M' : 'L'} ${Math.max(0, Math.min(plotW, x))} ${Math.max(0, Math.min(plotH, y))}`);
              }
              return (
                <>
                  <path d={points.join(' ')} fill="none" stroke="#22c55e" strokeWidth="1.5" />
                  {/* -3dB line */}
                  {(() => {
                    const maxDb = Math.max(...dbData);
                    const line3db = maxDb - 3;
                    const y3db = plotH - ((line3db - yMin) / (yMax - yMin)) * plotH;
                    return <line x1={0} y1={y3db} x2={plotW} y2={y3db} stroke="#ff0" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.5" />;
                  })()}
                </>
              );
            })() : (
              <text x={plotW / 2} y={plotH / 2} textAnchor="middle" fill="#666" fontSize="12">
                Run AC Analysis first
              </text>
            )}
          </svg>
        </div>

        {/* Phase plot */}
        {showPhase && (
          <div>
            <div className="text-[10px] text-[var(--cb-text-muted)] mb-1">Phase (°)</div>
            <svg viewBox={`0 0 ${plotW} ${plotH}`} className="w-full border border-[var(--cb-border)] rounded bg-[#0a0a14]">
              {phaseTrace ? (() => {
                const points: string[] = [];
                for (let i = 0; i < phaseTrace.xData.length; i++) {
                  const x = logScale
                    ? ((Math.log10(Math.max(phaseTrace.xData[i], startFreq)) - Math.log10(startFreq)) / (Math.log10(stopFreq) - Math.log10(startFreq))) * plotW
                    : ((phaseTrace.xData[i] - startFreq) / (stopFreq - startFreq)) * plotW;
                  const y = plotH - ((phaseTrace.yData[i] + 180) / 360) * plotH;
                  points.push(`${i === 0 ? 'M' : 'L'} ${Math.max(0, Math.min(plotW, x))} ${Math.max(0, Math.min(plotH, y))}`);
                }
                return <path d={points.join(' ')} fill="none" stroke="#3b82f6" strokeWidth="1.5" />;
              })() : null}
            </svg>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2 text-xs">
          <div className="flex-1">
            <label className="text-[var(--cb-text-muted)]">Start Freq</label>
            <input type="number" className="w-full mono" value={startFreq} onChange={e => setStartFreq(Number(e.target.value))} />
          </div>
          <div className="flex-1">
            <label className="text-[var(--cb-text-muted)]">Stop Freq</label>
            <input type="number" className="w-full mono" value={stopFreq} onChange={e => setStopFreq(Number(e.target.value))} />
          </div>
        </div>

        <div className="flex gap-2 text-xs">
          <button className={`text-xs px-2 py-0.5 rounded border ${logScale ? 'bg-[var(--cb-accent)] text-white' : ''}`}
            onClick={() => setLogScale(true)}>Log</button>
          <button className={`text-xs px-2 py-0.5 rounded border ${!logScale ? 'bg-[var(--cb-accent)] text-white' : ''}`}
            onClick={() => setLogScale(false)}>Linear</button>
          <button className={`text-xs px-2 py-0.5 rounded border ${showPhase ? 'bg-[var(--cb-accent)] text-white' : ''}`}
            onClick={() => setShowPhase(!showPhase)}>Phase</button>
          <div className="flex-1" />
          <button className="text-xs px-2 py-0.5 rounded bg-[var(--cb-accent)] text-white" onClick={() => {
            store.setSimSettings({ analysisType: 'ac', ac: { startFreq, stopFreq, sweepType: 'decade', pointsPerDecade: 20, inputSource: 'V1' } });
            store.runSim();
          }}>
            Run AC
          </button>
        </div>

        {/* Gain/Phase margin */}
        {magTrace && (
          <div className="bg-[var(--cb-surface-alt)] rounded p-2 text-xs mono">
            {(() => {
              const dbData = Array.from(magTrace.yData).map(v => 20 * Math.log10(Math.max(Math.abs(v), 1e-20)));
              const maxGain = Math.max(...dbData);
              // Find 0dB crossing (gain margin)
              let unityGainIdx = -1;
              for (let i = 0; i < dbData.length - 1; i++) {
                if (dbData[i] > 0 && dbData[i + 1] <= 0) { unityGainIdx = i; break; }
              }
              return (
                <>
                  <div>Max Gain: {maxGain.toFixed(1)} dB</div>
                  <div>DC Gain: {dbData[0]?.toFixed(1)} dB</div>
                  <div>Bandwidth (est): {unityGainIdx > 0 ? formatValue(magTrace.xData[unityGainIdx], 'Hz') : 'N/A'}</div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}