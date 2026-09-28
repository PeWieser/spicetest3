'use client';
import React from 'react';
import { useProjectStore, type ToolMode } from '@/store/project-store';

const ToolButton = ({ icon, label, mode, shortcut }: { icon: string; label: string; mode?: ToolMode; shortcut?: string }) => {
  const store = useProjectStore();
  const isActive = mode ? store.toolMode === mode : false;
  return (
    <button
      className={`toolbar-btn ${isActive ? 'active' : ''}`}
      title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
      onClick={() => mode && store.setToolMode(mode)}
    >
      {icon}
    </button>
  );
};

const Sep = () => <div className="toolbar-sep" />;

export default function Toolbar() {
  const store = useProjectStore();

  return (
    <div className="flex items-center h-[var(--cb-toolbar-height)] bg-[var(--cb-surface)] border-b border-[var(--cb-border)] px-2 gap-0.5 select-none">
      {/* File operations */}
      <button className="toolbar-btn" title="New Project (Ctrl+N)" onClick={() => store.newProject()}>📄</button>
      <button className="toolbar-btn" title="Save (Ctrl+S)" onClick={() => {
        const data = JSON.stringify(store.project, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${store.project.name}.json`; a.click();
        URL.revokeObjectURL(url);
      }}>💾</button>
      <Sep />
      
      {/* Edit */}
      <button className="toolbar-btn" title="Undo (Ctrl+Z)" onClick={() => store.undo()}>↩</button>
      <button className="toolbar-btn" title="Redo (Ctrl+Y)" onClick={() => store.redo()}>↪</button>
      <Sep />

      {/* Tools */}
      <ToolButton icon="👆" label="Select" mode="select" shortcut="Esc" />
      <ToolButton icon="✏" label="Wire" mode="wire" shortcut="W" />
      <ToolButton icon="🏷" label="Net Label" mode="label" shortcut="L" />
      <Sep />

      {/* Quick place */}
      <button className="toolbar-btn" title="Place Component" onClick={() => store.setToolMode('component')}>⊕</button>
      <button className="toolbar-btn" title="Ground" onClick={() => store.setPlacementSymbolId('ground')}>⏚</button>
      <button className="toolbar-btn" title="VCC" onClick={() => store.setPlacementSymbolId('vcc')}>⬆</button>
      <Sep />

      {/* Probes */}
      <button className="toolbar-btn" title="Voltage Probe" onClick={() => store.addProbe('voltage', { x: 300, y: 300 })}>🔵</button>
      <button className="toolbar-btn" title="Current Probe" onClick={() => store.addProbe('current', { x: 300, y: 300 })}>🟡</button>
      <Sep />

      {/* View */}
      <button className="toolbar-btn" title="Zoom In" onClick={() => store.zoomIn()}>🔍+</button>
      <button className="toolbar-btn" title="Zoom Out" onClick={() => store.zoomOut()}>🔍-</button>
      <button className="toolbar-btn" title="Fit Content" onClick={() => store.fitContent()}>⊞</button>
      <Sep />

      {/* Simulation */}
      <button
        className="toolbar-btn"
        style={{ color: store.simRunning ? 'var(--cb-error)' : 'var(--cb-success)', fontSize: 16, fontWeight: 'bold' }}
        title={store.simRunning ? 'Stop (Shift+F5)' : 'Run (F5)'}
        onClick={() => store.simRunning ? store.stopSim() : store.runSim()}
      >
        {store.simRunning ? '■' : '▶'}
      </button>
      <Sep />

      {/* Panel toggles */}
      <button className={`toolbar-btn ${store.leftPanelVisible ? 'active' : ''}`} title="Design Browser" onClick={() => store.toggleLeftPanel()}>◧</button>
      <button className={`toolbar-btn ${store.rightPanelVisible ? 'active' : ''}`} title="Inspector" onClick={() => store.toggleRightPanel()}>◨</button>
      <button className={`toolbar-btn ${store.bottomPanelVisible ? 'active' : ''}`} title="Console" onClick={() => store.toggleBottomPanel()}>⬒</button>
      <Sep />

      {/* Zoom indicator */}
      <span className="mono text-[var(--cb-text-muted)] ml-2">{Math.round(store.zoom * 100)}%</span>

      {/* Snap/Grid */}
      <div className="flex-1" />
      <button className={`toolbar-btn text-[11px] ${store.snapEnabled ? 'active' : ''}`} title="Snap to Grid" onClick={() => store.toggleSnap()}>Snap</button>
      <button className={`toolbar-btn text-[11px] ${store.gridVisible ? 'active' : ''}`} title="Grid" onClick={() => store.toggleGrid()}>Grid</button>
      <button className={`toolbar-btn text-[11px] ${store.darkMode ? 'active' : ''}`} title="Dark Mode" onClick={() => store.toggleDarkMode()}>🌙</button>
    </div>
  );
}