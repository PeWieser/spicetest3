'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useProjectStore } from '@/store/project-store';
import MenuBar from '@/components/MenuBar';
import Toolbar from '@/components/Toolbar';
import DesignBrowser from '@/components/DesignBrowser';
import SchematicCanvas from '@/components/SchematicCanvas';
import Inspector from '@/components/Inspector';
import BottomPanel from '@/components/BottomPanel';
import Grapher from '@/components/Grapher';
import Oscilloscope from '@/components/Instruments/Oscilloscope';
import FunctionGenerator from '@/components/Instruments/FunctionGenerator';
import Multimeter from '@/components/Instruments/Multimeter';
import BodePlotter from '@/components/Instruments/BodePlotter';
import LogicAnalyzer from '@/components/Instruments/LogicAnalyzer';
import { EXAMPLE_PROJECTS } from '@/circuit/examples';

type InstrumentWindow = {
  type: 'oscilloscope' | 'functionGenerator' | 'multimeter' | 'bodePlotter' | 'logicAnalyzer';
  id: string;
  position: { x: number; y: number };
  visible: boolean;
};

export default function CircuitBenchApp() {
  const store = useProjectStore();
  const [showGrapher, setShowGrapher] = useState(false);
  const [instruments, setInstruments] = useState<InstrumentWindow[]>([]);
  const [showInstrumentsMenu, setShowInstrumentsMenu] = useState(false);

  const { leftPanelVisible, rightPanelVisible, bottomPanelVisible, darkMode } = store;

  // Apply dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // ── Static-build persistence: restore session + index of saved projects
  useEffect(() => {
    store.refreshSavedProjects();
    store.restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced autosave (crash recovery) - browser storage only, no server.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (store.hasUnsavedChanges) store.autosaveNow();
    }, 800);
    return () => clearTimeout(timer);
  }, [store.project, store.hasUnsavedChanges, store]);

  // Open grapher automatically when simulation completes
  useEffect(() => {
    if (store.simResults.length > 0 && store.currentResultId) {
      setShowGrapher(true);
    }
  }, [store.simResults.length, store.currentResultId]);

  const addInstrument = useCallback((type: InstrumentWindow['type']) => {
    const id = `${type}_${Date.now()}`;
    const offset = instruments.length * 30;
    setInstruments(prev => [...prev, {
      type,
      id,
      position: { x: 100 + offset, y: 100 + offset },
      visible: true,
    }]);
    setShowInstrumentsMenu(false);
  }, [instruments.length]);

  const removeInstrument = useCallback((id: string) => {
    setInstruments(prev => prev.filter(i => i.id !== id));
  }, []);

  const moveInstrument = useCallback((id: string, pos: { x: number; y: number }) => {
    setInstruments(prev => prev.map(i => i.id === id ? { ...i, position: pos } : i));
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--cb-bg)] text-[var(--cb-text)]">
      {/* Title bar */}
      <div className="flex items-center h-[var(--cb-titlebar-height)] bg-[var(--cb-surface)] border-b border-[var(--cb-border)] px-3 select-none">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-bold text-[var(--cb-accent)]">⚡</span>
          <span className="text-[13px] font-semibold tracking-tight">CircuitBench</span>
          <span className="text-[10px] text-[var(--cb-text-muted)] ml-1">v1.0</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          {/* Example projects dropdown */}
          <select
            className="text-[10px] bg-transparent border border-[var(--cb-border)] rounded px-1 py-0.5 text-[var(--cb-text-muted)]"
            onChange={e => {
              const idx = parseInt(e.target.value);
              if (!isNaN(idx) && EXAMPLE_PROJECTS[idx]) {
                const project = EXAMPLE_PROJECTS[idx].create();
                store.loadProject(project);
              }
              e.target.value = '';
            }}
            defaultValue=""
          >
            <option value="" disabled>Load Example...</option>
            {EXAMPLE_PROJECTS.map((ex, i) => (
              <option key={i} value={i}>{ex.name}</option>
            ))}
          </select>
        
          <button
            className="toolbar-btn text-[10px] px-2"
            onClick={() => setShowGrapher(!showGrapher)}
            title="Toggle Grapher"
          >
            📊
          </button>
          <div className="relative">
            <button
              className="toolbar-btn text-[10px] px-2"
              onClick={() => setShowInstrumentsMenu(!showInstrumentsMenu)}
              title="Instruments"
            >
              🔧
            </button>
            {showInstrumentsMenu && (
              <div className="absolute top-full right-0 min-w-[180px] bg-[var(--cb-surface)] border border-[var(--cb-border)] shadow-lg rounded z-50 py-1">
                {[
                  { type: 'oscilloscope' as const, label: 'Oscilloscope', icon: '📡' },
                  { type: 'functionGenerator' as const, label: 'Function Generator', icon: '〰️' },
                  { type: 'multimeter' as const, label: 'Digital Multimeter', icon: '🔌' },
                  { type: 'bodePlotter' as const, label: 'Bode Plotter', icon: '📈' },
                  { type: 'logicAnalyzer' as const, label: 'Logic Analyzer', icon: '🔬' },
                ].map(item => (
                  <div
                    key={item.type}
                    className="menu-item"
                    onClick={() => addInstrument(item.type)}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Menu bar */}
      <MenuBar />

      {/* Toolbar */}
      <Toolbar />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Design Browser */}
        {leftPanelVisible && <DesignBrowser />}

        {/* Center - Canvas or Grapher */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {showGrapher ? (
            <div className="flex-1 flex flex-col">
              <div className="flex items-center h-7 px-2 bg-[var(--cb-surface-alt)] border-b border-[var(--cb-border)] text-xs">
                <button
                  className={`tab-btn ${!showGrapher ? 'active' : ''}`}
                  onClick={() => setShowGrapher(false)}
                >
                  Schematic
                </button>
                <button
                  className={`tab-btn ${showGrapher ? 'active' : ''}`}
                  onClick={() => setShowGrapher(true)}
                >
                  Grapher
                </button>
                <div className="flex-1" />
                <button className="toolbar-btn text-[10px]" onClick={() => setShowGrapher(false)}>✕</button>
              </div>
              <div className="flex-1">
                <Grapher />
              </div>
            </div>
          ) : (
            <SchematicCanvas />
          )}
        </div>

        {/* Right panel - Inspector */}
        {rightPanelVisible && <Inspector />}
      </div>

      {/* Bottom panel */}
      {bottomPanelVisible && <BottomPanel />}

      {/* Instrument windows */}
      {instruments.filter(i => i.visible).map(inst => {
        const commonProps = {
          key: inst.id,
          onClose: () => removeInstrument(inst.id),
          position: inst.position,
          onMove: (pos: { x: number; y: number }) => moveInstrument(inst.id, pos),
        };

        switch (inst.type) {
          case 'oscilloscope':
            return <Oscilloscope {...commonProps} />;
          case 'functionGenerator':
            return <FunctionGenerator {...commonProps} />;
          case 'multimeter':
            return <Multimeter {...commonProps} />;
          case 'bodePlotter':
            return <BodePlotter {...commonProps} />;
          case 'logicAnalyzer':
            return <LogicAnalyzer {...commonProps} />;
          default:
            return null;
        }
      })}

      {/* Click-away handler for menus */}
      {showInstrumentsMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowInstrumentsMenu(false)} />
      )}

      {/* Status bar */}
      <div className="flex items-center h-5 bg-[var(--cb-surface)] border-t border-[var(--cb-border)] px-3 text-[10px] text-[var(--cb-text-muted)] select-none">
        <span>
          {store.simRunning ? '🟢 Simulation Running...' :
           store.simResults.length > 0 ? `✅ ${store.simResults.length} simulation(s) completed` :
           'Ready'}
        </span>
        {store.sessionRestored && (
          <span className="ml-3 text-[var(--cb-warning)]">Session restored from autosave</span>
        )}
        <span className="ml-3">
          {store.hasUnsavedChanges ? 'Unsaved changes •' : 'Saved to browser'}
        </span>
        <div className="flex-1" />
        <span className="mr-3">
          Components: {store.getCurrentSheet().components.length} | 
          Wires: {store.getCurrentSheet().wires.length} | 
          Nets: {store.project.nets?.length || 0}
        </span>
        <span>
          Grid: {store.gridVisible ? 'On' : 'Off'} | 
          Snap: {store.snapEnabled ? 'On' : 'Off'}
        </span>
      </div>
    </div>
  );
}