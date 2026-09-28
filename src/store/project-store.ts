// CircuitBench - Main Application State Store (Zustand)
import { create } from 'zustand';
import type {
  Project, ProjectSheet, ComponentInstance, WireSegment, Junction,
  NetLabel, PowerSymbol, Probe, Instrument, Bus, BusEntry,
  SimulationSettings, SimulationResult, ERCMessage, Net, DesignVariable,
  Orientation, MirrorAxis, Transform, Point, AnalysisType,
} from '@/circuit/types';
import { COMPONENT_MAP } from '@/circuit/library';
import { generateId, snapPoint, transformPoint, getAbsolutePinPosition, distance, getTraceColor } from '@/circuit/utils';
import { runSimulation } from '@/circuit/simulator';
import {
  type SavedProjectMeta,
  listSavedProjects,
  saveProjectToBrowser,
  loadProjectFromBrowser,
  deleteProjectFromBrowser,
  readAutosave,
  writeAutosave,
  clearAutosave,
  autosaveHasContent,
} from '@/persistence/local';

// ─── Selection & Tool State ────────────────────────────────────────────

export type ToolMode = 'select' | 'wire' | 'component' | 'label' | 'power' | 'probe' | 'text' | 'bus';

export interface Selection {
  type: 'component' | 'wire' | 'junction' | 'label' | 'power' | 'probe' | 'instrument' | 'bus' | 'none';
  id: string | null;
  ids: string[]; // multi-select
}

export interface WireState {
  points: Point[];
  isDrawing: boolean;
  startPoint: Point | null;
}

// ─── Store Interface ───────────────────────────────────────────────────

interface ProjectStore {
  // Project
  project: Project;
  currentSheetId: string;
  hasUnsavedChanges: boolean;

  // UI State
  toolMode: ToolMode;
  placementSymbolId: string | null;
  probeKind: 'voltage' | 'current' | 'differential' | 'power';
  selection: Selection;
  wireState: WireState;
  pan: Point;
  zoom: number;
  gridSize: number;
  gridVisible: boolean;
  snapEnabled: boolean;
  darkMode: boolean;
  leftPanelVisible: boolean;
  rightPanelVisible: boolean;
  bottomPanelVisible: boolean;
  bottomTab: 'problems' | 'console' | 'results';

  // Simulation
  simSettings: SimulationSettings;
  simRunning: boolean;
  simResults: SimulationResult[];
  currentResultId: string | null;

  // ERC
  ercMessages: ERCMessage[];

  // Component reference counters
  refCounters: Record<string, number>;

  // Actions - Project
  newProject: () => void;
  loadProject: (data: Project) => void;
  setProjectName: (name: string) => void;
  markDirty: () => void;

  // Actions - Browser persistence (no database)
  savedProjects: SavedProjectMeta[];
  sessionRestored: boolean;
  refreshSavedProjects: () => void;
  saveToBrowser: (name?: string) => boolean;
  openFromBrowser: (id: string) => boolean;
  removeSavedProject: (id: string) => void;
  restoreSession: () => boolean;
  autosaveNow: () => void;

  // Actions - Sheet
  getCurrentSheet: () => ProjectSheet;
  addSheet: (name: string) => void;
  setCurrentSheet: (id: string) => void;

  // Actions - Components
  placeComponent: (symbolId: string, position: Point) => void;
  moveComponent: (id: string, position: Point) => void;
  rotateComponent: (id: string) => void;
  mirrorComponent: (id: string, axis: MirrorAxis) => void;
  deleteComponent: (id: string) => void;
  updateComponentProperty: (id: string, key: string, value: string) => void;
  updateComponentValue: (id: string, value: string) => void;

  // Actions - Wires
  startWire: (point: Point) => void;
  addWirePoint: (point: Point) => void;
  finishWire: () => void;
  cancelWire: () => void;
  deleteWire: (id: string) => void;

  // Actions - Other elements
  addJunction: (position: Point) => void;
  addNetLabel: (name: string, position: Point, orientation: Orientation) => void;
  addPowerSymbol: (type: 'gnd' | 'vcc' | 'vdd' | 'vee' | 'vss', position: Point) => void;
  addProbe: (type: Probe['type'], position: Point) => void;
  deleteProbe: (id: string) => void;
  updateProbe: (id: string, updates: Partial<Probe>) => void;

  // Actions - Selection
  select: (type: Selection['type'], id: string) => void;
  selectMultiple: (type: Selection['type'], ids: string[]) => void;
  clearSelection: () => void;
  selectAll: () => void;

  // Actions - Tool
  setToolMode: (mode: ToolMode) => void;
  setPlacementSymbolId: (id: string | null) => void;
  setProbeKind: (kind: 'voltage' | 'current' | 'differential' | 'power') => void;

  // Actions - View
  setZoom: (zoom: number) => void;
  setPan: (pan: Point) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitContent: () => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  toggleDarkMode: () => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleBottomPanel: () => void;
  setBottomTab: (tab: 'problems' | 'console' | 'results') => void;

  // Actions - Simulation
  setSimSettings: (settings: Partial<SimulationSettings>) => void;
  runSim: () => void;
  stopSim: () => void;
  clearResults: () => void;
  setCurrentResult: (id: string | null) => void;

  // Actions - ERC
  runERC: () => void;
  clearERC: () => void;

  // Actions - Copy/Paste
  clipboard: { components: ComponentInstance[]; wires: WireSegment[] } | null;
  copy: () => void;
  paste: () => void;
  duplicate: () => void;

  // Actions - Undo/Redo
  history: Project[];
  historyIndex: number;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
}

// ─── Default Project ───────────────────────────────────────────────────

function createDefaultSheet(id: string, name: string): ProjectSheet {
  return {
    id, name,
    components: [], wires: [], junctions: [], labels: [],
    powerSymbols: [], buses: [], busEntries: [],
    instruments: [], probes: [],
    width: 4000, height: 3000,
  };
}

function createDefaultProject(): Project {
  const sheetId = generateId('sheet');
  return {
    schemaVersion: 1,
    id: generateId('proj'),
    name: 'Untitled Project',
    description: '',
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    sheets: [createDefaultSheet(sheetId, 'Sheet 1')],
    nets: [],
    designVariables: [],
    simulationSettings: {
      analysisType: 'transient',
      transient: { startTime: 0, stopTime: 10e-3, maxTimeStep: 1e-5, initialTimeStep: 1e-7, useOperatingPoint: true, useIC: false },
      ac: { startFreq: 1, stopFreq: 1e6, sweepType: 'decade', pointsPerDecade: 20, inputSource: 'V1' },
      dcSweep: { source: 'V1', startValue: 0, stopValue: 10, stepValue: 0.1 },
      paramSweep: { target: '', sweepType: 'linear', startValue: 0, stopValue: 0, points: 10 },
    },
    savedResults: [],
    uiState: {
      leftPanelVisible: true, rightPanelVisible: true, bottomPanelVisible: true,
      darkMode: false, gridVisible: true, snapEnabled: true, rulersVisible: false,
      zoom: 1, panX: 0, panY: 0,
    },
  };
}

// ─── Connectivity Resolver ─────────────────────────────────────────────

export function resolveConnectivity(sheet: ProjectSheet): Net[] {
  const nets: Net[] = [];
  const pinToNet = new Map<string, string>();

  // 1. Process net labels (named nets)
  for (const label of sheet.labels) {
    const netId = generateId('net');
    const net: Net = {
      id: netId, name: label.name, type: label.isGlobal ? 'power' : 'signal',
      pinRefs: [], wireIds: [], junctionIds: [], labelIds: [label.id], probeIds: [],
    };
    nets.push(net);
    label.netId = netId;
  }

  // 2. Process power symbols
  for (const ps of sheet.powerSymbols) {
    const netId = generateId('net');
    const netName = ps.type === 'gnd' ? 'GND' : ps.type.toUpperCase();
    const net: Net = {
      id: netId, name: netName, type: ps.type === 'gnd' ? 'ground' : 'power',
      pinRefs: [], wireIds: [], junctionIds: [], labelIds: [], probeIds: [],
    };
    nets.push(net);
    ps.netId = netId;
  }

  // 3. Wire-based connectivity - group connected wires
  const wireGroups = findWireGroups(sheet);
  
  for (const group of wireGroups) {
    // Check if any wire in group touches a net label or power symbol
    let existingNet: Net | undefined;
    
    for (const wireId of group.wireIds) {
      const wire = sheet.wires.find(w => w.id === wireId);
      if (!wire) continue;
      
      for (const pt of wire.points) {
        // Check labels
        for (const label of sheet.labels) {
          if (Math.abs(label.position.x - pt.x) < 5 && Math.abs(label.position.y - pt.y) < 5) {
            existingNet = nets.find(n => n.id === label.netId);
            break;
          }
        }
        // Check power symbols
        for (const ps of sheet.powerSymbols) {
          if (Math.abs(ps.position.x - pt.x) < 5 && Math.abs(ps.position.y - pt.y) < 5) {
            existingNet = nets.find(n => n.id === ps.netId);
            break;
          }
        }
        if (existingNet) break;
      }
      if (existingNet) break;
    }

    if (existingNet) {
      existingNet.wireIds.push(...group.wireIds);
      existingNet.junctionIds.push(...group.junctionIds);
    } else {
      const netId = generateId('net');
      const net: Net = {
        id: netId, name: `N${nets.length + 1}`, type: 'signal',
        pinRefs: [], wireIds: group.wireIds, junctionIds: group.junctionIds,
        labelIds: [], probeIds: [],
      };
      nets.push(net);
    }
  }

  // 4. Map component pins to nets based on position overlap
  for (const comp of sheet.components) {
    const sym = COMPONENT_MAP.get(comp.symbolId);
    if (!sym) continue;
    
    for (const pin of sym.pins) {
      const absPos = getAbsolutePinPosition(pin.position, comp.position, comp.transform);
      const snappedPos = snapPoint(absPos);
      
      // Find matching net by checking wire endpoints and junctions
      for (const net of nets) {
        let connected = false;
        
        for (const wireId of net.wireIds) {
          const wire = sheet.wires.find(w => w.id === wireId);
          if (!wire) continue;
          for (const pt of wire.points) {
            if (distance(snappedPos, snapPoint(pt)) < 5) {
              connected = true;
              break;
            }
          }
          if (connected) break;
        }
        
        if (!connected) {
          for (const jId of net.junctionIds) {
            const j = sheet.junctions.find(jj => jj.id === jId);
            if (j && distance(snappedPos, snapPoint(j.position)) < 5) {
              connected = true;
              break;
            }
          }
        }

        // Check power symbol positions
        if (!connected) {
          for (const ps of sheet.powerSymbols) {
            if (ps.netId === net.id && distance(snappedPos, snapPoint(ps.position)) < 5) {
              connected = true;
              break;
            }
          }
        }

        if (connected) {
          net.pinRefs.push({ componentId: comp.id, pinId: pin.id });
          break;
        }
      }
    }
  }

  // 5. Map probes to nets
  for (const probe of sheet.probes) {
    for (const net of nets) {
      for (const wireId of net.wireIds) {
        const wire = sheet.wires.find(w => w.id === wireId);
        if (!wire) continue;
        for (const pt of wire.points) {
          if (distance(probe.position, snapPoint(pt)) < 10) {
            probe.netId = net.id;
            net.probeIds.push(probe.id);
            break;
          }
        }
        if (probe.netId) break;
      }
      if (probe.netId) break;
    }
  }

  return nets;
}

interface WireGroup {
  wireIds: string[];
  junctionIds: string[];
}

function findWireGroups(sheet: ProjectSheet): WireGroup[] {
  const visited = new Set<string>();
  const groups: WireGroup[] = [];

  for (const wire of sheet.wires) {
    if (visited.has(wire.id)) continue;
    
    const group: WireGroup = { wireIds: [], junctionIds: [] };
    const queue = [wire.id];
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      
      const current = sheet.wires.find(w => w.id === currentId);
      if (!current) continue;
      group.wireIds.push(currentId);

      // Find connected wires via endpoints and junctions
      for (const pt of current.points) {
        const sp = snapPoint(pt);
        
        // Check junctions
        for (const j of sheet.junctions) {
          if (distance(sp, snapPoint(j.position)) < 5) {
            if (!group.junctionIds.includes(j.id)) group.junctionIds.push(j.id);
            // Find more wires at junction
            for (const otherWire of sheet.wires) {
              if (!visited.has(otherWire.id)) {
                for (const opt of otherWire.points) {
                  if (distance(sp, snapPoint(opt)) < 5) {
                    queue.push(otherWire.id);
                    break;
                  }
                }
              }
            }
          }
        }
        
        // Direct wire-to-wire connections
        for (const otherWire of sheet.wires) {
          if (visited.has(otherWire.id)) continue;
          for (const opt of otherWire.points) {
            if (distance(sp, snapPoint(opt)) < 5) {
              queue.push(otherWire.id);
              break;
            }
          }
        }
      }
    }
    
    if (group.wireIds.length > 0) {
      groups.push(group);
    }
  }

  return groups;
}

// ─── Store Implementation ──────────────────────────────────────────────

export const useProjectStore = create<ProjectStore>((set, get) => ({
  // Initial state
  project: createDefaultProject(),
  currentSheetId: createDefaultProject().sheets[0].id,
  hasUnsavedChanges: false,

  toolMode: 'select',
  placementSymbolId: null,
  probeKind: 'voltage',
  selection: { type: 'none', id: null, ids: [] },
  wireState: { points: [], isDrawing: false, startPoint: null },
  pan: { x: 0, y: 0 },
  zoom: 1,
  gridSize: 10,
  gridVisible: true,
  snapEnabled: true,
  darkMode: false,
  leftPanelVisible: true,
  rightPanelVisible: true,
  bottomPanelVisible: true,
  bottomTab: 'results',

  simSettings: createDefaultProject().simulationSettings,
  simRunning: false,
  simResults: [],
  currentResultId: null,
  ercMessages: [],
  refCounters: {},

  clipboard: null,
  history: [],
  historyIndex: -1,

  // ── Project Actions ──────────────────────────────────────────────────
  newProject: () => {
    const proj = createDefaultProject();
    clearAutosave();
    set({
      project: proj,
      currentSheetId: proj.sheets[0].id,
      selection: { type: 'none', id: null, ids: [] },
      simResults: [],
      currentResultId: null,
      hasUnsavedChanges: false,
      ercMessages: [],
      sessionRestored: false,
      history: [],
      historyIndex: -1,
    });
  },

  loadProject: (data) => {
    set({
      project: { ...data, modifiedAt: Date.now() },
      currentSheetId: data.sheets[0]?.id || '',
      selection: { type: 'none', id: null, ids: [] },
      simResults: data.savedResults || [],
      currentResultId: null,
      hasUnsavedChanges: false,
    });
  },

  setProjectName: (name) => {
    set(s => ({ project: { ...s.project, name }, hasUnsavedChanges: true }));
  },

  markDirty: () => set({ hasUnsavedChanges: true }),

  // ── Browser persistence (no database) ────────────────────────────────
  savedProjects: [],
  sessionRestored: false,

  refreshSavedProjects: () => set({ savedProjects: listSavedProjects() }),

  saveToBrowser: (name) => {
    const state = get();
    const project: Project = {
      ...state.project,
      name: name ?? state.project.name,
      modifiedAt: Date.now(),
    };
    const meta = saveProjectToBrowser(project);
    if (!meta) {
      set({
        ercMessages: [{
          id: generateId('erc'),
          severity: 'error',
          message: 'Could not write to browser storage (quota exceeded or blocked). Use File > Save Copy to download a .json file.',
        }],
        bottomTab: 'problems',
        bottomPanelVisible: true,
      });
      return false;
    }
    set(s => ({
      project: { ...project, savedResults: project.savedResults },
      savedProjects: listSavedProjects(),
      hasUnsavedChanges: false,
    }));
    writeAutosave(project);
    return true;
  },

  openFromBrowser: (id) => {
    const loaded = loadProjectFromBrowser(id);
    if (!loaded) return false;
    set({
      project: loaded,
      currentSheetId: loaded.sheets[0].id,
      selection: { type: 'none', id: null, ids: [] },
      simResults: loaded.savedResults || [],
      currentResultId: null,
      hasUnsavedChanges: false,
      sessionRestored: false,
      history: [],
      historyIndex: -1,
    });
    return true;
  },

  removeSavedProject: (id) => {
    deleteProjectFromBrowser(id);
    set({ savedProjects: listSavedProjects() });
  },

  autosaveNow: () => {
    writeAutosave(get().project);
  },

  restoreSession: () => {
    const env = readAutosave();
    if (!env || !autosaveHasContent(env.project)) return false;
    set({
      project: env.project,
      currentSheetId: env.project.sheets[0].id,
      simResults: env.project.savedResults || [],
      currentResultId: null,
      hasUnsavedChanges: true,
      sessionRestored: true,
      history: [],
      historyIndex: -1,
    });
    return true;
  },

  // ── Sheet Actions ────────────────────────────────────────────────────
  getCurrentSheet: () => {
    const state = get();
    return state.project.sheets.find(s => s.id === state.currentSheetId) || state.project.sheets[0];
  },

  addSheet: (name) => {
    const id = generateId('sheet');
    const sheet = createDefaultSheet(id, name);
    set(s => ({
      project: { ...s.project, sheets: [...s.project.sheets, sheet] },
      currentSheetId: id,
      hasUnsavedChanges: true,
    }));
  },

  setCurrentSheet: (id) => set({ currentSheetId: id }),

  // ── Component Actions ────────────────────────────────────────────────
  placeComponent: (symbolId, position) => {
    // Power symbols are first-class schematic objects, not components.
    if (symbolId === 'ground' || symbolId === 'vcc' || symbolId === 'vdd') {
      const powerType = symbolId === 'ground' ? 'gnd' : symbolId;
      get().addPowerSymbol(powerType, position);
      return;
    }

    const sym = COMPONENT_MAP.get(symbolId);
    if (!sym) return;
    
    const state = get();
    const prefix = sym.referencePrefix || 'X';
    const counter = (state.refCounters[prefix] || 0) + 1;
    const ref = `${prefix}${counter}`;
    
    const comp: ComponentInstance = {
      id: generateId('comp'),
      symbolId,
      reference: ref,
      value: Object.values(sym.defaultValues)[0] || '',
      position: snapPoint(position),
      transform: { orientation: 0, mirror: 'none' },
      properties: { ...sym.defaultValues },
      visible: { reference: true, value: true, pinNames: false },
    };

    set(s => ({
      project: {
        ...s.project,
        modifiedAt: Date.now(),
        sheets: s.project.sheets.map(sheet =>
          sheet.id === s.currentSheetId
            ? { ...sheet, components: [...sheet.components, comp] }
            : sheet
        ),
      },
      refCounters: { ...s.refCounters, [prefix]: counter },
      hasUnsavedChanges: true,
      selection: { type: 'component', id: comp.id, ids: [comp.id] },
    }));
    get().pushHistory();
  },

  moveComponent: (id, position) => {
    set(s => ({
      project: {
        ...s.project,
        sheets: s.project.sheets.map(sheet =>
          sheet.id === s.currentSheetId
            ? {
                ...sheet,
                components: sheet.components.map(c =>
                  c.id === id ? { ...c, position: snapPoint(position) } : c
                ),
              }
            : sheet
        ),
      },
      hasUnsavedChanges: true,
    }));
  },

  rotateComponent: (id) => {
    const rotateAngle = (o: Orientation): Orientation => ((o + 90) % 360) as Orientation;
    set(s => ({
      project: {
        ...s.project,
        sheets: s.project.sheets.map(sheet =>
          sheet.id === s.currentSheetId
            ? {
                ...sheet,
                components: sheet.components.map(c =>
                  c.id === id
                    ? { ...c, transform: { ...c.transform, orientation: rotateAngle(c.transform.orientation) } }
                    : c
                ),
              }
            : sheet
        ),
      },
      hasUnsavedChanges: true,
    }));
    get().pushHistory();
  },

  mirrorComponent: (id, axis) => {
    set(s => ({
      project: {
        ...s.project,
        sheets: s.project.sheets.map(sheet =>
          sheet.id === s.currentSheetId
            ? {
                ...sheet,
                components: sheet.components.map(c =>
                  c.id === id
                    ? { ...c, transform: { ...c.transform, mirror: axis === c.transform.mirror ? 'none' : axis } }
                    : c
                ),
              }
            : sheet
        ),
      },
      hasUnsavedChanges: true,
    }));
    get().pushHistory();
  },

  deleteComponent: (id) => {
    set(s => ({
      project: {
        ...s.project,
        sheets: s.project.sheets.map(sheet =>
          sheet.id === s.currentSheetId
            ? { ...sheet, components: sheet.components.filter(c => c.id !== id) }
            : sheet
        ),
      },
      selection: { type: 'none', id: null, ids: [] },
      hasUnsavedChanges: true,
    }));
    get().pushHistory();
  },

  updateComponentProperty: (id, key, value) => {
    set(s => ({
      project: {
        ...s.project,
        sheets: s.project.sheets.map(sheet =>
          sheet.id === s.currentSheetId
            ? {
                ...sheet,
                components: sheet.components.map(c =>
                  c.id === id
                    ? { ...c, properties: { ...c.properties, [key]: value } }
                    : c
                ),
              }
            : sheet
        ),
      },
      hasUnsavedChanges: true,
    }));
  },

  updateComponentValue: (id, value) => {
    set(s => ({
      project: {
        ...s.project,
        sheets: s.project.sheets.map(sheet =>
          sheet.id === s.currentSheetId
            ? {
                ...sheet,
                components: sheet.components.map(c =>
                  c.id === id ? { ...c, value } : c
                ),
              }
            : sheet
        ),
      },
      hasUnsavedChanges: true,
    }));
  },

  // ── Wire Actions ─────────────────────────────────────────────────────
  startWire: (point) => {
    const sp = snapPoint(point);
    set({ wireState: { points: [sp], isDrawing: true, startPoint: sp } });
  },

  addWirePoint: (point) => {
    const sp = snapPoint(point);
    set(s => ({
      wireState: {
        ...s.wireState,
        points: [...s.wireState.points, sp],
      },
    }));
  },

  finishWire: () => {
    const state = get();
    const ws = state.wireState;
    if (ws.points.length < 2) {
      set({ wireState: { points: [], isDrawing: false, startPoint: null } });
      return;
    }

    // Create orthogonal wire segments
    const points = ws.points;
    const wire: WireSegment = {
      id: generateId('wire'),
      points: [...points],
    };

    set(s => ({
      project: {
        ...s.project,
        sheets: s.project.sheets.map(sheet =>
          sheet.id === s.currentSheetId
            ? { ...sheet, wires: [...sheet.wires, wire] }
            : sheet
        ),
      },
      wireState: { points: [], isDrawing: false, startPoint: null },
      hasUnsavedChanges: true,
    }));
    get().pushHistory();
  },

  cancelWire: () => {
    set({ wireState: { points: [], isDrawing: false, startPoint: null } });
  },

  deleteWire: (id) => {
    set(s => ({
      project: {
        ...s.project,
        sheets: s.project.sheets.map(sheet =>
          sheet.id === s.currentSheetId
            ? { ...sheet, wires: sheet.wires.filter(w => w.id !== id) }
            : sheet
        ),
      },
      selection: { type: 'none', id: null, ids: [] },
      hasUnsavedChanges: true,
    }));
    get().pushHistory();
  },

  // ── Other Element Actions ────────────────────────────────────────────
  addJunction: (position) => {
    const j: Junction = { id: generateId('junc'), position: snapPoint(position) };
    set(s => ({
      project: {
        ...s.project,
        sheets: s.project.sheets.map(sheet =>
          sheet.id === s.currentSheetId
            ? { ...sheet, junctions: [...sheet.junctions, j] }
            : sheet
        ),
      },
      hasUnsavedChanges: true,
    }));
  },

  addNetLabel: (name, position, orientation) => {
    const label: NetLabel = {
      id: generateId('label'),
      name,
      position: snapPoint(position),
      orientation,
      isGlobal: name === 'VCC' || name === 'GND' || name === 'VDD' || name === 'VEE',
    };
    set(s => ({
      project: {
        ...s.project,
        sheets: s.project.sheets.map(sheet =>
          sheet.id === s.currentSheetId
            ? { ...sheet, labels: [...sheet.labels, label] }
            : sheet
        ),
      },
      hasUnsavedChanges: true,
    }));
    get().pushHistory();
  },

  addPowerSymbol: (type, position) => {
    const ps: PowerSymbol = {
      id: generateId('pwr'),
      type,
      position: snapPoint(position),
    };
    set(s => ({
      project: {
        ...s.project,
        sheets: s.project.sheets.map(sheet =>
          sheet.id === s.currentSheetId
            ? { ...sheet, powerSymbols: [...sheet.powerSymbols, ps] }
            : sheet
        ),
      },
      hasUnsavedChanges: true,
    }));
    get().pushHistory();
  },

  addProbe: (type, position) => {
    const probe: Probe = {
      id: generateId('probe'),
      type,
      name: `Probe_${get().getCurrentSheet().probes.length + 1}`,
      color: getTraceColor(get().getCurrentSheet().probes.length),
      position: snapPoint(position),
      visible: true,
      plotVisible: true,
    };
    set(s => ({
      project: {
        ...s.project,
        sheets: s.project.sheets.map(sheet =>
          sheet.id === s.currentSheetId
            ? { ...sheet, probes: [...sheet.probes, probe] }
            : sheet
        ),
      },
      hasUnsavedChanges: true,
    }));
    get().pushHistory();
  },

  deleteProbe: (id) => {
    set(s => ({
      project: {
        ...s.project,
        sheets: s.project.sheets.map(sheet =>
          sheet.id === s.currentSheetId
            ? { ...sheet, probes: sheet.probes.filter(p => p.id !== id) }
            : sheet
        ),
      },
      hasUnsavedChanges: true,
    }));
  },

  updateProbe: (id, updates) => {
    set(s => ({
      project: {
        ...s.project,
        sheets: s.project.sheets.map(sheet =>
          sheet.id === s.currentSheetId
            ? {
                ...sheet,
                probes: sheet.probes.map(p =>
                  p.id === id ? { ...p, ...updates } : p
                ),
              }
            : sheet
        ),
      },
      hasUnsavedChanges: true,
    }));
  },

  // ── Selection Actions ────────────────────────────────────────────────
  select: (type, id) => {
    set({ selection: { type, id, ids: [id] } });
  },

  selectMultiple: (type, ids) => {
    set({ selection: { type, id: ids[0] || null, ids } });
  },

  clearSelection: () => {
    set({ selection: { type: 'none', id: null, ids: [] } });
  },

  selectAll: () => {
    const sheet = get().getCurrentSheet();
    const ids = sheet.components.map(c => c.id);
    set({ selection: { type: 'component', id: ids[0] || null, ids } });
  },

  // ── Tool Actions ─────────────────────────────────────────────────────
  setToolMode: (mode) => set({ toolMode: mode, placementSymbolId: null }),
  setPlacementSymbolId: (id) => set({ placementSymbolId: id, toolMode: id ? 'component' : 'select' }),
  setProbeKind: (kind) => set({ probeKind: kind }),

  // ── View Actions ─────────────────────────────────────────────────────
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(5, zoom)) }),
  setPan: (pan) => set({ pan }),
  zoomIn: () => set(s => ({ zoom: Math.min(5, s.zoom * 1.2) })),
  zoomOut: () => set(s => ({ zoom: Math.max(0.1, s.zoom / 1.2) })),
  fitContent: () => {
    const sheet = get().getCurrentSheet();
    if (sheet.components.length === 0) return;
    const xs = sheet.components.map(c => c.position.x);
    const ys = sheet.components.map(c => c.position.y);
    const minX = Math.min(...xs) - 100;
    const minY = Math.min(...ys) - 100;
    const maxX = Math.max(...xs) + 200;
    const maxY = Math.max(...ys) + 200;
    set({ pan: { x: -minX, y: -minY }, zoom: Math.min(2, 1200 / (maxX - minX)) });
  },
  toggleGrid: () => set(s => ({ gridVisible: !s.gridVisible })),
  toggleSnap: () => set(s => ({ snapEnabled: !s.snapEnabled })),
  toggleDarkMode: () => set(s => ({ darkMode: !s.darkMode })),
  toggleLeftPanel: () => set(s => ({ leftPanelVisible: !s.leftPanelVisible })),
  toggleRightPanel: () => set(s => ({ rightPanelVisible: !s.rightPanelVisible })),
  toggleBottomPanel: () => set(s => ({ bottomPanelVisible: !s.bottomPanelVisible })),
  setBottomTab: (tab) => set({ bottomTab: tab }),

  // ── Simulation Actions ───────────────────────────────────────────────
  setSimSettings: (settings) => {
    set(s => ({
      simSettings: { ...s.simSettings, ...settings },
      project: { ...s.project, simulationSettings: { ...s.simSettings, ...settings } },
    }));
  },

  runSim: () => {
    const state = get();
    const sheet = state.getCurrentSheet();
    
    // Resolve connectivity
    const nets = resolveConnectivity(sheet);
    
    set({ simRunning: true, ercMessages: [] });

    // Run simulation (synchronous for now)
    try {
      const result = runSimulation(
        sheet.components,
        nets,
        sheet.powerSymbols,
        state.simSettings,
        sheet.probes,
      );

      set(s => ({
        simRunning: false,
        simResults: [...s.simResults, result],
        currentResultId: result.id,
        project: {
          ...s.project,
          nets,
          savedResults: [...s.project.savedResults, result],
          modifiedAt: Date.now(),
        },
        bottomTab: 'results',
        bottomPanelVisible: true,
      }));
    } catch (err) {
      set(s => ({
        simRunning: false,
        ercMessages: [...s.ercMessages, {
          id: generateId('erc'),
          severity: 'error' as const,
          message: `Simulation failed: ${err instanceof Error ? err.message : String(err)}`,
        }],
        bottomTab: 'problems',
        bottomPanelVisible: true,
      }));
    }
  },

  stopSim: () => set({ simRunning: false }),
  clearResults: () => set({ simResults: [], currentResultId: null }),
  setCurrentResult: (id) => set({ currentResultId: id }),

  // ── ERC Actions ──────────────────────────────────────────────────────
  runERC: () => {
    const sheet = get().getCurrentSheet();
    const messages: ERCMessage[] = [];
    const nets = resolveConnectivity(sheet);

    // Check for GND
    const hasGround = sheet.powerSymbols.some(p => p.type === 'gnd');
    if (!hasGround) {
      messages.push({
        id: generateId('erc'), severity: 'error',
        message: 'No ground reference found in circuit.',
      });
    }

    // Check for unconnected pins
    for (const comp of sheet.components) {
      const sym = COMPONENT_MAP.get(comp.symbolId);
      if (!sym) continue;
      for (const pin of sym.pins) {
        const connected = nets.some(net =>
          net.pinRefs.some(ref => ref.componentId === comp.id && ref.pinId === pin.id)
        );
        if (!connected) {
          messages.push({
            id: generateId('erc'), severity: 'warning',
            message: `${comp.reference}: Pin "${pin.name}" (${pin.number}) is not connected.`,
            objectId: comp.id, objectType: 'component',
            position: comp.position,
          });
        }
      }
    }

    // Check for duplicate references
    const refMap = new Map<string, string[]>();
    for (const comp of sheet.components) {
      if (!comp.reference) continue;
      const existing = refMap.get(comp.reference) || [];
      existing.push(comp.id);
      refMap.set(comp.reference, existing);
    }
    for (const [ref, ids] of refMap) {
      if (ids.length > 1) {
        messages.push({
          id: generateId('erc'), severity: 'error',
          message: `Duplicate reference designator "${ref}" found ${ids.length} times.`,
        });
      }
    }

    set({ ercMessages: messages, bottomTab: 'problems', bottomPanelVisible: true });
  },

  clearERC: () => set({ ercMessages: [] }),

  // ── Copy/Paste ───────────────────────────────────────────────────────
  copy: () => {
    const sheet = get().getCurrentSheet();
    const sel = get().selection;
    const comps = sheet.components.filter(c => sel.ids.includes(c.id));
    const wires = sheet.wires.filter(w => sel.ids.includes(w.id));
    set({ clipboard: { components: comps, wires } });
  },

  paste: () => {
    const clip = get().clipboard;
    if (!clip) return;
    const offset = { x: 20, y: 20 };
    const idMap = new Map<string, string>();
    
    const newComps = clip.components.map(c => {
      const newId = generateId('comp');
      idMap.set(c.id, newId);
      return { ...c, id: newId, position: { x: c.position.x + offset.x, y: c.position.y + offset.y } };
    });
    const newWires = clip.wires.map(w => ({
      ...w,
      id: generateId('wire'),
      points: w.points.map(p => ({ x: p.x + offset.x, y: p.y + offset.y })),
    }));

    set(s => ({
      project: {
        ...s.project,
        sheets: s.project.sheets.map(sheet =>
          sheet.id === s.currentSheetId
            ? {
                ...sheet,
                components: [...sheet.components, ...newComps],
                wires: [...sheet.wires, ...newWires],
              }
            : sheet
        ),
      },
      hasUnsavedChanges: true,
    }));
    get().pushHistory();
  },

  duplicate: () => {
    get().copy();
    get().paste();
  },

  // ── Undo/Redo ────────────────────────────────────────────────────────
  pushHistory: () => {
    const state = get();
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(state.project)));
    if (newHistory.length > 100) newHistory.shift();
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: () => {
    const state = get();
    if (state.historyIndex <= 0) return;
    const newIndex = state.historyIndex - 1;
    set({
      project: JSON.parse(JSON.stringify(state.history[newIndex])),
      historyIndex: newIndex,
      hasUnsavedChanges: true,
    });
  },

  redo: () => {
    const state = get();
    if (state.historyIndex >= state.history.length - 1) return;
    const newIndex = state.historyIndex + 1;
    set({
      project: JSON.parse(JSON.stringify(state.history[newIndex])),
      historyIndex: newIndex,
      hasUnsavedChanges: true,
    });
  },
}));

