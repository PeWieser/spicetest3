// CircuitBench Domain Model - Core Types

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Point, Size {}

export type Orientation = 0 | 90 | 180 | 270;
export type MirrorAxis = 'none' | 'horizontal' | 'vertical';

export interface Transform {
  orientation: Orientation;
  mirror: MirrorAxis;
}

// ─── Pin ───────────────────────────────────────────────────────────────
export type PinType = 'input' | 'output' | 'bidirectional' | 'power' | 'passive';

export interface PinDef {
  id: string;
  name: string;
  number: string;
  type: PinType;
  position: Point; // relative to component origin
  direction: 'up' | 'down' | 'left' | 'right';
}

// ─── Component Symbol ──────────────────────────────────────────────────
export interface SymbolDef {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  description: string;
  referencePrefix: string;
  pins: PinDef[];
  bodyPaths: string[]; // SVG path data for symbol body
  bodyRects: { x: number; y: number; w: number; h: number }[];
  bodyCircles: { cx: number; cy: number; r: number }[];
  bodyLines: { x1: number; y1: number; x2: number; y2: number }[];
  labels: { text: string; x: number; y: number; fontSize: number; anchor: string }[];
  defaultValues: Record<string, string>;
  propertySchema: PropertySchema[];
  simulationModel: SimulationModelDef;
  width: number;
  height: number;
}

export interface PropertySchema {
  key: string;
  label: string;
  type: 'string' | 'number' | 'select' | 'boolean';
  default: string;
  options?: string[];
  unit?: string;
  description?: string;
  spicParam?: string;
}

export interface SimulationModelDef {
  type: 'passive' | 'source' | 'diode' | 'transistor' | 'opamp' | 'digital' | 'switch' | 'transformer';
  spiceTemplate?: string;
  defaultParams?: Record<string, number | string>;
}

// ─── Component Instance ────────────────────────────────────────────────
export interface ComponentInstance {
  id: string;
  symbolId: string;
  reference: string;
  value: string;
  position: Point;
  transform: Transform;
  properties: Record<string, string>;
  visible: { reference: boolean; value: boolean; pinNames: boolean };
}

// ─── Wire ──────────────────────────────────────────────────────────────
export interface WireSegment {
  id: string;
  points: Point[];
  netId?: string;
}

export interface Junction {
  id: string;
  position: Point;
  netId?: string;
}

// ─── Net Label ─────────────────────────────────────────────────────────
export interface NetLabel {
  id: string;
  name: string;
  position: Point;
  orientation: Orientation;
  netId?: string;
  isGlobal: boolean;
}

// ─── Power Symbol ──────────────────────────────────────────────────────
export interface PowerSymbol {
  id: string;
  type: 'gnd' | 'vcc' | 'vdd' | 'vee' | 'vss';
  position: Point;
  netId?: string;
}

// ─── Probe ─────────────────────────────────────────────────────────────
export type ProbeType = 'voltage' | 'current' | 'differential' | 'power';

export interface Probe {
  id: string;
  type: ProbeType;
  name: string;
  color: string;
  position: Point;
  netId?: string;
  componentId?: string;
  refNetId?: string; // for differential
  visible: boolean;
  plotVisible: boolean;
}

// ─── Net ───────────────────────────────────────────────────────────────
export interface Net {
  id: string;
  name: string;
  type: 'signal' | 'power' | 'ground' | 'bus';
  pinRefs: { componentId: string; pinId: string }[];
  wireIds: string[];
  junctionIds: string[];
  labelIds: string[];
  probeIds: string[];
}

// ─── Instrument ────────────────────────────────────────────────────────
export type InstrumentType = 'oscilloscope' | 'functionGenerator' | 'multimeter' | 'bodePlotter' | 'logicAnalyzer';

export interface Instrument {
  id: string;
  type: InstrumentType;
  reference: string;
  name: string;
  position: Point;
  connections: { pin: string; netId: string }[];
  settings: Record<string, unknown>;
  windowState: { x: number; y: number; width: number; height: number; visible: boolean; docked: boolean };
}

// ─── Bus ───────────────────────────────────────────────────────────────
export interface Bus {
  id: string;
  name: string;
  points: Point[];
  entryIds: string[];
}

export interface BusEntry {
  id: string;
  busId: string;
  position: Point;
  orientation: Orientation;
  netIds: string[];
}

// ─── Simulation ────────────────────────────────────────────────────────
export type AnalysisType = 'op' | 'transient' | 'ac' | 'dcSweep' | 'paramSweep' | 'temperatureSweep' | 'fourier';

export interface SimulationSettings {
  analysisType: AnalysisType;
  transient?: {
    startTime: number;
    stopTime: number;
    maxTimeStep: number;
    initialTimeStep: number;
    useOperatingPoint: boolean;
    useIC: boolean;
  };
  ac?: {
    startFreq: number;
    stopFreq: number;
    sweepType: 'linear' | 'decade' | 'octave';
    pointsPerDecade: number;
    inputSource: string;
  };
  dcSweep?: {
    source: string;
    startValue: number;
    stopValue: number;
    stepValue: number;
    secondSource?: string;
    secondStart?: number;
    secondStop?: number;
    secondStep?: number;
  };
  paramSweep?: {
    target: string; // e.g. "R1.resistance" or a design variable
    sweepType: 'linear' | 'logarithmic' | 'list';
    startValue?: number;
    stopValue?: number;
    points?: number;
    values?: number[];
  };
  operatingPoint?: {};
}

export interface SimulationResult {
  id: string;
  timestamp: number;
  analysisType: AnalysisType;
  status: 'success' | 'error' | 'convergence_warning';
  parameters: Record<string, unknown>;
  traces: SimTrace[];
  measurements: Record<string, number>;
  error?: string;
}

export interface SimTrace {
  id: string;
  name: string;
  color: string;
  xUnit: string;
  yUnit: string;
  xData: Float64Array;
  yData: Float64Array;
  sweepParam?: string;
  sweepValue?: number;
}

// ─── Project ───────────────────────────────────────────────────────────
export interface ProjectSheet {
  id: string;
  name: string;
  components: ComponentInstance[];
  wires: WireSegment[];
  junctions: Junction[];
  labels: NetLabel[];
  powerSymbols: PowerSymbol[];
  buses: Bus[];
  busEntries: BusEntry[];
  instruments: Instrument[];
  probes: Probe[];
  width: number;
  height: number;
}

export interface DesignVariable {
  name: string;
  value: string;
  description: string;
}

export interface ERCMessage {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  objectId?: string;
  objectType?: string;
  position?: Point;
}

export interface Project {
  schemaVersion: number;
  id: string;
  name: string;
  description: string;
  createdAt: number;
  modifiedAt: number;
  sheets: ProjectSheet[];
  nets: Net[];
  designVariables: DesignVariable[];
  simulationSettings: SimulationSettings;
  savedResults: SimulationResult[];
  uiState: {
    leftPanelVisible: boolean;
    rightPanelVisible: boolean;
    bottomPanelVisible: boolean;
    darkMode: boolean;
    gridVisible: boolean;
    snapEnabled: boolean;
    rulersVisible: boolean;
    zoom: number;
    panX: number;
    panY: number;
  };
}