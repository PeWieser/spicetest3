// CircuitBench - SPICE netlist generation (File > Export SPICE Netlist)
//
// Produces a standard SPICE deck from the resolved schematic connectivity.
// Ground nets map to node "0", power symbols become real voltage sources,
// unconnected pins become named NC nodes so the deck is still valid SPICE.

import type { Project, ProjectSheet, SimulationSettings, ComponentInstance, Net } from './types';
import { COMPONENT_MAP } from './library';
import { parseValue, formatValue, generateId } from './utils';
import { resolveConnectivity } from '@/store/project-store';

export interface NetlistResult {
  netlist: string;
  warnings: string[];
  nodeCount: number;
  deviceCount: number;
}

// device line prefixes per symbol
const DEVICE_PREFIX: Record<string, string> = {
  resistor: 'R',
  capacitor: 'C',
  inductor: 'L',
  potentiometer: 'R',
  voltage_source: 'V',
  sine_source: 'V',
  pulse_source: 'V',
  current_source: 'I',
  diode: 'D',
  zener: 'D',
  led: 'D',
};

const SUPPORTED = new Set(Object.keys(DEVICE_PREFIX));

export function generateSpiceNetlist(
  project: Project,
  sheet: ProjectSheet,
  settings: SimulationSettings,
): NetlistResult {
  const warnings: string[] = [];
  const nets = resolveConnectivity(sheet);

  // ── 1. node names ───────────────────────────────────────────────────
  const netToNode = new Map<string, string>();
  const usedNames = new Set<string>(['0']);
  const uniqueNode = (base: string): string => {
    let name = base || 'N';
    let i = 1;
    while (usedNames.has(name)) name = `${base}_${i++}`;
    usedNames.add(name);
    return name;
  };

  for (const net of nets) {
    if (net.type === 'ground') {
      netToNode.set(net.id, '0');
      continue;
    }
    const base = (net.name || '').replace(/[^\w.]+/g, '_') || `N${netToNode.size + 1}`;
    netToNode.set(net.id, uniqueNode(base));
  }

  // rail name -> voltage, taken from the VCC/VDD component that sits on that net
  const railNameBySymbol: Record<string, string> = { vcc: 'VCC', vdd: 'VDD', vee: 'VEE', vss: 'VSS' };
  const railVoltage = new Map<string, number>();
  for (const comp of sheet.components) {
    const sym = COMPONENT_MAP.get(comp.symbolId);
    if (!sym || !railNameBySymbol[sym.id]) continue;
    const railName = railNameBySymbol[sym.id];
    const parsed = parseValue(comp.properties.voltage ?? sym.defaultValues.voltage ?? '');
    railVoltage.set(railName, Number.isFinite(parsed) && comp.properties.voltage ? parsed : (railVoltage.get(railName) ?? (sym.id === 'vdd' ? 3.3 : 5)));
  }
  // fall back to plain power symbols without a matching component
  for (const ps of sheet.powerSymbols) {
    if (ps.type === 'gnd') continue;
    const railName = ps.type.toUpperCase();
    if (!railVoltage.has(railName)) railVoltage.set(railName, ps.type === 'vdd' ? 3.3 : 5);
  }

  const nodeForPin = (comp: ComponentInstance, pinId: string): string => {
    for (const net of nets) {
      if (net.pinRefs.some(r => r.componentId === comp.id && r.pinId === pinId)) {
        return netToNode.get(net.id) || '0';
      }
    }
    const nc = uniqueNode(`NC_${comp.reference}_${pinId}`.replace(/[^\w.]/g, '_'));
    warnings.push(`${comp.reference}: pin "${pinId}" is not connected - using node ${nc}`);
    return nc;
  };

  // ── 2. device cards ─────────────────────────────────────────────────
  const devices: string[] = [];
  const modelCards: string[] = [];
  let deviceCount = 0;

  for (const comp of sheet.components) {
    const sym = COMPONENT_MAP.get(comp.symbolId);
    if (!sym) continue;
    const symId = sym.id;

    // Ground / supply / probe-only symbols are not devices
    if (symId === 'ground') continue;

    if (!SUPPORTED.has(symId)) {
      warnings.push(`${comp.reference}: symbol "${sym.name}" has no SPICE card mapping - skipped`);
      continue;
    }

    const value = (key: string, fallback: number): number => {
      const raw = comp.properties[key] ?? sym.defaultValues[key];
      const n = parseValue(raw ?? '');
      return Number.isFinite(n) && raw !== undefined && raw !== '' ? n : fallback;
    };

    const pinOf = (name: string) => sym.pins.find(p => p.id === name);

    switch (symId) {
      case 'resistor': {
        const r = value('resistance', 1000);
        devices.push(`R${comp.reference} ${nodeForPin(comp, 'p1')} ${nodeForPin(comp, 'p2')} ${formatValue(r)}`);
        break;
      }
      case 'potentiometer': {
        const total = value('resistance', 10000);
        const pos = Math.min(100, Math.max(0, value('position', 50))) / 100;
        devices.push(`* potentiometer ${comp.reference} (total ${formatValue(total)}, wiper at ${(pos * 100).toFixed(0)}%)`);
        devices.push(`R${comp.reference}a ${nodeForPin(comp, 'p1')} ${nodeForPin(comp, 'w')} ${formatValue(total * pos)}`);
        devices.push(`R${comp.reference}b ${nodeForPin(comp, 'w')} ${nodeForPin(comp, 'p2')} ${formatValue(total * (1 - pos))}`);
        break;
      }
      case 'capacitor': {
        devices.push(`C${comp.reference} ${nodeForPin(comp, 'p1')} ${nodeForPin(comp, 'p2')} ${formatValue(value('capacitance', 1e-7))}`);
        break;
      }
      case 'inductor': {
        devices.push(`L${comp.reference} ${nodeForPin(comp, 'p1')} ${nodeForPin(comp, 'p2')} ${formatValue(value('inductance', 0.01))}`);
        break;
      }
      case 'voltage_source': {
        devices.push(`V${comp.reference} ${nodeForPin(comp, 'pos')} ${nodeForPin(comp, 'neg')} DC ${formatValue(value('dc', 5))} AC ${formatValue(value('ac_mag', 0))}`);
        break;
      }
      case 'sine_source': {
        devices.push(`V${comp.reference} ${nodeForPin(comp, 'pos')} ${nodeForPin(comp, 'neg')} SIN(${formatValue(value('offset', 0))} ${formatValue(value('amplitude', 5))} ${formatValue(value('frequency', 1000))} ${formatValue(value('delay', 0))})`);
        break;
      }
      case 'pulse_source': {
        devices.push(`V${comp.reference} ${nodeForPin(comp, 'pos')} ${nodeForPin(comp, 'neg')} PULSE(${formatValue(value('v1', 0))} ${formatValue(value('v2', 5))} ${formatValue(value('delay', 0))} ${formatValue(value('rise', 1e-9))} ${formatValue(value('fall', 1e-9))} ${formatValue(value('width', 5e-4))} ${formatValue(value('period', 1e-3))})`);
        break;
      }
      case 'current_source': {
        devices.push(`I${comp.reference} ${nodeForPin(comp, 'pos')} ${nodeForPin(comp, 'neg')} DC ${formatValue(value('dc', 0.001))}`);
        break;
      }
      case 'diode':
      case 'zener':
      case 'led': {
        const modelName = comp.properties.model || `DMOD_${comp.reference}`;
        const is = value('is', symId === 'led' ? 1e-20 : 1e-14);
        const n = value('n', symId === 'led' ? 2 : 1);
        const bv = value('bv', value('vz', 100));
        modelCards.push(`.model ${modelName} D(IS=${is.toExponential(3)} N=${n} BV=${bv} IBV=1m)`);
        devices.push(`D${comp.reference} ${nodeForPin(comp, 'anode')} ${nodeForPin(comp, 'cathode')} ${modelName}`);
        break;
      }
      default:
        warnings.push(`${comp.reference}: unsupported device class - skipped`);
    }
    deviceCount++;
  }

  // Power rails from VCC/VDD symbols become real sources to node 0
  const railSources: string[] = [];
  for (const ps of sheet.powerSymbols) {
    if (ps.type === 'gnd' || !ps.netId) continue;
    const node = netToNode.get(ps.netId);
    if (!node || node === '0') continue;
    const railName = ps.type.toUpperCase();
    const volts = railVoltage.get(railName) ?? 5;
    railSources.push(`V_${railName} ${node} 0 DC ${formatValue(volts)}`);
  }

  // ── 3. analysis directive ───────────────────────────────────────────
  const directives: string[] = ['.op'];
  switch (settings.analysisType) {
    case 'transient':
      if (settings.transient) {
        directives.length = 0;
        directives.push(`.tran ${formatValue(settings.transient.maxTimeStep)} ${formatValue(settings.transient.stopTime)} ${formatValue(settings.transient.startTime)}${settings.transient.useIC ? ' UIC' : ''}`);
      }
      break;
    case 'ac':
      if (settings.ac) {
        directives.length = 0;
        const type = settings.ac.sweepType === 'linear' ? 'lin' : settings.ac.sweepType === 'octave' ? 'oct' : 'dec';
        directives.push(`.ac ${type} ${settings.ac.pointsPerDecade} ${formatValue(settings.ac.startFreq)} ${formatValue(settings.ac.stopFreq)}`);
      }
      break;
    case 'dcSweep':
      if (settings.dcSweep) {
        directives.length = 0;
        directives.push(`.dc ${settings.dcSweep.source} ${formatValue(settings.dcSweep.startValue)} ${formatValue(settings.dcSweep.stopValue)} ${formatValue(settings.dcSweep.stepValue)}`);
      }
      break;
    default:
      break;
  }

  // ── 4. assemble deck ────────────────────────────────────────────────
  const lines: string[] = [
    `* ${project.name} - sheet "${sheet.name}"`,
    `* Generated by CircuitBench | ${new Date().toISOString()}`,
    `* ${deviceCount} devices, ${usedNames.size - 1} nodes`,
    '',
    ...modelCards,
    ...(modelCards.length ? [''] : []),
    ...devices,
    ...(railSources.length ? ['', '* power rails'] : []),
    ...railSources,
    '',
    '* analysis',
    ...directives,
    '',
    '.op',
    '.end',
  ];

  return {
    netlist: lines.join('\n'),
    warnings,
    nodeCount: Math.max(usedNames.size - 1, 0),
    deviceCount,
  };
}

export function netlistFileName(project: Project): string {
  return `${(project.name || 'circuit').replace(/[^\w.-]+/g, '_')}.cir`;
}
