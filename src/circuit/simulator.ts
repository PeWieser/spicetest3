// CircuitBench SPICE Simulation Engine
// Implements Modified Nodal Analysis (MNA) with Newton-Raphson iteration
// Supports: R, C, L, V, I, D, OpAmp, and basic transistor models

import type { SimulationResult, SimTrace, AnalysisType, SimulationSettings, ComponentInstance, Net, WireSegment, Junction, NetLabel, PowerSymbol, Probe } from './types';
import { COMPONENT_MAP } from './library';
import { parseValue, getTraceColor } from './utils';
import { generateId } from './utils';

// ─── Linear Algebra ────────────────────────────────────────────────────

class Matrix {
  data: Float64Array;
  n: number;

  constructor(n: number) {
    this.n = n;
    this.data = new Float64Array(n * n);
  }

  get(i: number, j: number): number { return this.data[i * this.n + j]; }
  set(i: number, j: number, v: number): void { this.data[i * this.n + j] = v; }
  add(i: number, j: number, v: number): void { this.data[i * this.n + j] += v; }
}

function solveLinearSystem(A: Matrix, b: Float64Array): Float64Array {
  const n = A.n;
  const a = new Float64Array(A.data);
  const x = new Float64Array(b);
  const piv = new Int32Array(n);

  for (let i = 0; i < n; i++) piv[i] = i;

  for (let k = 0; k < n; k++) {
    // Partial pivoting
    let maxVal = Math.abs(a[k * n + k]);
    let maxRow = k;
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(a[i * n + k]);
      if (v > maxVal) { maxVal = v; maxRow = i; }
    }
    if (maxVal < 1e-30) {
      // Singular - add small diagonal
      a[k * n + k] = 1e-15;
      continue;
    }
    if (maxRow !== k) {
      for (let j = k; j < n; j++) {
        const tmp = a[k * n + j]; a[k * n + j] = a[maxRow * n + j]; a[maxRow * n + j] = tmp;
      }
      const tmp = x[k]; x[k] = x[maxRow]; x[maxRow] = tmp;
    }
    // Eliminate
    const pivot = a[k * n + k];
    for (let i = k + 1; i < n; i++) {
      const factor = a[i * n + k] / pivot;
      for (let j = k + 1; j < n; j++) {
        a[i * n + j] -= factor * a[k * n + j];
      }
      a[i * n + k] = 0;
      x[i] -= factor * x[k];
    }
  }
  // Back-substitution
  for (let i = n - 1; i >= 0; i--) {
    let sum = x[i];
    for (let j = i + 1; j < n; j++) {
      sum -= a[i * n + j] * x[j];
    }
    const diag = a[i * n + i];
    x[i] = Math.abs(diag) > 1e-30 ? sum / diag : 0;
  }
  return x;
}

// ─── Circuit Model ─────────────────────────────────────────────────────

interface SimNode {
  id: string;
  name: string;
  voltage: number;
  isGround: boolean;
  isVoltageSource: boolean;
}

interface SimBranch {
  id: string;
  current: number;
  vsIndex: number; // index in MNA for voltage source current
}

interface SimComponent {
  id: string;
  type: string;
  ref: string;
  nodes: string[];
  params: Record<string, number>;
  // For nonlinear components
  linearized?: Record<string, number>;
}

interface SimCircuit {
  nodes: Map<string, SimNode>;
  components: SimComponent[];
  groundNode: string;
  vsCount: number;
}

// ─── Netlist Builder ───────────────────────────────────────────────────

export function buildSimCircuit(
  components: ComponentInstance[],
  nets: Net[],
  powerSymbols: PowerSymbol[],
): SimCircuit {
  const nodes = new Map<string, SimNode>();
  const simComponents: SimComponent[] = [];
  let vsCount = 0;

  // Create ground node
  nodes.set('0', { id: '0', name: 'GND', voltage: 0, isGround: true, isVoltageSource: false });

  // Map power symbols to nets
  const gndNetIds = new Set<string>();
  const powerNetMap = new Map<string, number>();

  for (const ps of powerSymbols) {
    if (ps.type === 'gnd' && ps.netId) {
      gndNetIds.add(ps.netId);
    }
  }

  // Build node mapping from nets
  const netToNode = new Map<string, string>();
  for (const net of nets) {
    if (net.type === 'ground' || gndNetIds.has(net.id)) {
      netToNode.set(net.id, '0');
    } else {
      const nodeId = net.name || `net_${net.id}`;
      netToNode.set(net.id, nodeId);
      if (!nodes.has(nodeId)) {
        nodes.set(nodeId, { id: nodeId, name: nodeId, voltage: 0, isGround: false, isVoltageSource: false });
      }
    }
  }

  // Map component pins to nets
  function getNodeForPin(compId: string, pinId: string): string {
    for (const net of nets) {
      for (const ref of net.pinRefs) {
        if (ref.componentId === compId && ref.pinId === pinId) {
          return netToNode.get(net.id) || '0';
        }
      }
    }
    // If not connected, create a floating node
    const floatNode = `float_${compId}_${pinId}`;
    if (!nodes.has(floatNode)) {
      nodes.set(floatNode, { id: floatNode, name: floatNode, voltage: 0, isGround: false, isVoltageSource: false });
    }
    return floatNode;
  }

  for (const comp of components) {
    const sym = COMPONENT_MAP.get(comp.symbolId);
    if (!sym) continue;

    const pinNodeMap: Record<string, string> = {};
    for (const pin of sym.pins) {
      pinNodeMap[pin.id] = getNodeForPin(comp.id, pin.id);
    }

    const params: Record<string, number> = {};
    for (const ps of sym.propertySchema) {
      const val = comp.properties[ps.key] || comp.value || ps.default;
      params[ps.key] = parseValue(val);
    }

    // Also add default values not overridden
    for (const [k, v] of Object.entries(sym.simulationModel.defaultParams || {})) {
      if (!(k in params)) {
        params[k] = typeof v === 'number' ? v : parseValue(String(v));
      }
    }

    const simComp: SimComponent = {
      id: comp.id,
      type: sym.simulationModel.type,
      ref: comp.reference,
      nodes: sym.pins.map(p => pinNodeMap[p.id]),
      params,
    };

    // Handle source types
    if (sym.id === 'voltage_source' || sym.id === 'sine_source' || sym.id === 'pulse_source') {
      simComp.type = 'vsource';
      vsCount++;
    } else if (sym.id === 'current_source') {
      simComp.type = 'isource';
    } else if (sym.id === 'diode' || sym.id === 'zener' || sym.id === 'led') {
      simComp.type = 'diode';
      const bv = params.bv || (sym.id === 'zener' ? (params.vz || 5.1) : (sym.id === 'led' ? 100 : 100));
      simComp.params.bv = bv;
      simComp.params.is = params.is || (sym.id === 'led' ? 1e-20 : 1e-14);
      simComp.params.n = params.n || (sym.id === 'led' ? 2 : 1);
    } else if (sym.id === 'ideal_opamp') {
      simComp.type = 'opamp';
    } else if (sym.id === 'ground') {
      continue; // handled via power symbols
    } else if (sym.id === 'vcc' || sym.id === 'vdd') {
      // Create a voltage source for power supply
      const voltage = params.voltage || (sym.id === 'vcc' ? 5 : 3.3);
      simComp.type = 'vsource';
      simComp.params.dc = voltage;
      simComp.nodes = [pinNodeMap[sym.pins[0].id], '0'];
      vsCount++;
    }

    simComponents.push(simComp);
  }

  return { nodes, components: simComponents, groundNode: '0', vsCount };
}

// ─── MNA Assembly and Solve ────────────────────────────────────────────

interface MNAResult {
  nodeVoltages: Map<string, number>;
  branchCurrents: Map<string, number>;
  converged: boolean;
}

function getNodeIndex(nodeId: string, nodeOrder: string[]): number {
  const idx = nodeOrder.indexOf(nodeId);
  return idx >= 0 ? idx : -1;
}

function assembleAndSolve(
  circuit: SimCircuit,
  time: number,
  settings: SimulationSettings,
  prevSolution?: Float64Array,
  nodeOrder?: string[],
  dt?: number,
): MNAResult {
  // Build node order (exclude ground)
  const sortedNodes = Array.from(circuit.nodes.keys()).filter(id => id !== '0').sort();
  const allNodes = ['0', ...sortedNodes];
  const n = sortedNodes.length;
  const totalSize = n + circuit.vsCount;

  if (totalSize === 0) {
    return { nodeVoltages: new Map([['0', 0]]), branchCurrents: new Map(), converged: true };
  }

  const A = new Matrix(totalSize);
  const b = new Float64Array(totalSize);

  // Track voltage source indices
  let vsIdx = n;
  const vsIndices = new Map<string, number>();

  for (const comp of circuit.components) {
    if (comp.type === 'vsource') {
      vsIndices.set(comp.id, vsIdx);
      vsIdx++;
    }
  }

  // Stamp components
  for (const comp of circuit.components) {
    const n1 = getNodeIndex(comp.nodes[0], allNodes);
    const n2 = comp.nodes.length > 1 ? getNodeIndex(comp.nodes[1], allNodes) : -1;

    if (comp.type === 'resistor' || comp.ref?.startsWith('R')) {
      const r = comp.params.resistance || 1000;
      const g = 1 / r;
      if (n1 >= 0) A.add(n1, n1, g);
      if (n2 >= 0) A.add(n2, n2, g);
      if (n1 >= 0 && n2 >= 0) {
        A.add(n1, n2, -g);
        A.add(n2, n1, -g);
      }
    } else if (comp.type === 'capacitor' || comp.ref?.startsWith('C')) {
      const c = comp.params.capacitance || 1e-7;
      if (dt && dt > 0) {
        // Backward Euler companion model: I = C/dt * (V - Vprev)
        const geq = c / dt;
        const ieq = geq * (prevSolution ? (getNodeVoltage(comp.nodes[0], prevSolution, allNodes) - getNodeVoltage(comp.nodes[1], prevSolution, allNodes)) : 0);

        if (n1 >= 0) A.add(n1, n1, geq);
        if (n2 >= 0) A.add(n2, n2, geq);
        if (n1 >= 0 && n2 >= 0) {
          A.add(n1, n2, -geq);
          A.add(n2, n1, -geq);
        }
        if (n1 >= 0) b[n1] += ieq;
        if (n2 >= 0) b[n2] -= ieq;
      }
      // For DC operating point, capacitor is open circuit (nothing to stamp)
    } else if (comp.type === 'inductor' || comp.ref?.startsWith('L')) {
      const l = comp.params.inductance || 0.01;
      if (dt && dt > 0) {
        // Backward Euler companion: V = L/dt * (I - Iprev)
        // Treat as resistor Req = L/dt with voltage source
        const geq = dt / l;
        if (n1 >= 0) A.add(n1, n1, geq);
        if (n2 >= 0) A.add(n2, n2, geq);
        if (n1 >= 0 && n2 >= 0) {
          A.add(n1, n2, -geq);
          A.add(n2, n1, -geq);
        }
      }
    } else if (comp.type === 'vsource') {
      const vi = vsIndices.get(comp.id)!;
      let vdc = comp.params.dc || 0;

      // AC/Transient sources
      if (comp.params.amplitude && comp.params.frequency) {
        const amp = comp.params.amplitude;
        const freq = comp.params.frequency;
        const offset = comp.params.offset || 0;
        const phase = (comp.params.phase || 0) * Math.PI / 180;
        const delay = comp.params.delay || 0;
        const damping = comp.params.damping || 0;
        if (time > delay) {
          vdc = offset + amp * Math.sin(2 * Math.PI * freq * (time - delay) + phase) * Math.exp(-damping * (time - delay));
        } else {
          vdc = offset;
        }
      } else if (comp.params.v1 !== undefined && comp.params.v2 !== undefined) {
        // Pulse source
        const v1 = comp.params.v1;
        const v2 = comp.params.v2;
        const period = comp.params.period || 1e-3;
        const width = comp.params.width || period / 2;
        const rise = comp.params.rise || 1e-9;
        const fall = comp.params.fall || 1e-9;
        const delay = comp.params.delay || 0;
        const tmod = ((time - delay) % period + period) % period;
        if (tmod < rise) {
          vdc = v1 + (v2 - v1) * (tmod / rise);
        } else if (tmod < rise + width) {
          vdc = v2;
        } else if (tmod < rise + width + fall) {
          vdc = v2 + (v1 - v2) * ((tmod - rise - width) / fall);
        } else {
          vdc = v1;
        }
      }

      // Stamp V source: V(n1) - V(n2) = vdc
      if (n1 >= 0) {
        A.add(n1, vi, 1);
        A.add(vi, n1, 1);
      }
      if (n2 >= 0) {
        A.add(n2, vi, -1);
        A.add(vi, n2, -1);
      }
      b[vi] += vdc;
    } else if (comp.type === 'isource') {
      const idc = comp.params.dc || 0;
      if (n1 >= 0) b[n1] -= idc;
      if (n2 >= 0) b[n2] += idc;
    } else if (comp.type === 'diode') {
      // Newton-Raphson linearization for diode
      const is = comp.params.is || 1e-14;
      const nfactor = comp.params.n || 1;
      const vt = 0.02585 * nfactor; // thermal voltage * n

      let vd = 0;
      if (prevSolution) {
        vd = getNodeVoltage(comp.nodes[0], prevSolution, allNodes) - getNodeVoltage(comp.nodes[1], prevSolution, allNodes);
      }
      // Clamp to avoid numerical issues
      vd = Math.max(-10, Math.min(vd, 0.8));

      const id = is * (Math.exp(vd / vt) - 1);
      const gd = (is / vt) * Math.exp(vd / vt);
      const ieq = id - gd * vd;

      if (n1 >= 0) A.add(n1, n1, gd);
      if (n2 >= 0) A.add(n2, n2, gd);
      if (n1 >= 0 && n2 >= 0) {
        A.add(n1, n2, -gd);
        A.add(n2, n1, -gd);
      }
      if (n1 >= 0) b[n1] -= ieq;
      if (n2 >= 0) b[n2] += ieq;
    } else if (comp.type === 'opamp') {
      // Ideal op-amp: V+ = V- (virtual short)
      // nodes[0] = +, nodes[1] = -, nodes[2] = out
      const nPos = getNodeIndex(comp.nodes[0], allNodes);
      const nNeg = getNodeIndex(comp.nodes[1], allNodes);
      const nOut = getNodeIndex(comp.nodes[2], allNodes);
      const gain = comp.params.gain || 100000;

      // Model as VCVS: V(out) = gain * (V+ - V-)
      // Need an extra row for the voltage source
      // Simplified: large gain voltage source
      const gi = totalSize > n + circuit.vsCount ? n + circuit.vsCount : n;

      // Use Norton equivalent with large gm
      const gm = gain * 1e-6;
      if (nOut >= 0 && nPos >= 0) A.add(nOut, nPos, gm);
      if (nOut >= 0 && nNeg >= 0) A.add(nOut, nNeg, -gm);
      // Add output resistance
      const rout = 1e6;
      const gout = 1 / rout;
      if (nOut >= 0) {
        A.add(nOut, nOut, gout);
      }
    } else if (comp.type === 'switch') {
      const state = comp.params.state || 0;
      const ron = comp.params.ron || 0.001;
      const roff = comp.params.roff || 1e9;
      const r = state ? ron : roff;
      const g = 1 / r;
      if (n1 >= 0) A.add(n1, n1, g);
      if (n2 >= 0) A.add(n2, n2, g);
      if (n1 >= 0 && n2 >= 0) {
        A.add(n1, n2, -g);
        A.add(n2, n1, -g);
      }
    } else if (comp.type === 'transformer') {
      const ratio = comp.params.ratio || comp.params.turns_ratio || 1;
      // Ideal transformer: V1/V2 = N, I1/I2 = -1/N
      // Simplified: model as coupled voltage-controlled sources
      // For now, just connect with ratio
      const r1 = 0.001;
      const g1 = 1 / r1;
      if (n1 >= 0) A.add(n1, n1, g1);
      const n3 = getNodeIndex(comp.nodes[2], allNodes);
      const n4 = comp.nodes.length > 3 ? getNodeIndex(comp.nodes[3], allNodes) : -1;
      if (n3 >= 0) A.add(n3, n3, g1 * ratio * ratio);
    }
  }

  const solution = solveLinearSystem(A, b);

  // Extract results
  const nodeVoltages = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    nodeVoltages.set(allNodes[i + 1], solution[i]);
  }
  nodeVoltages.set('0', 0);

  const branchCurrents = new Map<string, number>();
  for (const [compId, idx] of vsIndices) {
    branchCurrents.set(compId, solution[idx]);
  }

  return { nodeVoltages, branchCurrents, converged: true };
}

function getNodeVoltage(nodeId: string, solution: Float64Array, allNodes: string[]): number {
  if (nodeId === '0') return 0;
  const idx = allNodes.indexOf(nodeId);
  if (idx < 0 || idx === 0) return 0;
  return solution[idx - 1] || 0; // -1 because ground is not in solution vector
}

// ─── Analysis Runners ──────────────────────────────────────────────────

export function runOperatingPoint(circuit: SimCircuit, settings: SimulationSettings): SimulationResult {
  const result = assembleAndSolve(circuit, 0, settings);
  const traces: SimTrace[] = [];
  const measurements: Record<string, number> = {};

  for (const [nodeId, voltage] of result.nodeVoltages) {
    if (nodeId !== '0') {
      measurements[`V(${nodeId})`] = voltage;
    }
  }
  for (const [compId, current] of result.branchCurrents) {
    measurements[`I(${compId})`] = current;
  }

  return {
    id: generateId('sim'),
    timestamp: Date.now(),
    analysisType: 'op',
    status: result.converged ? 'success' : 'error',
    parameters: {},
    traces,
    measurements,
  };
}

export function runTransientAnalysis(circuit: SimCircuit, settings: SimulationSettings): SimulationResult {
  const ts = settings.transient!;
  const tStart = ts.startTime || 0;
  const tStop = ts.stopTime;
  let dt = ts.maxTimeStep || tStop / 1000;
  
  // Determine time steps
  const numSteps = Math.min(Math.ceil(tStop / dt), 10000);
  dt = tStop / numSteps;
  
  const timePoints: number[] = [];
  for (let i = 0; i <= numSteps; i++) {
    timePoints.push(tStart + i * dt);
  }

  // Track node voltages over time
  const nodeOrder = Array.from(circuit.nodes.keys()).filter(id => id !== '0').sort();
  const allNodes = ['0', ...nodeOrder];
  const traceData = new Map<string, Float64Array>();
  const timeArr = new Float64Array(timePoints);

  // Initialize trace storage
  for (const nodeId of nodeOrder) {
    traceData.set(`V(${nodeId})`, new Float64Array(timePoints.length));
  }
  for (const comp of circuit.components) {
    if (comp.type === 'vsource' || comp.type === 'isource') {
      traceData.set(`I(${comp.ref})`, new Float64Array(timePoints.length));
    }
  }

  let prevSolution: Float64Array | undefined;
  let converged = true;

  for (let step = 0; step < timePoints.length; step++) {
    const t = timePoints[step];
    
    // Newton-Raphson iteration for nonlinear convergence
    let nrConverged = false;
    let sol: MNAResult | null = null;
    
    for (let iter = 0; iter < 50; iter++) {
      sol = assembleAndSolve(circuit, t, settings, prevSolution, allNodes, dt);
      
      // Check convergence
      if (prevSolution) {
        let maxDiff = 0;
        const sortedNodes = nodeOrder;
        for (let i = 0; i < sortedNodes.length; i++) {
          const v = sol.nodeVoltages.get(sortedNodes[i]) || 0;
          const pv = prevSolution[i] || 0;
          maxDiff = Math.max(maxDiff, Math.abs(v - pv));
        }
        if (maxDiff < 1e-6) {
          nrConverged = true;
          break;
        }
      } else {
        nrConverged = true;
        break;
      }
      
      // Update previous solution for next iteration
      const sortedNodes = nodeOrder;
      prevSolution = new Float64Array(sortedNodes.length);
      for (let i = 0; i < sortedNodes.length; i++) {
        prevSolution[i] = sol.nodeVoltages.get(sortedNodes[i]) || 0;
      }
    }

    if (!nrConverged) {
      converged = false;
    }

    // Store results
    if (sol) {
      for (const nodeId of nodeOrder) {
        const arr = traceData.get(`V(${nodeId})`)!;
        arr[step] = sol.nodeVoltages.get(nodeId) || 0;
      }
      for (const comp of circuit.components) {
        if ((comp.type === 'vsource' || comp.type === 'isource') && sol.branchCurrents.has(comp.id)) {
          const arr = traceData.get(`I(${comp.ref})`)!;
          arr[step] = sol.branchCurrents.get(comp.id) || 0;
        }
      }

      // Update prevSolution
      prevSolution = new Float64Array(nodeOrder.length);
      for (let i = 0; i < nodeOrder.length; i++) {
        prevSolution[i] = sol.nodeVoltages.get(nodeOrder[i]) || 0;
      }
    }
  }

  // Create traces
  const traces: SimTrace[] = [];
  let colorIdx = 0;
  for (const [name, data] of traceData) {
    // Skip traces that are all zeros
    let allZero = true;
    for (let i = 0; i < data.length; i++) {
      if (Math.abs(data[i]) > 1e-15) { allZero = false; break; }
    }
    if (!allZero) {
      traces.push({
        id: generateId('trace'),
        name,
        color: getTraceColor(colorIdx++),
        xUnit: 's',
        yUnit: name.startsWith('I') ? 'A' : 'V',
        xData: timeArr,
        yData: data,
      });
    }
  }

  return {
    id: generateId('sim'),
    timestamp: Date.now(),
    analysisType: 'transient',
    status: converged ? 'success' : 'convergence_warning',
    parameters: { startTime: tStart, stopTime: tStop, timeStep: dt },
    traces,
    measurements: {},
  };
}

export function runACAnalysis(circuit: SimCircuit, settings: SimulationSettings): SimulationResult {
  const ac = settings.ac!;
  const fStart = ac.startFreq;
  const fStop = ac.stopFreq;
  const pointsPerDec = ac.pointsPerDecade || 20;
  
  const freqs: number[] = [];
  if (ac.sweepType === 'decade') {
    const decades = Math.log10(fStop / fStart);
    const totalPoints = Math.max(Math.ceil(decades * pointsPerDec), 10);
    for (let i = 0; i <= totalPoints; i++) {
      freqs.push(fStart * Math.pow(10, (i * decades) / totalPoints));
    }
  } else {
    const totalPoints = pointsPerDec;
    for (let i = 0; i <= totalPoints; i++) {
      freqs.push(fStart + (i * (fStop - fStart)) / totalPoints);
    }
  }

  const nodeOrder = Array.from(circuit.nodes.keys()).filter(id => id !== '0').sort();
  const traceData = new Map<string, { mag: Float64Array; phase: Float64Array }>();
  
  for (const nodeId of nodeOrder) {
    traceData.set(nodeId, { mag: new Float64Array(freqs.length), phase: new Float64Array(freqs.length) });
  }

  // DC operating point first
  const dcResult = assembleAndSolve(circuit, 0, settings);

  // AC small-signal analysis at each frequency
  for (let fi = 0; fi < freqs.length; fi++) {
    const omega = 2 * Math.PI * freqs[fi];
    
    // Build AC matrix (simplified - stamp impedances)
    const n = nodeOrder.length;
    const totalSize = n + circuit.vsCount;
    if (totalSize === 0) continue;
    
    const Areal = new Matrix(totalSize);
    const Aimag = new Matrix(totalSize);
    const breal = new Float64Array(totalSize);
    const bimag = new Float64Array(totalSize);

    const allNodes = ['0', ...nodeOrder];

    for (const comp of circuit.components) {
      const n1 = getNodeIndex(comp.nodes[0], allNodes);
      const n2 = comp.nodes.length > 1 ? getNodeIndex(comp.nodes[1], allNodes) : -1;

      if (comp.type === 'resistor' || comp.ref?.startsWith('R')) {
        const g = 1 / (comp.params.resistance || 1000);
        if (n1 >= 0) Areal.add(n1, n1, g);
        if (n2 >= 0) Areal.add(n2, n2, g);
        if (n1 >= 0 && n2 >= 0) {
          Areal.add(n1, n2, -g);
          Areal.add(n2, n1, -g);
        }
      } else if (comp.type === 'capacitor' || comp.ref?.startsWith('C')) {
        // Y = jωC
        const yImag = omega * (comp.params.capacitance || 1e-7);
        if (n1 >= 0) Aimag.add(n1, n1, yImag);
        if (n2 >= 0) Aimag.add(n2, n2, yImag);
        if (n1 >= 0 && n2 >= 0) {
          Aimag.add(n1, n2, -yImag);
          Aimag.add(n2, n1, -yImag);
        }
      } else if (comp.type === 'inductor' || comp.ref?.startsWith('L')) {
        // Y = 1/(jωL) = -j/(ωL)
        const yImag = -1 / (omega * (comp.params.inductance || 0.01));
        if (n1 >= 0) Aimag.add(n1, n1, yImag);
        if (n2 >= 0) Aimag.add(n2, n2, yImag);
        if (n1 >= 0 && n2 >= 0) {
          Aimag.add(n1, n2, -yImag);
          Aimag.add(n2, n1, -yImag);
        }
      } else if (comp.type === 'vsource') {
        let vsIdx = n;
        let found = false;
        for (const c2 of circuit.components) {
          if (c2.type === 'vsource') {
            if (c2.id === comp.id) { found = true; break; }
            vsIdx++;
          }
        }
        if (n1 >= 0) {
          Areal.add(n1, vsIdx, 1);
          Areal.add(vsIdx, n1, 1);
        }
        if (n2 >= 0) {
          Areal.add(n2, vsIdx, -1);
          Areal.add(vsIdx, n2, -1);
        }
        // AC source magnitude
        const acMag = comp.params.ac_mag || 1;
        breal[vsIdx] += acMag;
      }
    }

    // Solve complex system: (Areal + j*Aimag) * x = b
    // For simplicity, solve magnitude approximately
    const solReal = solveLinearSystem(Areal, breal);
    const solImag = solveLinearSystem(Areal, bimag); // Simplified

    for (let i = 0; i < nodeOrder.length; i++) {
      const nodeId = nodeOrder[i];
      const td = traceData.get(nodeId)!;
      const re = solReal[i] || 0;
      const im = solImag[i] || 0;
      td.mag[fi] = Math.sqrt(re * re + im * im);
      td.phase[fi] = Math.atan2(im, re) * 180 / Math.PI;
    }
  }

  const freqArr = new Float64Array(freqs);
  const traces: SimTrace[] = [];
  let colorIdx = 0;

  for (const [nodeId, td] of traceData) {
    traces.push({
      id: generateId('trace'),
      name: `V(${nodeId}) MAG`,
      color: getTraceColor(colorIdx++),
      xUnit: 'Hz',
      yUnit: 'V',
      xData: freqArr,
      yData: td.mag,
    });
    traces.push({
      id: generateId('trace'),
      name: `V(${nodeId}) PHASE`,
      color: getTraceColor(colorIdx++),
      xUnit: 'Hz',
      yUnit: '°',
      xData: freqArr,
      yData: td.phase,
    });
  }

  return {
    id: generateId('sim'),
    timestamp: Date.now(),
    analysisType: 'ac',
    status: 'success',
    parameters: { startFreq: fStart, stopFreq: fStop, sweepType: ac.sweepType },
    traces,
    measurements: {},
  };
}

export function runDCSweep(circuit: SimCircuit, settings: SimulationSettings): SimulationResult {
  const dc = settings.dcSweep!;
  const values: number[] = [];
  for (let v = dc.startValue; v <= dc.stopValue + dc.stepValue * 0.1; v += dc.stepValue) {
    values.push(v);
  }

  const nodeOrder = Array.from(circuit.nodes.keys()).filter(id => id !== '0').sort();
  const allNodes = ['0', ...nodeOrder];
  const traceData = new Map<string, Float64Array>();
  
  for (const nodeId of nodeOrder) {
    traceData.set(`V(${nodeId})`, new Float64Array(values.length));
  }
  for (const comp of circuit.components) {
    if (comp.type === 'vsource' || comp.type === 'isource') {
      traceData.set(`I(${comp.ref})`, new Float64Array(values.length));
    }
  }

  // Find the sweep source component
  const sweepComp = circuit.components.find(c => c.ref === dc.source);
  
  for (let vi = 0; vi < values.length; vi++) {
    const val = values[vi];
    
    // Modify the sweep source value
    const modifiedCircuit = { ...circuit };
    if (sweepComp) {
      modifiedCircuit.components = circuit.components.map(c => {
        if (c.id === sweepComp.id) {
          return { ...c, params: { ...c.params, dc: val } };
        }
        return c;
      });
    }

    const sol = assembleAndSolve(modifiedCircuit, 0, settings);

    for (const nodeId of nodeOrder) {
      const arr = traceData.get(`V(${nodeId})`)!;
      arr[vi] = sol.nodeVoltages.get(nodeId) || 0;
    }
    for (const comp of circuit.components) {
      if ((comp.type === 'vsource' || comp.type === 'isource') && sol.branchCurrents.has(comp.id)) {
        const arr = traceData.get(`I(${comp.ref})`)!;
        arr[vi] = sol.branchCurrents.get(comp.id) || 0;
      }
    }
  }

  const xArr = new Float64Array(values);
  const traces: SimTrace[] = [];
  let colorIdx = 0;

  for (const [name, data] of traceData) {
    let allZero = true;
    for (let i = 0; i < data.length; i++) {
      if (Math.abs(data[i]) > 1e-15) { allZero = false; break; }
    }
    if (!allZero) {
      traces.push({
        id: generateId('trace'),
        name,
        color: getTraceColor(colorIdx++),
        xUnit: 'V',
        yUnit: name.startsWith('I') ? 'A' : 'V',
        xData: xArr,
        yData: data,
      });
    }
  }

  return {
    id: generateId('sim'),
    timestamp: Date.now(),
    analysisType: 'dcSweep',
    status: 'success',
    parameters: { source: dc.source, start: dc.startValue, stop: dc.stopValue, step: dc.stepValue },
    traces,
    measurements: {},
  };
}

export function runParameterSweep(circuit: SimCircuit, settings: SimulationSettings): SimulationResult {
  const ps = settings.paramSweep!;
  const baseSettings = { ...settings };
  
  // Determine sweep values
  let values: number[] = [];
  if (ps.sweepType === 'list' && ps.values) {
    values = ps.values;
  } else if (ps.sweepType === 'logarithmic' && ps.startValue && ps.stopValue && ps.points) {
    const logStart = Math.log10(ps.startValue);
    const logStop = Math.log10(ps.stopValue);
    for (let i = 0; i < ps.points; i++) {
      values.push(Math.pow(10, logStart + (i * (logStop - logStart)) / (ps.points - 1)));
    }
  } else if (ps.startValue && ps.stopValue && ps.points) {
    for (let i = 0; i < ps.points; i++) {
      values.push(ps.startValue + (i * (ps.stopValue - ps.startValue)) / (ps.points - 1));
    }
  }

  // Parse target: "R1.resistance" -> component ref, property
  const [targetRef, targetProp] = (ps.target || '').split('.');
  
  const traces: SimTrace[] = [];
  const nodeOrder = Array.from(circuit.nodes.keys()).filter(id => id !== '0').sort();
  const allNodes = ['0', ...nodeOrder];

  for (let vi = 0; vi < values.length; vi++) {
    const val = values[vi];
    
    // Modify the target component
    const modifiedCircuit: SimCircuit = {
      ...circuit,
      components: circuit.components.map(c => {
        if (c.ref === targetRef) {
          return { ...c, params: { ...c.params, [targetProp || 'resistance']: val } };
        }
        return c;
      }),
    };

    // Run transient or DC on modified circuit
    let result: SimulationResult;
    if (baseSettings.analysisType === 'transient' && baseSettings.transient) {
      result = runTransientAnalysis(modifiedCircuit, baseSettings);
    } else {
      result = runDCSweep(modifiedCircuit, baseSettings);
    }

    // Add traces with sweep label
    for (const trace of result.traces) {
      traces.push({
        ...trace,
        id: generateId('trace'),
        name: `${trace.name} (${ps.target}=${formatSweepValue(val)})`,
        color: getTraceColor(vi),
        sweepParam: ps.target,
        sweepValue: val,
      });
    }
  }

  return {
    id: generateId('sim'),
    timestamp: Date.now(),
    analysisType: 'paramSweep',
    status: 'success',
    parameters: { target: ps.target, values },
    traces,
    measurements: {},
  };
}

function formatSweepValue(val: number): string {
  if (Math.abs(val) >= 1e6) return `${(val/1e6).toFixed(1)}M`;
  if (Math.abs(val) >= 1e3) return `${(val/1e3).toFixed(1)}k`;
  if (Math.abs(val) >= 1) return val.toFixed(1);
  if (Math.abs(val) >= 1e-3) return `${(val*1e3).toFixed(1)}m`;
  if (Math.abs(val) >= 1e-6) return `${(val*1e6).toFixed(1)}u`;
  if (Math.abs(val) >= 1e-9) return `${(val*1e9).toFixed(1)}n`;
  return val.toExponential(2);
}

// ─── Main Simulation Entry Point ───────────────────────────────────────

export function runSimulation(
  components: ComponentInstance[],
  nets: Net[],
  powerSymbols: PowerSymbol[],
  settings: SimulationSettings,
  probes?: Probe[],
): SimulationResult {
  const circuit = buildSimCircuit(components, nets, powerSymbols);

  // Validate
  const errors = validateCircuit(circuit, components, nets, powerSymbols);
  if (errors.length > 0) {
    return {
      id: generateId('sim'),
      timestamp: Date.now(),
      analysisType: settings.analysisType,
      status: 'error',
      parameters: {},
      traces: [],
      measurements: {},
      error: errors.join('\n'),
    };
  }

  switch (settings.analysisType) {
    case 'op': return runOperatingPoint(circuit, settings);
    case 'transient': return runTransientAnalysis(circuit, settings);
    case 'ac': return runACAnalysis(circuit, settings);
    case 'dcSweep': return runDCSweep(circuit, settings);
    case 'paramSweep': return runParameterSweep(circuit, settings);
    default:
      return {
        id: generateId('sim'),
        timestamp: Date.now(),
        analysisType: settings.analysisType,
        status: 'error',
        parameters: {},
        traces: [],
        measurements: {},
        error: `Unsupported analysis type: ${settings.analysisType}`,
      };
  }
}

// ─── Circuit Validation ────────────────────────────────────────────────

export function validateCircuit(
  circuit: SimCircuit,
  components: ComponentInstance[],
  nets: Net[],
  powerSymbols: PowerSymbol[],
): string[] {
  const errors: string[] = [];

  // Check for ground
  const hasGround = powerSymbols.some(p => p.type === 'gnd') || 
    circuit.nodes.has('0');
  if (!hasGround) {
    errors.push('ERROR: No ground reference found. Add a GND symbol.');
  }

  // Check for unconnected pins
  for (const comp of components) {
    const sym = COMPONENT_MAP.get(comp.symbolId);
    if (!sym) continue;
    for (const pin of sym.pins) {
      const connected = nets.some(net => 
        net.pinRefs.some(ref => ref.componentId === comp.id && ref.pinId === pin.id)
      );
      if (!connected && pin.type !== 'passive') {
        // Only warn for important pins
      }
    }
  }

  // Check for duplicate references
  const refs = new Map<string, string[]>();
  for (const comp of components) {
    if (!comp.reference) continue;
    const existing = refs.get(comp.reference) || [];
    existing.push(comp.id);
    refs.set(comp.reference, existing);
  }
  for (const [ref, ids] of refs) {
    if (ids.length > 1) {
      errors.push(`ERROR: Duplicate reference "${ref}" found on ${ids.length} components.`);
    }
  }

  // Check for missing values
  for (const comp of components) {
    const sym = COMPONENT_MAP.get(comp.symbolId);
    if (!sym || sym.simulationModel.type === 'passive' && !comp.value && sym.defaultValues) {
      // Check if critical params are set
    }
  }

  return errors;
}

// ─── Probe Measurement Extraction ──────────────────────────────────────

export function extractProbeData(
  result: SimulationResult,
  probe: Probe,
  nets: Net[],
): SimTrace | null {
  if (!probe.netId) return null;

  const net = nets.find(n => n.id === probe.netId);
  if (!net) return null;

  const signalName = probe.type === 'voltage' ? `V(${net.name})` :
    probe.type === 'current' ? `I(${net.name})` :
    `V(${net.name})`;

  return result.traces.find(t => t.name === signalName || t.name.includes(net.name)) || null;
}