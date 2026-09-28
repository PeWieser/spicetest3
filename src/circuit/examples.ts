// CircuitBench Example Circuits
import type { Project } from './types';
import { generateId } from './utils';

export function createRCFilterExample(): Project {
  const sheetId = generateId('sheet');
  const compV1Id = generateId('comp');
  const compR1Id = generateId('comp');
  const compC1Id = generateId('comp');
  const gndId = generateId('pwr');
  const gnd2Id = generateId('pwr');
  const probeId = generateId('probe');
  const wire1Id = generateId('wire');
  const wire2Id = generateId('wire');
  const wire3Id = generateId('wire');

  return {
    schemaVersion: 1,
    id: generateId('proj'),
    name: 'RC Low-Pass Filter',
    description: 'Classic RC low-pass filter with transient analysis. Cut-off frequency: 1/(2π·R·C) ≈ 159 Hz for R=1kΩ, C=1µF.',
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    sheets: [{
      id: sheetId,
      name: 'Main Circuit',
      components: [
        {
          id: compV1Id,
          symbolId: 'sine_source',
          reference: 'V1',
          value: '5',
          position: { x: 200, y: 200 },
          transform: { orientation: 0, mirror: 'none' },
          properties: { offset: '0', amplitude: '5', frequency: '100', delay: '0', damping: '0', phase: '0' },
          visible: { reference: true, value: true, pinNames: false },
        },
        {
          id: compR1Id,
          symbolId: 'resistor',
          reference: 'R1',
          value: '1k',
          position: { x: 320, y: 160 },
          transform: { orientation: 0, mirror: 'none' },
          properties: { resistance: '1k' },
          visible: { reference: true, value: true, pinNames: false },
        },
        {
          id: compC1Id,
          symbolId: 'capacitor',
          reference: 'C1',
          value: '1u',
          position: { x: 440, y: 200 },
          transform: { orientation: 90, mirror: 'none' },
          properties: { capacitance: '1u' },
          visible: { reference: true, value: true, pinNames: false },
        },
      ],
      wires: [
        { id: wire1Id, points: [{ x: 200, y: 170 }, { x: 200, y: 160 }, { x: 280, y: 160 }] },
        { id: wire2Id, points: [{ x: 360, y: 160 }, { x: 440, y: 160 }, { x: 440, y: 170 }] },
        { id: wire3Id, points: [{ x: 200, y: 230 }, { x: 200, y: 260 }, { x: 440, y: 260 }, { x: 440, y: 230 }] },
      ],
      junctions: [],
      labels: [
        { id: generateId('label'), name: 'Vin', position: { x: 170, y: 160 }, orientation: 0, isGlobal: false },
        { id: generateId('label'), name: 'Vout', position: { x: 440, y: 140 }, orientation: 0, isGlobal: false },
      ],
      powerSymbols: [
        { id: gndId, type: 'gnd', position: { x: 200, y: 270 } },
        { id: gnd2Id, type: 'gnd', position: { x: 440, y: 270 } },
      ],
      buses: [],
      busEntries: [],
      instruments: [],
      probes: [
        {
          id: probeId,
          type: 'voltage',
          name: 'Vout',
          color: '#2563eb',
          position: { x: 440, y: 180 },
          visible: true,
          plotVisible: true,
        },
      ],
      width: 4000,
      height: 3000,
    }],
    nets: [],
    designVariables: [],
    simulationSettings: {
      analysisType: 'transient',
      transient: {
        startTime: 0,
        stopTime: 50e-3,
        maxTimeStep: 1e-5,
        initialTimeStep: 1e-7,
        useOperatingPoint: true,
        useIC: false,
      },
      ac: { startFreq: 1, stopFreq: 1e6, sweepType: 'decade', pointsPerDecade: 20, inputSource: 'V1' },
      dcSweep: { source: 'V1', startValue: 0, stopValue: 10, stepValue: 0.1 },
      paramSweep: { target: 'R1.resistance', sweepType: 'logarithmic', startValue: 100, stopValue: 100000, points: 5 },
    },
    savedResults: [],
    uiState: {
      leftPanelVisible: true,
      rightPanelVisible: true,
      bottomPanelVisible: true,
      darkMode: false,
      gridVisible: true,
      snapEnabled: true,
      rulersVisible: false,
      zoom: 1.5,
      panX: -100,
      panY: -80,
    },
  };
}

export function createVoltageDividerExample(): Project {
  const sheetId = generateId('sheet');

  return {
    schemaVersion: 1,
    id: generateId('proj'),
    name: 'Voltage Divider',
    description: 'Simple voltage divider with DC analysis. Vout = V1 * R2/(R1+R2)',
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    sheets: [{
      id: sheetId,
      name: 'Main Circuit',
      components: [
        {
          id: generateId('comp'), symbolId: 'voltage_source', reference: 'V1', value: '10',
          position: { x: 200, y: 200 },
          transform: { orientation: 0, mirror: 'none' },
          properties: { dc: '10', ac_mag: '1', ac_phase: '0' },
          visible: { reference: true, value: true, pinNames: false },
        },
        {
          id: generateId('comp'), symbolId: 'resistor', reference: 'R1', value: '10k',
          position: { x: 320, y: 160 },
          transform: { orientation: 0, mirror: 'none' },
          properties: { resistance: '10k' },
          visible: { reference: true, value: true, pinNames: false },
        },
        {
          id: generateId('comp'), symbolId: 'resistor', reference: 'R2', value: '10k',
          position: { x: 440, y: 200 },
          transform: { orientation: 90, mirror: 'none' },
          properties: { resistance: '10k' },
          visible: { reference: true, value: true, pinNames: false },
        },
      ],
      wires: [
        { id: generateId('wire'), points: [{ x: 200, y: 170 }, { x: 200, y: 160 }, { x: 280, y: 160 }] },
        { id: generateId('wire'), points: [{ x: 360, y: 160 }, { x: 440, y: 160 }] },
        { id: generateId('wire'), points: [{ x: 200, y: 230 }, { x: 200, y: 260 }, { x: 440, y: 260 }, { x: 440, y: 240 }] },
      ],
      junctions: [],
      labels: [],
      powerSymbols: [
        { id: generateId('pwr'), type: 'gnd', position: { x: 200, y: 270 } },
        { id: generateId('pwr'), type: 'gnd', position: { x: 440, y: 270 } },
      ],
      buses: [], busEntries: [], instruments: [],
      probes: [
        { id: generateId('probe'), type: 'voltage', name: 'Vmid', color: '#2563eb', position: { x: 360, y: 160 }, visible: true, plotVisible: true },
      ],
      width: 4000, height: 3000,
    }],
    nets: [],
    designVariables: [],
    simulationSettings: {
      analysisType: 'dcSweep',
      dcSweep: { source: 'V1', startValue: 0, stopValue: 20, stepValue: 0.5 },
      transient: { startTime: 0, stopTime: 10e-3, maxTimeStep: 1e-5, initialTimeStep: 1e-7, useOperatingPoint: true, useIC: false },
      ac: { startFreq: 1, stopFreq: 1e6, sweepType: 'decade', pointsPerDecade: 20, inputSource: 'V1' },
      paramSweep: { target: '', sweepType: 'linear', startValue: 0, stopValue: 0, points: 10 },
    },
    savedResults: [],
    uiState: { leftPanelVisible: true, rightPanelVisible: true, bottomPanelVisible: true, darkMode: false, gridVisible: true, snapEnabled: true, rulersVisible: false, zoom: 1.5, panX: -100, panY: -80 },
  };
}

export function createDiodeSweepExample(): Project {
  const sheetId = generateId('sheet');

  return {
    schemaVersion: 1,
    id: generateId('proj'),
    name: 'Diode DC Sweep',
    description: 'Diode I-V characteristic measurement via DC sweep.',
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    sheets: [{
      id: sheetId,
      name: 'Main Circuit',
      components: [
        {
          id: generateId('comp'), symbolId: 'voltage_source', reference: 'V1', value: '5',
          position: { x: 200, y: 200 },
          transform: { orientation: 0, mirror: 'none' },
          properties: { dc: '5', ac_mag: '0', ac_phase: '0' },
          visible: { reference: true, value: true, pinNames: false },
        },
        {
          id: generateId('comp'), symbolId: 'resistor', reference: 'R1', value: '100',
          position: { x: 320, y: 160 },
          transform: { orientation: 0, mirror: 'none' },
          properties: { resistance: '100' },
          visible: { reference: true, value: true, pinNames: false },
        },
        {
          id: generateId('comp'), symbolId: 'diode', reference: 'D1', value: '1N4148',
          position: { x: 440, y: 200 },
          transform: { orientation: 90, mirror: 'none' },
          properties: { model: 'Ddefault', is: '1e-14', n: '1' },
          visible: { reference: true, value: true, pinNames: false },
        },
      ],
      wires: [
        { id: generateId('wire'), points: [{ x: 200, y: 170 }, { x: 200, y: 160 }, { x: 280, y: 160 }] },
        { id: generateId('wire'), points: [{ x: 360, y: 160 }, { x: 440, y: 160 }] },
        { id: generateId('wire'), points: [{ x: 200, y: 230 }, { x: 200, y: 260 }, { x: 440, y: 260 }, { x: 440, y: 240 }] },
      ],
      junctions: [],
      labels: [],
      powerSymbols: [
        { id: generateId('pwr'), type: 'gnd', position: { x: 200, y: 270 } },
        { id: generateId('pwr'), type: 'gnd', position: { x: 440, y: 270 } },
      ],
      buses: [], busEntries: [], instruments: [],
      probes: [],
      width: 4000, height: 3000,
    }],
    nets: [],
    designVariables: [],
    simulationSettings: {
      analysisType: 'dcSweep',
      dcSweep: { source: 'V1', startValue: 0, stopValue: 2, stepValue: 0.02 },
      transient: { startTime: 0, stopTime: 10e-3, maxTimeStep: 1e-5, initialTimeStep: 1e-7, useOperatingPoint: true, useIC: false },
      ac: { startFreq: 1, stopFreq: 1e6, sweepType: 'decade', pointsPerDecade: 20, inputSource: 'V1' },
      paramSweep: { target: '', sweepType: 'linear', startValue: 0, stopValue: 0, points: 10 },
    },
    savedResults: [],
    uiState: { leftPanelVisible: true, rightPanelVisible: true, bottomPanelVisible: true, darkMode: false, gridVisible: true, snapEnabled: true, rulersVisible: false, zoom: 1.5, panX: -100, panY: -80 },
  };
}

export const EXAMPLE_PROJECTS = [
  { name: 'RC Low-Pass Filter', description: 'Transient analysis of RC filter (100 Hz sine → 1kΩ → 1µF → GND)', create: createRCFilterExample },
  { name: 'Voltage Divider', description: 'DC sweep of voltage divider with two 10kΩ resistors', create: createVoltageDividerExample },
  { name: 'Diode DC Sweep', description: 'I-V characteristic curve of a diode via DC sweep', create: createDiodeSweepExample },
];