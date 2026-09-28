'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useProjectStore } from '@/store/project-store';
import { downloadTextFile, safeFileName } from '@/persistence/local';
import { migrateProject } from '@/persistence/local';
import { generateSpiceNetlist, netlistFileName } from '@/circuit/netlist';
import { exportSvg, exportPng, exportPdf } from '@/persistence/exporters';

interface MenuItem {
  label?: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
  disabled?: boolean;
  hint?: boolean;
}

export default function MenuBar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const store = useProjectStore();

  const close = useCallback(() => setOpenMenu(null), []);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setOpenMenu(null);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  // ── commands ───────────────────────────────────────────────────────
  const openJsonFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const parsed = migrateProject(JSON.parse(await file.text()));
        if (!parsed) throw new Error('no sheets');
        store.loadProject(parsed);
        store.refreshSavedProjects();
      } catch {
        alert('This file is not a valid CircuitBench project.');
      }
    };
    input.click();
    close();
  };

  const downloadProjectJson = () => {
    const { project } = store;
    downloadTextFile(
      safeFileName(project.name, '.json'),
      JSON.stringify({ ...project, savedResults: project.savedResults.map(r => ({ ...r, traces: [] })) }, null, 2),
      'application/json',
    );
    close();
  };

  const saveToBrowser = () => { store.saveToBrowser(); close(); };

  const saveAs = () => {
    const name = window.prompt('Project name:', store.project.name);
    if (name && name.trim()) store.saveToBrowser(name.trim());
    close();
  };

  const exportNetlist = () => {
    const sheet = store.getCurrentSheet();
    const { netlist, warnings, nodeCount, deviceCount } = generateSpiceNetlist(store.project, sheet, store.simSettings);
    downloadTextFile(netlistFileName(store.project), netlist, 'text/plain;charset=utf-8');
    if (warnings.length) {
      store.runERC();
      close();
      return;
    }
    close();
    void nodeCount; void deviceCount;
  };

  const exportSchematicSvg = () => {
    const svg = document.querySelector('.canvas-container svg') as SVGSVGElement | null;
    if (!exportSvg(svg, store.project.name)) alert('Nothing to export yet - the schematic is empty.');
    close();
  };

  const exportSchematicPng = async () => {
    const svg = document.querySelector('.canvas-container svg') as SVGSVGElement | null;
    const ok = await exportPng(svg, store.project.name, 2);
    if (!ok) alert('PNG export failed - the schematic may be empty.');
    close();
  };

  const exportSchematicPdf = () => {
    const svg = document.querySelector('.canvas-container svg') as SVGSVGElement | null;
    if (!exportPdf(svg, store.project.name)) alert('PDF export requires a popup window - please allow popups.');
    close();
  };

  const menus: Record<string, MenuItem[]> = {
    File: [
      { label: 'New Project', shortcut: 'Ctrl+N', action: () => { store.newProject(); close(); } },
      { separator: true },
      { label: 'Open File...', shortcut: 'Ctrl+O', action: openJsonFile },
      // Recent / saved projects (browser storage)
      ...(store.savedProjects.length
        ? store.savedProjects.slice(0, 8).map(m => ({
            label: `${m.name}`,
            hint: true,
            action: () => { store.openFromBrowser(m.id); close(); },
          }))
        : [{ label: 'No saved projects yet', disabled: true }]),
      { separator: true },
      { label: 'Save', shortcut: 'Ctrl+S', action: saveToBrowser },
      { label: 'Save As...', action: saveAs },
      { label: 'Save Copy (download .json)', action: downloadProjectJson },
      { separator: true },
      { label: 'Import SPICE Netlist', disabled: true },
      { label: 'Export SPICE Netlist (.cir)', action: exportNetlist },
      { label: 'Export SVG', action: exportSchematicSvg },
      { label: 'Export PNG', action: exportSchematicPng },
      { label: 'Export PDF', action: exportSchematicPdf },
      { separator: true },
      { label: 'Clear Autosave', action: () => { clearAutosaveAction(); close(); } },
      { label: 'Exit', disabled: true },
    ],
    Edit: [
      { label: 'Undo', shortcut: 'Ctrl+Z', disabled: store.historyIndex <= 0, action: () => { store.undo(); close(); } },
      { label: 'Redo', shortcut: 'Ctrl+Y', disabled: store.historyIndex >= store.history.length - 1, action: () => { store.redo(); close(); } },
      { separator: true },
      { label: 'Cut', shortcut: 'Ctrl+X', action: () => { store.copy(); close(); } },
      { label: 'Copy', shortcut: 'Ctrl+C', disabled: store.selection.ids.length === 0, action: () => { store.copy(); close(); } },
      { label: 'Paste', shortcut: 'Ctrl+V', disabled: !store.clipboard, action: () => { store.paste(); close(); } },
      { label: 'Duplicate', shortcut: 'Ctrl+D', disabled: store.selection.ids.length === 0, action: () => { store.duplicate(); close(); } },
      { separator: true },
      {
        label: 'Delete', shortcut: 'Del',
        disabled: store.selection.type === 'none',
        action: () => {
          const sel = store.selection;
          if (sel.type === 'component' && sel.id) store.deleteComponent(sel.id);
          else if (sel.type === 'wire' && sel.id) store.deleteWire(sel.id);
          else if (sel.type === 'probe' && sel.id) store.deleteProbe(sel.id);
          close();
        },
      },
      { label: 'Select All', shortcut: 'Ctrl+A', action: () => { store.selectAll(); close(); } },
    ],
    View: [
      { label: 'Zoom In', action: () => { store.zoomIn(); close(); } },
      { label: 'Zoom Out', action: () => { store.zoomOut(); close(); } },
      { label: 'Fit to Content', action: () => { store.fitContent(); close(); } },
      { separator: true },
      { label: `${store.gridVisible ? '☑' : '☐'} Grid`, action: () => { store.toggleGrid(); close(); } },
      { label: `${store.snapEnabled ? '☑' : '☐'} Snap`, action: () => { store.toggleSnap(); close(); } },
      { separator: true },
      { label: `${store.leftPanelVisible ? '☑' : '☐'} Design Browser`, action: () => { store.toggleLeftPanel(); close(); } },
      { label: `${store.rightPanelVisible ? '☑' : '☐'} Inspector`, action: () => { store.toggleRightPanel(); close(); } },
      { label: `${store.bottomPanelVisible ? '☑' : '☐'} Console`, action: () => { store.toggleBottomPanel(); close(); } },
      { separator: true },
      { label: `${store.darkMode ? '☑' : '☐'} Dark Mode`, action: () => { store.toggleDarkMode(); close(); } },
    ],
    Place: [
      { label: 'Component...', shortcut: 'P', action: () => { store.setToolMode('component'); close(); } },
      { label: 'Wire', shortcut: 'W', action: () => { store.setToolMode('wire'); close(); } },
      { label: 'Net Label', shortcut: 'L', action: () => { store.setToolMode('label'); close(); } },
      { separator: true },
      { label: 'Ground', action: () => { store.setPlacementSymbolId('ground'); close(); } },
      { label: 'VCC', action: () => { store.setPlacementSymbolId('vcc'); close(); } },
      { label: 'VDD', action: () => { store.setPlacementSymbolId('vdd'); close(); } },
      { separator: true },
      { label: 'Voltage Probe', action: () => { store.setProbeKind('voltage'); store.setToolMode('probe'); close(); } },
      { label: 'Current Probe', action: () => { store.setProbeKind('current'); store.setToolMode('probe'); close(); } },
      { label: 'Differential Probe', action: () => { store.setProbeKind('differential'); store.setToolMode('probe'); close(); } },
      { label: 'Power Probe', action: () => { store.setProbeKind('power'); store.setToolMode('probe'); close(); } },
      { separator: true },
      { label: 'Text Annotation', disabled: true },
    ],
    Simulate: [
      { label: '▶ Run', shortcut: 'F5', action: () => { store.runSim(); close(); } },
      { label: '■ Stop', disabled: !store.simRunning, action: () => { store.stopSim(); close(); } },
      { separator: true },
      { label: `${store.simSettings.analysisType === 'op' ? '☑' : '☐'} Operating Point`, action: () => { store.setSimSettings({ analysisType: 'op' }); close(); } },
      { label: `${store.simSettings.analysisType === 'transient' ? '☑' : '☐'} Transient`, action: () => { store.setSimSettings({ analysisType: 'transient' }); close(); } },
      { label: `${store.simSettings.analysisType === 'ac' ? '☑' : '☐'} AC Analysis`, action: () => { store.setSimSettings({ analysisType: 'ac' }); close(); } },
      { label: `${store.simSettings.analysisType === 'dcSweep' ? '☑' : '☐'} DC Sweep`, action: () => { store.setSimSettings({ analysisType: 'dcSweep' }); close(); } },
      { label: `${store.simSettings.analysisType === 'paramSweep' ? '☑' : '☐'} Parameter Sweep`, action: () => { store.setSimSettings({ analysisType: 'paramSweep' }); close(); } },
      { separator: true },
      { label: 'Clear Results', disabled: store.simResults.length === 0, action: () => { store.clearResults(); close(); } },
    ],
    Analyze: [
      { label: 'Operating Point', action: () => { store.setSimSettings({ analysisType: 'op' }); store.runSim(); close(); } },
      { label: 'Transient Analysis', action: () => { store.setSimSettings({ analysisType: 'transient' }); store.runSim(); close(); } },
      { label: 'AC Analysis', action: () => { store.setSimSettings({ analysisType: 'ac' }); store.runSim(); close(); } },
      { label: 'DC Sweep', action: () => { store.setSimSettings({ analysisType: 'dcSweep' }); store.runSim(); close(); } },
      { label: 'Parameter Sweep', action: () => { store.setSimSettings({ analysisType: 'paramSweep' }); store.runSim(); close(); } },
    ],
    Tools: [
      { label: 'Component Browser', hint: true, action: () => { if (!store.leftPanelVisible) store.toggleLeftPanel(); close(); } },
      { label: 'ERC Check', action: () => { store.runERC(); close(); } },
      { separator: true },
      { label: 'Export Netlist (view)', action: () => {
        const sheet = store.getCurrentSheet();
        const { netlist } = generateSpiceNetlist(store.project, sheet, store.simSettings);
        const win = window.open('', '_blank');
        win?.document.write(`<pre style="font:12px ui-monospace,monospace;padding:16px">${netlist.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] || c))}</pre>`);
        close();
      }},
    ],
    Help: [
      { label: 'Documentation', hint: true, action: () => { window.open('https://docs.cloudflare.com/pages/', '_blank'); close(); } },
      { label: 'Keyboard Shortcuts', hint: true, action: () => {
        alert([
          'W  Wire mode', 'R  Rotate', 'M  Mirror', 'E  Properties',
          'Del  Delete', 'Esc  Cancel / Select',
          'Ctrl+S  Save (browser storage)', 'Ctrl+Z  Undo', 'Ctrl+Y  Redo',
          'Ctrl+A  Select all', 'F5  Run simulation',
          'Middle mouse  Pan', 'Mouse wheel  Zoom',
        ].join('\n'));
        close();
      }},
      { separator: true },
      { label: 'About CircuitBench', action: () => {
        alert('CircuitBench v1.0\nElectronic circuit design & simulation.\n\nRuns entirely in the browser:\nschematic editor, connectivity resolver,\nMNA/SPICE-style solver, instruments, grapher.\n\nStatic build for Cloudflare Pages - no backend, no database.');
        close();
      }},
    ],
  };

  function clearAutosaveAction() {
    import('@/persistence/local').then(m => m.clearAutosave());
  }

  return (
    <div ref={menuRef} className="flex items-center h-[var(--cb-menubar-height)] bg-[var(--cb-surface)] border-b border-[var(--cb-border)] select-none relative z-50">
      {Object.entries(menus).map(([name, items]) => (
        <div key={name} className="relative">
          <button
            className={`px-3 h-[var(--cb-menubar-height)] text-[12px] hover:bg-[var(--cb-border)] ${openMenu === name ? 'bg-[var(--cb-accent)] text-white' : ''}`}
            onClick={() => setOpenMenu(openMenu === name ? null : name)}
            onMouseEnter={() => openMenu && setOpenMenu(name)}
          >
            {name}
          </button>
          {openMenu === name && (
            <div className="absolute top-full left-0 min-w-[240px] max-h-[70vh] overflow-y-auto bg-[var(--cb-surface)] border border-[var(--cb-border)] shadow-lg rounded-b z-50 py-1">
              {items.map((item, i) =>
                item.separator ? (
                  <div key={i} className="menu-sep" />
                ) : (
                  <div
                    key={i}
                    className={`menu-item ${item.disabled ? 'opacity-40 cursor-default' : ''} ${item.hint ? 'text-[12px]' : ''}`}
                    onClick={() => !item.disabled && item.action?.()}
                    title={item.disabled && item.label === 'Import SPICE Netlist' ? 'Netlist import is not available in the static build' : undefined}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && <span className="shortcut">{item.shortcut}</span>}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      ))}
      <div className="flex-1" />
      <div className="pr-3 text-[11px] text-[var(--cb-text-muted)]">
        {store.project.name}{store.hasUnsavedChanges ? ' •' : ''}
      </div>
    </div>
  );
}
