// CircuitBench Component Library
import type { SymbolDef, PinDef } from './types';

function pin(id: string, name: string, number: string, type: PinDef['type'], x: number, y: number, dir: PinDef['direction']): PinDef {
  return { id, name, number, type, position: { x, y }, direction: dir };
}

// ─── PASSIVE COMPONENTS ────────────────────────────────────────────────

export const RESISTOR: SymbolDef = {
  id: 'resistor', name: 'Resistor', category: 'Basic', subcategory: 'Passive',
  description: 'Fixed resistor', referencePrefix: 'R',
  pins: [
    pin('p1', '1', '1', 'passive', -40, 0, 'left'),
    pin('p2', '2', '2', 'passive', 40, 0, 'right'),
  ],
  bodyPaths: ['M -40 0 L -20 0 L -15 -8 L -5 8 L 5 -8 L 15 8 L 20 0 L 40 0'],
  bodyRects: [], bodyCircles: [], bodyLines: [],
  labels: [
    { text: '@REF', x: 0, y: -16, fontSize: 10, anchor: 'middle' },
    { text: '@VALUE', x: 0, y: 18, fontSize: 10, anchor: 'middle' },
  ],
  defaultValues: { resistance: '1k' },
  propertySchema: [
    { key: 'resistance', label: 'Resistance', type: 'string', default: '1k', unit: 'Ω' },
    { key: 'tolerance', label: 'Tolerance', type: 'string', default: '5%', unit: '%' },
    { key: 'power', label: 'Power Rating', type: 'string', default: '0.25', unit: 'W' },
  ],
  simulationModel: { type: 'passive', spiceTemplate: 'R@REF @P1 @P2 @RESISTANCE', defaultParams: { resistance: 1000 } },
  width: 80, height: 20,
};

export const CAPACITOR: SymbolDef = {
  id: 'capacitor', name: 'Capacitor', category: 'Basic', subcategory: 'Passive',
  description: 'Fixed capacitor', referencePrefix: 'C',
  pins: [
    pin('p1', '1', '1', 'passive', -30, 0, 'left'),
    pin('p2', '2', '2', 'passive', 30, 0, 'right'),
  ],
  bodyPaths: [],
  bodyRects: [],
  bodyCircles: [],
  bodyLines: [
    { x1: -30, y1: 0, x2: -6, y2: 0 },
    { x1: 6, y1: 0, x2: 30, y2: 0 },
  ],
  labels: [
    { text: '@REF', x: 0, y: -16, fontSize: 10, anchor: 'middle' },
    { text: '@VALUE', x: 0, y: 18, fontSize: 10, anchor: 'middle' },
  ],
  defaultValues: { capacitance: '100n' },
  propertySchema: [
    { key: 'capacitance', label: 'Capacitance', type: 'string', default: '100n', unit: 'F' },
    { key: 'voltage', label: 'Voltage Rating', type: 'string', default: '50', unit: 'V' },
  ],
  simulationModel: { type: 'passive', spiceTemplate: 'C@REF @P1 @P2 @CAPACITANCE', defaultParams: { capacitance: 1e-7 } },
  width: 60, height: 16,
};

export const INDUCTOR: SymbolDef = {
  id: 'inductor', name: 'Inductor', category: 'Basic', subcategory: 'Passive',
  description: 'Fixed inductor', referencePrefix: 'L',
  pins: [
    pin('p1', '1', '1', 'passive', -40, 0, 'left'),
    pin('p2', '2', '2', 'passive', 40, 0, 'right'),
  ],
  bodyPaths: ['M -40 0 L -30 0 C -30 -14 -20 -14 -20 0 C -20 -14 -10 -14 -10 0 C -10 -14 0 -14 0 0 C 0 -14 10 -14 10 0 C 10 -14 20 -14 20 0 C 20 -14 30 -14 30 0 L 40 0'],
  bodyRects: [], bodyCircles: [], bodyLines: [],
  labels: [
    { text: '@REF', x: 0, y: -20, fontSize: 10, anchor: 'middle' },
    { text: '@VALUE', x: 0, y: 18, fontSize: 10, anchor: 'middle' },
  ],
  defaultValues: { inductance: '10m' },
  propertySchema: [
    { key: 'inductance', label: 'Inductance', type: 'string', default: '10m', unit: 'H' },
  ],
  simulationModel: { type: 'passive', spiceTemplate: 'L@REF @P1 @P2 @INDUCTANCE', defaultParams: { inductance: 0.01 } },
  width: 80, height: 30,
};

export const POTENTIOMETER: SymbolDef = {
  id: 'potentiometer', name: 'Potentiometer', category: 'Basic', subcategory: 'Passive',
  description: 'Variable resistor (potentiometer)', referencePrefix: 'RP',
  pins: [
    pin('p1', '1', '1', 'passive', -40, -20, 'left'),
    pin('p2', '2', '2', 'passive', 40, -20, 'right'),
    pin('w', 'W', 'W', 'passive', 0, 20, 'down'),
  ],
  bodyPaths: ['M -40 -20 L -20 -20 L -15 -28 L -5 -12 L 5 -28 L 15 -12 L 20 -20 L 40 -20'],
  bodyRects: [], bodyCircles: [],
  bodyLines: [
    { x1: 0, y1: -10, x2: 0, y2: 20 },
  ],
  labels: [
    { text: '@REF', x: 0, y: -36, fontSize: 10, anchor: 'middle' },
    { text: '@VALUE', x: 24, y: 4, fontSize: 10, anchor: 'start' },
  ],
  defaultValues: { resistance: '10k', position: '50' },
  propertySchema: [
    { key: 'resistance', label: 'Resistance', type: 'string', default: '10k', unit: 'Ω' },
    { key: 'position', label: 'Position', type: 'string', default: '50', unit: '%' },
  ],
  simulationModel: { type: 'passive', spiceTemplate: 'R@REF @P1 @W @RESISTANCE', defaultParams: { resistance: 10000 } },
  width: 80, height: 50,
};

// ─── SOURCES ───────────────────────────────────────────────────────────

export const VOLTAGE_SOURCE: SymbolDef = {
  id: 'voltage_source', name: 'DC Voltage Source', category: 'Sources', subcategory: 'DC',
  description: 'Independent DC voltage source', referencePrefix: 'V',
  pins: [
    pin('pos', '+', '1', 'output', 0, -30, 'up'),
    pin('neg', '-', '2', 'input', 0, 30, 'down'),
  ],
  bodyPaths: [],
  bodyRects: [],
  bodyCircles: [{ cx: 0, cy: 0, r: 20 }],
  bodyLines: [
    { x1: 0, y1: -30, x2: 0, y2: -20 },
    { x1: 0, y1: 20, x2: 0, y2: 30 },
    { x1: -8, y1: -8, x2: -8, y2: 4 },
    { x1: -12, y1: -2, x2: -4, y2: -2 },
    { x1: -10, y1: 6, x2: 10, y2: 6 },
    { x1: -6, y1: 10, x2: 6, y2: 10 },
  ],
  labels: [
    { text: '@REF', x: 24, y: -8, fontSize: 10, anchor: 'start' },
    { text: '@VALUE', x: 24, y: 6, fontSize: 10, anchor: 'start' },
  ],
  defaultValues: { dc: '5' },
  propertySchema: [
    { key: 'dc', label: 'DC Voltage', type: 'string', default: '5', unit: 'V' },
    { key: 'ac_mag', label: 'AC Magnitude', type: 'string', default: '0', unit: 'V' },
    { key: 'ac_phase', label: 'AC Phase', type: 'string', default: '0', unit: '°' },
  ],
  simulationModel: { type: 'source', spiceTemplate: 'V@REF @POS @NEG DC @DC AC @AC_MAG @AC_PHASE', defaultParams: { dc: 5 } },
  width: 40, height: 60,
};

export const CURRENT_SOURCE: SymbolDef = {
  id: 'current_source', name: 'DC Current Source', category: 'Sources', subcategory: 'DC',
  description: 'Independent DC current source', referencePrefix: 'I',
  pins: [
    pin('pos', '+', '1', 'output', 0, -30, 'up'),
    pin('neg', '-', '2', 'input', 0, 30, 'down'),
  ],
  bodyPaths: [],
  bodyRects: [],
  bodyCircles: [{ cx: 0, cy: 0, r: 20 }],
  bodyLines: [
    { x1: 0, y1: -30, x2: 0, y2: -20 },
    { x1: 0, y1: 20, x2: 0, y2: 30 },
    { x1: 0, y1: 8, x2: 0, y2: -8 },
    { x1: -4, y1: -4, x2: 0, y2: -8 },
    { x1: 4, y1: -4, x2: 0, y2: -8 },
  ],
  labels: [
    { text: '@REF', x: 24, y: -8, fontSize: 10, anchor: 'start' },
    { text: '@VALUE', x: 24, y: 6, fontSize: 10, anchor: 'start' },
  ],
  defaultValues: { dc: '1m' },
  propertySchema: [
    { key: 'dc', label: 'DC Current', type: 'string', default: '1m', unit: 'A' },
  ],
  simulationModel: { type: 'source', spiceTemplate: 'I@REF @POS @NEG DC @DC', defaultParams: { dc: 0.001 } },
  width: 40, height: 60,
};

export const SINE_SOURCE: SymbolDef = {
  id: 'sine_source', name: 'Sine Voltage Source', category: 'Sources', subcategory: 'AC',
  description: 'Sinusoidal voltage source', referencePrefix: 'V',
  pins: [
    pin('pos', '+', '1', 'output', 0, -30, 'up'),
    pin('neg', '-', '2', 'input', 0, 30, 'down'),
  ],
  bodyPaths: [],
  bodyRects: [],
  bodyCircles: [{ cx: 0, cy: 0, r: 20 }],
  bodyLines: [
    { x1: 0, y1: -30, x2: 0, y2: -20 },
    { x1: 0, y1: 20, x2: 0, y2: 30 },
  ],
  labels: [
    { text: '@REF', x: 24, y: -8, fontSize: 10, anchor: 'start' },
    { text: '@VALUE', x: 24, y: 6, fontSize: 10, anchor: 'start' },
  ],
  defaultValues: { offset: '0', amplitude: '5', frequency: '1k' },
  propertySchema: [
    { key: 'offset', label: 'DC Offset', type: 'string', default: '0', unit: 'V' },
    { key: 'amplitude', label: 'Amplitude', type: 'string', default: '5', unit: 'V' },
    { key: 'frequency', label: 'Frequency', type: 'string', default: '1k', unit: 'Hz' },
    { key: 'delay', label: 'Delay', type: 'string', default: '0', unit: 's' },
    { key: 'damping', label: 'Damping', type: 'string', default: '0', unit: '1/s' },
    { key: 'phase', label: 'Phase', type: 'string', default: '0', unit: '°' },
  ],
  simulationModel: { type: 'source', spiceTemplate: 'V@REF @POS @NEG SIN(@OFFSET @AMPLITUDE @FREQUENCY @DELAY @DAMPING @PHASE)', defaultParams: { offset: 0, amplitude: 5, frequency: 1000 } },
  width: 40, height: 60,
};

export const PULSE_SOURCE: SymbolDef = {
  id: 'pulse_source', name: 'Pulse Voltage Source', category: 'Sources', subcategory: 'Transient',
  description: 'Pulse voltage source', referencePrefix: 'V',
  pins: [
    pin('pos', '+', '1', 'output', 0, -30, 'up'),
    pin('neg', '-', '2', 'input', 0, 30, 'down'),
  ],
  bodyPaths: [],
  bodyRects: [],
  bodyCircles: [{ cx: 0, cy: 0, r: 20 }],
  bodyLines: [
    { x1: 0, y1: -30, x2: 0, y2: -20 },
    { x1: 0, y1: 20, x2: 0, y2: 30 },
  ],
  labels: [
    { text: '@REF', x: 24, y: -8, fontSize: 10, anchor: 'start' },
    { text: '@VALUE', x: 24, y: 6, fontSize: 10, anchor: 'start' },
  ],
  defaultValues: { v1: '0', v2: '5', delay: '0', rise: '1n', fall: '1n', width: '0.5m', period: '1m' },
  propertySchema: [
    { key: 'v1', label: 'Initial Value', type: 'string', default: '0', unit: 'V' },
    { key: 'v2', label: 'Pulse Value', type: 'string', default: '5', unit: 'V' },
    { key: 'delay', label: 'Delay', type: 'string', default: '0', unit: 's' },
    { key: 'rise', label: 'Rise Time', type: 'string', default: '1n', unit: 's' },
    { key: 'fall', label: 'Fall Time', type: 'string', default: '1n', unit: 's' },
    { key: 'width', label: 'Pulse Width', type: 'string', default: '0.5m', unit: 's' },
    { key: 'period', label: 'Period', type: 'string', default: '1m', unit: 's' },
  ],
  simulationModel: { type: 'source', spiceTemplate: 'V@REF @POS @NEG PULSE(@V1 @V2 @DELAY @RISE @FALL @WIDTH @PERIOD)', defaultParams: { v1: 0, v2: 5, delay: 0, rise: 1e-9, fall: 1e-9, width: 5e-4, period: 1e-3 } },
  width: 40, height: 60,
};

// ─── DIODES ────────────────────────────────────────────────────────────

export const DIODE: SymbolDef = {
  id: 'diode', name: 'Diode', category: 'Diodes', subcategory: 'Standard',
  description: 'Standard silicon diode', referencePrefix: 'D',
  pins: [
    pin('anode', 'A', '1', 'passive', -30, 0, 'left'),
    pin('cathode', 'K', '2', 'passive', 30, 0, 'right'),
  ],
  bodyPaths: [
    'M -30 0 L -10 0 M -10 -12 L -10 12 L 14 0 Z M 14 -12 L 14 12 L 30 0 L 14 -12 Z M 14 0 L 30 0',
  ],
  bodyRects: [], bodyCircles: [], bodyLines: [],
  labels: [
    { text: '@REF', x: 0, y: -18, fontSize: 10, anchor: 'middle' },
    { text: '@VALUE', x: 0, y: 20, fontSize: 10, anchor: 'middle' },
  ],
  defaultValues: { model: 'Ddefault', is: '1e-14', n: '1' },
  propertySchema: [
    { key: 'model', label: 'Model', type: 'string', default: 'Ddefault' },
    { key: 'is', label: 'Saturation Current', type: 'string', default: '1e-14', unit: 'A' },
    { key: 'n', label: 'Emission Coefficient', type: 'string', default: '1' },
  ],
  simulationModel: { type: 'diode', spiceTemplate: 'D@REF @ANODE @CATHODE @MODEL', defaultParams: { is: 1e-14, n: 1, bv: 100 } },
  width: 60, height: 28,
};

export const ZENER: SymbolDef = {
  id: 'zener', name: 'Zener Diode', category: 'Diodes', subcategory: 'Standard',
  description: 'Zener voltage regulator diode', referencePrefix: 'D',
  pins: [
    pin('anode', 'A', '1', 'passive', -30, 0, 'left'),
    pin('cathode', 'K', '2', 'passive', 30, 0, 'right'),
  ],
  bodyPaths: [
    'M -30 0 L -10 0 M -10 -12 L -10 12 L 14 0 Z M 14 -12 L 14 12 L 30 0 L 14 -12 Z M 14 0 L 30 0 M 8 -16 L 14 -12',
  ],
  bodyRects: [], bodyCircles: [], bodyLines: [],
  labels: [
    { text: '@REF', x: 0, y: -22, fontSize: 10, anchor: 'middle' },
    { text: '@VALUE', x: 0, y: 20, fontSize: 10, anchor: 'middle' },
  ],
  defaultValues: { vz: '5.1' },
  propertySchema: [
    { key: 'vz', label: 'Zener Voltage', type: 'string', default: '5.1', unit: 'V' },
  ],
  simulationModel: { type: 'diode', spiceTemplate: 'D@REF @ANODE @CATHODE ZENER', defaultParams: { bv: 5.1, is: 1e-14 } },
  width: 60, height: 32,
};

export const LED: SymbolDef = {
  id: 'led', name: 'LED', category: 'Diodes', subcategory: 'Indicator',
  description: 'Light Emitting Diode', referencePrefix: 'D',
  pins: [
    pin('anode', 'A', '1', 'passive', -30, 0, 'left'),
    pin('cathode', 'K', '2', 'passive', 30, 0, 'right'),
  ],
  bodyPaths: [
    'M -30 0 L -10 0 M -10 -12 L -10 12 L 14 0 Z M 14 -12 L 14 12 L 30 0 L 14 -12 Z M 14 0 L 30 0 M 18 -18 L 24 -24 M 20 -14 L 26 -20 M 16 -8 L 22 -14',
  ],
  bodyRects: [], bodyCircles: [], bodyLines: [],
  labels: [
    { text: '@REF', x: 0, y: -26, fontSize: 10, anchor: 'middle' },
    { text: '@VALUE', x: 0, y: 20, fontSize: 10, anchor: 'middle' },
  ],
  defaultValues: { color: 'Red', vf: '2.0' },
  propertySchema: [
    { key: 'color', label: 'Color', type: 'select', default: 'Red', options: ['Red', 'Green', 'Blue', 'Yellow', 'White'] },
    { key: 'vf', label: 'Forward Voltage', type: 'string', default: '2.0', unit: 'V' },
  ],
  simulationModel: { type: 'diode', spiceTemplate: 'D@REF @ANODE @CATHODE LED', defaultParams: { is: 1e-20, n: 2, bv: 5 } },
  width: 60, height: 36,
};

// ─── TRANSISTORS ───────────────────────────────────────────────────────

export const BJT_NPN: SymbolDef = {
  id: 'bjt_npn', name: 'NPN BJT', category: 'Transistors', subcategory: 'BJT',
  description: 'NPN bipolar junction transistor', referencePrefix: 'Q',
  pins: [
    pin('c', 'C', '1', 'passive', 0, -30, 'up'),
    pin('b', 'B', '2', 'input', -30, 0, 'left'),
    pin('e', 'E', '3', 'passive', 0, 30, 'down'),
  ],
  bodyPaths: [
    'M -10 -20 L -10 20 M -10 -10 L 20 -26 M -10 10 L 20 26',
  ],
  bodyRects: [],
  bodyCircles: [],
  bodyLines: [
    { x1: -30, y1: 0, x2: -10, y2: 0 },
    { x1: 0, y1: -30, x2: 0, y2: -20 },
    { x1: 0, y1: 20, x2: 0, y2: 30 },
  ],
  labels: [
    { text: '@REF', x: 14, y: -14, fontSize: 10, anchor: 'start' },
  ],
  defaultValues: { model: 'NPNdefault', bf: '100' },
  propertySchema: [
    { key: 'model', label: 'Model', type: 'string', default: 'NPNdefault' },
    { key: 'bf', label: 'Forward Beta', type: 'string', default: '100' },
  ],
  simulationModel: { type: 'transistor', spiceTemplate: 'Q@REF @C @B @E @MODEL', defaultParams: { bf: 100, is: 1e-14, vaf: 100 } },
  width: 60, height: 60,
};

export const BJT_PNP: SymbolDef = {
  id: 'bjt_pnp', name: 'PNP BJT', category: 'Transistors', subcategory: 'BJT',
  description: 'PNP bipolar junction transistor', referencePrefix: 'Q',
  pins: [
    pin('c', 'C', '1', 'passive', 0, 30, 'down'),
    pin('b', 'B', '2', 'input', -30, 0, 'left'),
    pin('e', 'E', '3', 'passive', 0, -30, 'up'),
  ],
  bodyPaths: [
    'M -10 -20 L -10 20 M -10 10 L 20 26 M -10 -10 L 20 -26',
  ],
  bodyRects: [],
  bodyCircles: [],
  bodyLines: [
    { x1: -30, y1: 0, x2: -10, y2: 0 },
    { x1: 0, y1: -30, x2: 0, y2: -20 },
    { x1: 0, y1: 20, x2: 0, y2: 30 },
  ],
  labels: [
    { text: '@REF', x: 14, y: -14, fontSize: 10, anchor: 'start' },
  ],
  defaultValues: { model: 'PNPdefault', bf: '100' },
  propertySchema: [
    { key: 'model', label: 'Model', type: 'string', default: 'PNPdefault' },
    { key: 'bf', label: 'Forward Beta', type: 'string', default: '100' },
  ],
  simulationModel: { type: 'transistor', spiceTemplate: 'Q@REF @C @B @E @MODEL', defaultParams: { bf: 100, is: 1e-14, vaf: 100 } },
  width: 60, height: 60,
};

export const NMOS: SymbolDef = {
  id: 'nmos', name: 'NMOS', category: 'Transistors', subcategory: 'MOSFET',
  description: 'N-channel MOSFET', referencePrefix: 'M',
  pins: [
    pin('d', 'D', '1', 'passive', 0, -30, 'up'),
    pin('g', 'G', '2', 'input', -30, 0, 'left'),
    pin('s', 'S', '3', 'passive', 0, 30, 'down'),
  ],
  bodyPaths: [
    'M -14 -20 L -14 20 M -8 -20 L -8 20 M -8 -12 L 8 -12 L 8 -20 M -8 12 L 8 12 L 8 20 M -8 0 L -20 0',
  ],
  bodyRects: [],
  bodyCircles: [],
  bodyLines: [
    { x1: -30, y1: 0, x2: -20, y2: 0 },
    { x1: 0, y1: -30, x2: 0, y2: -20 },
    { x1: 0, y1: 20, x2: 0, y2: 30 },
  ],
  labels: [
    { text: '@REF', x: 12, y: -8, fontSize: 10, anchor: 'start' },
  ],
  defaultValues: { model: 'NMOSdefault', w: '10u', l: '1u' },
  propertySchema: [
    { key: 'model', label: 'Model', type: 'string', default: 'NMOSdefault' },
    { key: 'w', label: 'Width', type: 'string', default: '10u', unit: 'm' },
    { key: 'l', label: 'Length', type: 'string', default: '1u', unit: 'm' },
  ],
  simulationModel: { type: 'transistor', spiceTemplate: 'M@REF @D @G @S 0 @MODEL W=@W L=@L', defaultParams: { vto: 1, kp: 2e-5 } },
  width: 60, height: 60,
};

export const PMOS: SymbolDef = {
  id: 'pmos', name: 'PMOS', category: 'Transistors', subcategory: 'MOSFET',
  description: 'P-channel MOSFET', referencePrefix: 'M',
  pins: [
    pin('d', 'D', '1', 'passive', 0, 30, 'down'),
    pin('g', 'G', '2', 'input', -30, 0, 'left'),
    pin('s', 'S', '3', 'passive', 0, -30, 'up'),
  ],
  bodyPaths: [
    'M -14 -20 L -14 20 M -8 -20 L -8 20 M -8 -12 L 8 -12 L 8 -20 M -8 12 L 8 12 L 8 20 M -8 0 L -20 0',
  ],
  bodyRects: [],
  bodyCircles: [],
  bodyLines: [
    { x1: -30, y1: 0, x2: -20, y2: 0 },
    { x1: 0, y1: -30, x2: 0, y2: -20 },
    { x1: 0, y1: 20, x2: 0, y2: 30 },
  ],
  labels: [
    { text: '@REF', x: 12, y: -8, fontSize: 10, anchor: 'start' },
  ],
  defaultValues: { model: 'PMOSdefault', w: '10u', l: '1u' },
  propertySchema: [
    { key: 'model', label: 'Model', type: 'string', default: 'PMOSdefault' },
    { key: 'w', label: 'Width', type: 'string', default: '10u', unit: 'm' },
    { key: 'l', label: 'Length', type: 'string', default: '1u', unit: 'm' },
  ],
  simulationModel: { type: 'transistor', spiceTemplate: 'M@REF @D @G @S 0 @MODEL W=@W L=@L', defaultParams: { vto: -1, kp: 1e-5 } },
  width: 60, height: 60,
};

// ─── ANALOG ────────────────────────────────────────────────────────────

export const IDEAL_OPAMP: SymbolDef = {
  id: 'ideal_opamp', name: 'Ideal Op Amp', category: 'Analog', subcategory: 'Op Amp',
  description: 'Ideal operational amplifier', referencePrefix: 'U',
  pins: [
    pin('inp', '+', '1', 'input', -30, 12, 'left'),
    pin('inn', '-', '2', 'input', -30, -12, 'left'),
    pin('out', 'OUT', '3', 'output', 30, 0, 'right'),
  ],
  bodyPaths: [
    'M -20 -24 L -20 24 L 24 0 Z',
  ],
  bodyRects: [], bodyCircles: [], bodyLines: [
    { x1: -30, y1: 12, x2: -20, y2: 12 },
    { x1: -30, y1: -12, x2: -20, y2: -12 },
    { x1: 24, y1: 0, x2: 30, y2: 0 },
    { x1: -18, y1: -8, x2: -18, y2: 8 },
    { x1: -14, y1: -4, x2: -14, y2: 4 },
  ],
  labels: [
    { text: '@REF', x: 0, y: -30, fontSize: 10, anchor: 'middle' },
  ],
  defaultValues: { gain: '100000' },
  propertySchema: [
    { key: 'gain', label: 'Open Loop Gain', type: 'string', default: '100000' },
  ],
  simulationModel: { type: 'opamp', spiceTemplate: '', defaultParams: { gain: 100000 } },
  width: 60, height: 52,
};

export const COMPARATOR: SymbolDef = {
  id: 'comparator', name: 'Comparator', category: 'Analog', subcategory: 'Op Amp',
  description: 'Voltage comparator', referencePrefix: 'U',
  pins: [
    pin('inp', '+', '1', 'input', -30, 12, 'left'),
    pin('inn', '-', '2', 'input', -30, -12, 'left'),
    pin('out', 'OUT', '3', 'output', 30, 0, 'right'),
  ],
  bodyPaths: [
    'M -20 -24 L -20 24 L 24 0 Z',
  ],
  bodyRects: [], bodyCircles: [], bodyLines: [
    { x1: -30, y1: 12, x2: -20, y2: 12 },
    { x1: -30, y1: -12, x2: -20, y2: -12 },
    { x1: 24, y1: 0, x2: 30, y2: 0 },
  ],
  labels: [
    { text: '@REF', x: 0, y: -30, fontSize: 10, anchor: 'middle' },
  ],
  defaultValues: { voh: '5', vol: '0' },
  propertySchema: [
    { key: 'voh', label: 'Output High', type: 'string', default: '5', unit: 'V' },
    { key: 'vol', label: 'Output Low', type: 'string', default: '0', unit: 'V' },
  ],
  simulationModel: { type: 'opamp', spiceTemplate: '', defaultParams: { voh: 5, vol: 0 } },
  width: 60, height: 52,
};

export const SWITCH: SymbolDef = {
  id: 'switch', name: 'Switch', category: 'Basic', subcategory: 'Switch',
  description: 'SPST Switch', referencePrefix: 'SW',
  pins: [
    pin('p1', '1', '1', 'passive', -30, 0, 'left'),
    pin('p2', '2', '2', 'passive', 30, 0, 'right'),
  ],
  bodyPaths: [],
  bodyRects: [], bodyCircles: [{ cx: -18, cy: 0, r: 3 }, { cx: 18, cy: 0, r: 3 }],
  bodyLines: [
    { x1: -30, y1: 0, x2: -18, y2: 0 },
    { x1: 18, y1: 0, x2: 30, y2: 0 },
    { x1: -18, y1: 0, x2: 14, y2: -12 },
  ],
  labels: [
    { text: '@REF', x: 0, y: -18, fontSize: 10, anchor: 'middle' },
  ],
  defaultValues: { state: 'open' },
  propertySchema: [
    { key: 'state', label: 'Initial State', type: 'select', default: 'open', options: ['open', 'closed'] },
  ],
  simulationModel: { type: 'switch', spiceTemplate: '', defaultParams: { ron: 0.001, roff: 1e9 } },
  width: 60, height: 20,
};

export const TRANSFORMER: SymbolDef = {
  id: 'transformer', name: 'Transformer', category: 'Basic', subcategory: 'Coupling',
  description: 'Ideal transformer', referencePrefix: 'T',
  pins: [
    pin('p1', '1', '1', 'passive', -40, -20, 'left'),
    pin('p2', '2', '2', 'passive', -40, 20, 'left'),
    pin('s1', '3', '3', 'passive', 40, -20, 'right'),
    pin('s2', '4', '4', 'passive', 40, 20, 'right'),
  ],
  bodyPaths: [
    'M -30 -30 C -30 -30 -40 -20 -30 -10 C -20 0 -40 10 -30 20 C -20 30 -30 30 -30 30 M 30 -30 C 30 -30 40 -20 30 -10 C 20 0 40 10 30 20 C 20 30 30 30 30 30',
  ],
  bodyRects: [], bodyCircles: [], bodyLines: [
    { x1: -40, y1: -20, x2: -30, y2: -20 },
    { x1: -40, y1: 20, x2: -30, y2: 20 },
    { x1: 40, y1: -20, x2: 30, y2: -20 },
    { x1: 40, y1: 20, x2: 30, y2: 20 },
    { x1: -10, y1: -26, x2: -10, y2: 26 },
    { x1: 10, y1: -26, x2: 10, y2: 26 },
  ],
  labels: [
    { text: '@REF', x: 0, y: -36, fontSize: 10, anchor: 'middle' },
  ],
  defaultValues: { turns_ratio: '1' },
  propertySchema: [
    { key: 'turns_ratio', label: 'Turns Ratio', type: 'string', default: '1' },
  ],
  simulationModel: { type: 'transformer', spiceTemplate: '', defaultParams: { ratio: 1 } },
  width: 80, height: 60,
};

// ─── POWER ─────────────────────────────────────────────────────────────

export const GROUND: SymbolDef = {
  id: 'ground', name: 'Ground', category: 'Power', subcategory: 'Ground',
  description: 'Ground reference (0V)', referencePrefix: '',
  pins: [
    pin('gnd', 'GND', '1', 'power', 0, -20, 'up'),
  ],
  bodyPaths: [
    'M 0 -20 L 0 0 M -12 0 L 12 0 M -8 6 L 8 6 M -4 12 L 4 12',
  ],
  bodyRects: [], bodyCircles: [], bodyLines: [],
  labels: [],
  defaultValues: {},
  propertySchema: [],
  simulationModel: { type: 'source', spiceTemplate: '', defaultParams: {} },
  width: 24, height: 32,
};

export const VCC: SymbolDef = {
  id: 'vcc', name: 'VCC', category: 'Power', subcategory: 'Supply',
  description: 'Positive power supply', referencePrefix: '',
  pins: [
    pin('vcc', 'VCC', '1', 'power', 0, 20, 'down'),
  ],
  bodyPaths: [
    'M 0 20 L 0 4 M -8 4 L 0 -6 L 8 4',
  ],
  bodyRects: [], bodyCircles: [], bodyLines: [],
  labels: [
    { text: 'VCC', x: 0, y: -14, fontSize: 10, anchor: 'middle' },
  ],
  defaultValues: { voltage: '5' },
  propertySchema: [
    { key: 'voltage', label: 'Voltage', type: 'string', default: '5', unit: 'V' },
  ],
  simulationModel: { type: 'source', spiceTemplate: '', defaultParams: { voltage: 5 } },
  width: 16, height: 30,
};

export const VDD: SymbolDef = {
  id: 'vdd', name: 'VDD', category: 'Power', subcategory: 'Supply',
  description: 'Positive supply for MOS circuits', referencePrefix: '',
  pins: [
    pin('vdd', 'VDD', '1', 'power', 0, 20, 'down'),
  ],
  bodyPaths: [
    'M 0 20 L 0 4 M -8 4 L 0 -6 L 8 4',
  ],
  bodyRects: [], bodyCircles: [], bodyLines: [],
  labels: [
    { text: 'VDD', x: 0, y: -14, fontSize: 10, anchor: 'middle' },
  ],
  defaultValues: { voltage: '3.3' },
  propertySchema: [
    { key: 'voltage', label: 'Voltage', type: 'string', default: '3.3', unit: 'V' },
  ],
  simulationModel: { type: 'source', spiceTemplate: '', defaultParams: { voltage: 3.3 } },
  width: 16, height: 30,
};

// ─── DIGITAL ───────────────────────────────────────────────────────────

export const NOT_GATE: SymbolDef = {
  id: 'not_gate', name: 'NOT Gate', category: 'Digital', subcategory: 'Logic',
  description: 'Logic inverter', referencePrefix: 'U',
  pins: [
    pin('in', 'IN', '1', 'input', -30, 0, 'left'),
    pin('out', 'OUT', '2', 'output', 30, 0, 'right'),
  ],
  bodyPaths: [
    'M -16 -16 L -16 16 L 16 0 Z',
  ],
  bodyRects: [],
  bodyCircles: [{ cx: 20, cy: 0, r: 4 }],
  bodyLines: [
    { x1: -30, y1: 0, x2: -16, y2: 0 },
    { x1: 24, y1: 0, x2: 30, y2: 0 },
  ],
  labels: [
    { text: '@REF', x: 0, y: -22, fontSize: 10, anchor: 'middle' },
  ],
  defaultValues: { model: '74HC04' },
  propertySchema: [{ key: 'model', label: 'Model', type: 'string', default: '74HC04' }],
  simulationModel: { type: 'digital', spiceTemplate: '', defaultParams: {} },
  width: 60, height: 36,
};

export const AND_GATE: SymbolDef = {
  id: 'and_gate', name: 'AND Gate', category: 'Digital', subcategory: 'Logic',
  description: '2-input AND gate', referencePrefix: 'U',
  pins: [
    pin('a', 'A', '1', 'input', -30, -10, 'left'),
    pin('b', 'B', '2', 'input', -30, 10, 'left'),
    pin('out', 'OUT', '3', 'output', 30, 0, 'right'),
  ],
  bodyPaths: [
    'M -16 -18 L -8 -18 C 14 -18 20 -14 20 0 C 20 14 14 18 -8 18 L -16 18 Z',
  ],
  bodyRects: [], bodyCircles: [], bodyLines: [
    { x1: -30, y1: -10, x2: -16, y2: -10 },
    { x1: -30, y1: 10, x2: -16, y2: 10 },
    { x1: 20, y1: 0, x2: 30, y2: 0 },
  ],
  labels: [
    { text: '@REF', x: 0, y: -24, fontSize: 10, anchor: 'middle' },
  ],
  defaultValues: { model: '74HC08' },
  propertySchema: [{ key: 'model', label: 'Model', type: 'string', default: '74HC08' }],
  simulationModel: { type: 'digital', spiceTemplate: '', defaultParams: {} },
  width: 60, height: 40,
};

export const OR_GATE: SymbolDef = {
  id: 'or_gate', name: 'OR Gate', category: 'Digital', subcategory: 'Logic',
  description: '2-input OR gate', referencePrefix: 'U',
  pins: [
    pin('a', 'A', '1', 'input', -30, -10, 'left'),
    pin('b', 'B', '2', 'input', -30, 10, 'left'),
    pin('out', 'OUT', '3', 'output', 30, 0, 'right'),
  ],
  bodyPaths: [
    'M -20 -18 L -8 -18 C 6 -18 14 -10 20 0 C 14 10 6 18 -8 18 L -20 18 C -10 0 -20 0 -20 -18 Z',
  ],
  bodyRects: [], bodyCircles: [], bodyLines: [
    { x1: -30, y1: -10, x2: -20, y2: -10 },
    { x1: -30, y1: 10, x2: -20, y2: 10 },
    { x1: 20, y1: 0, x2: 30, y2: 0 },
  ],
  labels: [
    { text: '@REF', x: 0, y: -24, fontSize: 10, anchor: 'middle' },
  ],
  defaultValues: { model: '74HC32' },
  propertySchema: [{ key: 'model', label: 'Model', type: 'string', default: '74HC32' }],
  simulationModel: { type: 'digital', spiceTemplate: '', defaultParams: {} },
  width: 60, height: 40,
};

export const NAND_GATE: SymbolDef = {
  id: 'nand_gate', name: 'NAND Gate', category: 'Digital', subcategory: 'Logic',
  description: '2-input NAND gate', referencePrefix: 'U',
  pins: [
    pin('a', 'A', '1', 'input', -30, -10, 'left'),
    pin('b', 'B', '2', 'input', -30, 10, 'left'),
    pin('out', 'OUT', '3', 'output', 30, 0, 'right'),
  ],
  bodyPaths: [
    'M -16 -18 L -8 -18 C 14 -18 20 -14 20 0 C 20 14 14 18 -8 18 L -16 18 Z',
  ],
  bodyRects: [],
  bodyCircles: [{ cx: 24, cy: 0, r: 4 }],
  bodyLines: [
    { x1: -30, y1: -10, x2: -16, y2: -10 },
    { x1: -30, y1: 10, x2: -16, y2: 10 },
    { x1: 28, y1: 0, x2: 30, y2: 0 },
  ],
  labels: [
    { text: '@REF', x: 0, y: -24, fontSize: 10, anchor: 'middle' },
  ],
  defaultValues: { model: '74HC00' },
  propertySchema: [{ key: 'model', label: 'Model', type: 'string', default: '74HC00' }],
  simulationModel: { type: 'digital', spiceTemplate: '', defaultParams: {} },
  width: 60, height: 40,
};

export const NOR_GATE: SymbolDef = {
  id: 'nor_gate', name: 'NOR Gate', category: 'Digital', subcategory: 'Logic',
  description: '2-input NOR gate', referencePrefix: 'U',
  pins: [
    pin('a', 'A', '1', 'input', -30, -10, 'left'),
    pin('b', 'B', '2', 'input', -30, 10, 'left'),
    pin('out', 'OUT', '3', 'output', 30, 0, 'right'),
  ],
  bodyPaths: [
    'M -20 -18 L -8 -18 C 6 -18 14 -10 20 0 C 14 10 6 18 -8 18 L -20 18 C -10 0 -20 0 -20 -18 Z',
  ],
  bodyRects: [],
  bodyCircles: [{ cx: 24, cy: 0, r: 4 }],
  bodyLines: [
    { x1: -30, y1: -10, x2: -20, y2: -10 },
    { x1: -30, y1: 10, x2: -20, y2: 10 },
    { x1: 28, y1: 0, x2: 30, y2: 0 },
  ],
  labels: [
    { text: '@REF', x: 0, y: -24, fontSize: 10, anchor: 'middle' },
  ],
  defaultValues: { model: '74HC02' },
  propertySchema: [{ key: 'model', label: 'Model', type: 'string', default: '74HC02' }],
  simulationModel: { type: 'digital', spiceTemplate: '', defaultParams: {} },
  width: 60, height: 40,
};

export const XOR_GATE: SymbolDef = {
  id: 'xor_gate', name: 'XOR Gate', category: 'Digital', subcategory: 'Logic',
  description: '2-input XOR gate', referencePrefix: 'U',
  pins: [
    pin('a', 'A', '1', 'input', -30, -10, 'left'),
    pin('b', 'B', '2', 'input', -30, 10, 'left'),
    pin('out', 'OUT', '3', 'output', 30, 0, 'right'),
  ],
  bodyPaths: [
    'M -24 -18 L -8 -18 C 6 -18 14 -10 20 0 C 14 10 6 18 -8 18 L -24 18 C -14 0 -24 0 -24 -18 Z M -20 -18 C -10 0 -20 0 -20 -18',
  ],
  bodyRects: [], bodyCircles: [], bodyLines: [
    { x1: -30, y1: -10, x2: -24, y2: -10 },
    { x1: -30, y1: 10, x2: -24, y2: 10 },
    { x1: 20, y1: 0, x2: 30, y2: 0 },
  ],
  labels: [
    { text: '@REF', x: 0, y: -24, fontSize: 10, anchor: 'middle' },
  ],
  defaultValues: { model: '74HC86' },
  propertySchema: [{ key: 'model', label: 'Model', type: 'string', default: '74HC86' }],
  simulationModel: { type: 'digital', spiceTemplate: '', defaultParams: {} },
  width: 60, height: 40,
};

export const BUFFER_GATE: SymbolDef = {
  id: 'buffer', name: 'Buffer', category: 'Digital', subcategory: 'Logic',
  description: 'Logic buffer', referencePrefix: 'U',
  pins: [
    pin('in', 'IN', '1', 'input', -30, 0, 'left'),
    pin('out', 'OUT', '2', 'output', 30, 0, 'right'),
  ],
  bodyPaths: ['M -16 -16 L -16 16 L 16 0 Z'],
  bodyRects: [], bodyCircles: [], bodyLines: [
    { x1: -30, y1: 0, x2: -16, y2: 0 },
    { x1: 16, y1: 0, x2: 30, y2: 0 },
  ],
  labels: [
    { text: '@REF', x: 0, y: -22, fontSize: 10, anchor: 'middle' },
  ],
  defaultValues: { model: '74HC125' },
  propertySchema: [{ key: 'model', label: 'Model', type: 'string', default: '74HC125' }],
  simulationModel: { type: 'digital', spiceTemplate: '', defaultParams: {} },
  width: 60, height: 36,
};

export const LOGIC_INPUT: SymbolDef = {
  id: 'logic_input', name: 'Logic Input', category: 'Digital', subcategory: 'I/O',
  description: 'Digital logic input (toggle)', referencePrefix: '',
  pins: [
    pin('out', 'OUT', '1', 'output', 30, 0, 'right'),
  ],
  bodyPaths: ['M -12 -12 L 12 -12 L 20 0 L 12 12 L -12 12 Z'],
  bodyRects: [], bodyCircles: [], bodyLines: [
    { x1: 20, y1: 0, x2: 30, y2: 0 },
  ],
  labels: [
    { text: '0', x: 0, y: 4, fontSize: 12, anchor: 'middle' },
  ],
  defaultValues: { value: '0' },
  propertySchema: [{ key: 'value', label: 'Value', type: 'select', default: '0', options: ['0', '1'] }],
  simulationModel: { type: 'source', spiceTemplate: '', defaultParams: {} },
  width: 44, height: 24,
};

export const LOGIC_CLOCK: SymbolDef = {
  id: 'logic_clock', name: 'Logic Clock', category: 'Digital', subcategory: 'I/O',
  description: 'Digital clock generator', referencePrefix: '',
  pins: [
    pin('out', 'OUT', '1', 'output', 30, 0, 'right'),
  ],
  bodyPaths: ['M -12 -12 L 12 -12 L 20 0 L 12 12 L -12 12 Z'],
  bodyRects: [], bodyCircles: [], bodyLines: [
    { x1: 20, y1: 0, x2: 30, y2: 0 },
  ],
  labels: [
    { text: 'CLK', x: 0, y: 4, fontSize: 9, anchor: 'middle' },
  ],
  defaultValues: { frequency: '1k' },
  propertySchema: [{ key: 'frequency', label: 'Frequency', type: 'string', default: '1k', unit: 'Hz' }],
  simulationModel: { type: 'source', spiceTemplate: '', defaultParams: { frequency: 1000 } },
  width: 44, height: 24,
};

export const LOGIC_PROBE: SymbolDef = {
  id: 'logic_probe', name: 'Logic Probe', category: 'Digital', subcategory: 'I/O',
  description: 'Digital logic state indicator', referencePrefix: '',
  pins: [
    pin('in', 'IN', '1', 'input', -30, 0, 'left'),
  ],
  bodyPaths: ['M -12 -12 L 12 -12 L 20 0 L 12 12 L -12 12 Z'],
  bodyRects: [], bodyCircles: [], bodyLines: [
    { x1: -30, y1: 0, x2: -12, y2: 0 },
  ],
  labels: [
    { text: 'LP', x: 0, y: 4, fontSize: 9, anchor: 'middle' },
  ],
  defaultValues: {},
  propertySchema: [],
  simulationModel: { type: 'passive', spiceTemplate: '', defaultParams: {} },
  width: 44, height: 24,
};

export const LED_INDICATOR: SymbolDef = {
  id: 'led_indicator', name: 'LED Indicator', category: 'Digital', subcategory: 'I/O',
  description: 'Digital LED indicator', referencePrefix: '',
  pins: [
    pin('in', 'IN', '1', 'input', -30, 0, 'left'),
  ],
  bodyPaths: [],
  bodyRects: [],
  bodyCircles: [{ cx: 0, cy: 0, r: 12 }],
  bodyLines: [
    { x1: -30, y1: 0, x2: -12, y2: 0 },
  ],
  labels: [
    { text: '@REF', x: 0, y: -18, fontSize: 10, anchor: 'middle' },
  ],
  defaultValues: { color: 'Red' },
  propertySchema: [{ key: 'color', label: 'Color', type: 'select', default: 'Red', options: ['Red', 'Green', 'Blue', 'Yellow'] }],
  simulationModel: { type: 'passive', spiceTemplate: '', defaultParams: {} },
  width: 24, height: 24,
};

// ─── COMPONENT REGISTRY ────────────────────────────────────────────────

export const ALL_COMPONENTS: SymbolDef[] = [
  RESISTOR, CAPACITOR, INDUCTOR, POTENTIOMETER,
  VOLTAGE_SOURCE, CURRENT_SOURCE, SINE_SOURCE, PULSE_SOURCE,
  DIODE, ZENER, LED,
  BJT_NPN, BJT_PNP, NMOS, PMOS,
  IDEAL_OPAMP, COMPARATOR, SWITCH, TRANSFORMER,
  GROUND, VCC, VDD,
  NOT_GATE, AND_GATE, OR_GATE, NAND_GATE, NOR_GATE, XOR_GATE, BUFFER_GATE,
  LOGIC_INPUT, LOGIC_CLOCK, LOGIC_PROBE, LED_INDICATOR,
];

export const COMPONENT_MAP = new Map<string, SymbolDef>(
  ALL_COMPONENTS.map(c => [c.id, c])
);

export const COMPONENT_CATEGORIES = [
  { name: 'Basic', subcategories: ['Passive', 'Switch', 'Coupling'] },
  { name: 'Sources', subcategories: ['DC', 'AC', 'Transient'] },
  { name: 'Diodes', subcategories: ['Standard', 'Indicator'] },
  { name: 'Transistors', subcategories: ['BJT', 'MOSFET'] },
  { name: 'Analog', subcategories: ['Op Amp'] },
  { name: 'Digital', subcategories: ['Logic', 'I/O'] },
  { name: 'Power', subcategories: ['Ground', 'Supply'] },
];

export function getComponentsByCategory(category: string): SymbolDef[] {
  return ALL_COMPONENTS.filter(c => c.category === category);
}

export function getComponentsBySubcategory(category: string, subcategory: string): SymbolDef[] {
  return ALL_COMPONENTS.filter(c => c.category === category && c.subcategory === subcategory);
}

export function searchComponents(query: string): SymbolDef[] {
  const q = query.toLowerCase();
  return ALL_COMPONENTS.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.description.toLowerCase().includes(q) ||
    c.category.toLowerCase().includes(q) ||
    c.referencePrefix.toLowerCase().includes(q)
  );
}