'use client';
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useProjectStore } from '@/store/project-store';
import { COMPONENT_MAP } from '@/circuit/library';
import { snapPoint, getAbsolutePinPosition, distance, routeOrthogonal, transformPoint } from '@/circuit/utils';
import type { Point, ComponentInstance, SymbolDef, Transform, WireSegment } from '@/circuit/types';

// ─── SVG Symbol Renderer ───────────────────────────────────────────────

function renderSymbolBody(sym: SymbolDef, transform: Transform, isSelected: boolean, isError: boolean) {
  const elements: React.ReactNode[] = [];
  const bodyColor = isError ? 'var(--cb-error)' : isSelected ? 'var(--cb-selection)' : 'var(--cb-component)';
  const fillColor = isSelected ? 'var(--cb-accent-light)' : 'none';

  // Paths
  sym.bodyPaths.forEach((d, i) => {
    elements.push(
      <path key={`p-${i}`} d={d} fill="none" stroke={bodyColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    );
  });

  // Rects
  sym.bodyRects.forEach((r, i) => {
    elements.push(
      <rect key={`r-${i}`} x={r.x} y={r.y} width={r.w} height={r.h} fill={fillColor} stroke={bodyColor} strokeWidth="1.5" rx="2" />
    );
  });

  // Circles
  sym.bodyCircles.forEach((c, i) => {
    elements.push(
      <circle key={`c-${i}`} cx={c.cx} cy={c.cy} r={c.r} fill={fillColor} stroke={bodyColor} strokeWidth="1.5" />
    );
  });

  // Lines
  sym.bodyLines.forEach((l, i) => {
    elements.push(
      <line key={`l-${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={bodyColor} strokeWidth="1.5" strokeLinecap="round" />
    );
  });

  return <g className="component-body">{elements}</g>;
}

function renderPins(sym: SymbolDef, showPinNames: boolean) {
  return (
    <g className="pins">
      {sym.pins.map(pin => (
        <g key={pin.id}>
          <circle cx={pin.position.x} cy={pin.position.y} r={3} fill="var(--cb-pin)" stroke="none" />
          {showPinNames && (
            <text
              x={pin.position.x + (pin.direction === 'left' ? -8 : pin.direction === 'right' ? 8 : 0)}
              y={pin.position.y + (pin.direction === 'up' ? -8 : pin.direction === 'down' ? 12 : 4)}
              textAnchor={pin.direction === 'left' ? 'end' : pin.direction === 'right' ? 'start' : 'middle'}
              fontSize="8"
              fill="var(--cb-text-muted)"
            >
              {pin.name}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}

function renderLabels(sym: SymbolDef, comp: ComponentInstance) {
  return (
    <g className="labels">
      {sym.labels.map((lbl, i) => {
        let text = lbl.text
          .replace('@REF', comp.reference)
          .replace('@VALUE', comp.value);
        return (
          <text
            key={i}
            x={lbl.x}
            y={lbl.y}
            textAnchor={lbl.anchor as 'start' | 'middle' | 'end'}
            fontSize={lbl.fontSize}
            fill="var(--cb-text-secondary)"
            fontFamily="var(--cb-font-mono)"
          >
            {text}
          </text>
        );
      })}
    </g>
  );
}

// ─── Component SVG ─────────────────────────────────────────────────────

function ComponentSVG({ comp, isSelected, onMouseDown }: {
  comp: ComponentInstance;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const sym = COMPONENT_MAP.get(comp.symbolId);
  if (!sym) return null;

  const { position: pos, transform } = comp;
  const rot = transform.orientation;
  const mirrorX = transform.mirror === 'horizontal' ? -1 : 1;
  const mirrorY = transform.mirror === 'vertical' ? -1 : 1;

  return (
    <g
      className={`svg-component ${isSelected ? 'selected' : ''}`}
      transform={`translate(${pos.x}, ${pos.y}) rotate(${rot}) scale(${mirrorX}, ${mirrorY})`}
      onMouseDown={onMouseDown}
    >
      {renderSymbolBody(sym, transform, isSelected, false)}
      {renderPins(sym, comp.visible.pinNames)}
      {renderLabels(sym, comp)}
    </g>
  );
}

// ─── Wire SVG ──────────────────────────────────────────────────────────

function WireSVG({ wire, isSelected, onMouseDown }: {
  wire: WireSegment;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  if (wire.points.length < 2) return null;
  const d = wire.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return (
    <g className={`svg-wire ${isSelected ? 'selected' : ''}`} onMouseDown={onMouseDown}>
      <path d={d} fill="none" stroke={isSelected ? 'var(--cb-selection)' : 'var(--cb-wire)'} strokeWidth={isSelected ? 2.5 : 1.5} strokeLinejoin="round" />
      {/* Invisible wider path for easier clicking */}
      <path d={d} fill="none" stroke="transparent" strokeWidth={10} />
    </g>
  );
}

// ─── Main Canvas ───────────────────────────────────────────────────────

export default function SchematicCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const store = useProjectStore();
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [dragCompId, setDragCompId] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState<Point>({ x: 0, y: 0 });
  const [mouseCanvasPos, setMouseCanvasPos] = useState<Point>({ x: 0, y: 0 });

  const sheet = store.getCurrentSheet();
  const { zoom, pan, gridVisible, snapEnabled, gridSize, toolMode, selection, wireState } = store;

  // Convert screen coords to canvas coords
  const screenToCanvas = useCallback((clientX: number, clientY: number): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = (clientX - rect.left - pan.x) / zoom;
    const y = (clientY - rect.top - pan.y) / zoom;
    return snapEnabled ? snapPoint({ x, y }, gridSize) : { x, y };
  }, [pan, zoom, snapEnabled, gridSize]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle button pan
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
      return;
    }

    if (e.button === 0) {
      const canvasPos = screenToCanvas(e.clientX, e.clientY);

      if (toolMode === 'wire') {
        if (!wireState.isDrawing) {
          store.startWire(canvasPos);
        } else {
          store.addWirePoint(canvasPos);
        }
        return;
      }

      if (toolMode === 'component' && store.placementSymbolId) {
        store.placeComponent(store.placementSymbolId, canvasPos);
        return;
      }

      if (toolMode === 'probe') {
        store.addProbe(store.probeKind ?? 'voltage', canvasPos);
        store.setToolMode('select');
        return;
      }

      if (toolMode === 'label') {
        const name = window.prompt('Net label name:', 'NET');
        if (name && name.trim()) store.addNetLabel(name.trim(), canvasPos, 0);
        store.setToolMode('select');
        return;
      }

      // Click on empty space - deselect
      const target = e.target as SVGElement;
      if (target === svgRef.current || target.classList.contains('canvas-bg')) {
        store.clearSelection();
      }
    }
  }, [toolMode, wireState.isDrawing, pan, screenToCanvas, store]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    setCursorPos(canvasPos);
    setMouseCanvasPos({ x: e.clientX, y: e.clientY });

    if (isPanning) {
      store.setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    if (dragCompId && dragStart) {
      const dx = canvasPos.x - dragStart.x;
      const dy = canvasPos.y - dragStart.y;
      const comp = sheet.components.find(c => c.id === dragCompId);
      if (comp) {
        store.moveComponent(dragCompId, { x: comp.position.x + dx, y: comp.position.y + dy });
        setDragStart(canvasPos);
      }
    }
  }, [isPanning, panStart, dragCompId, dragStart, screenToCanvas, store, sheet.components]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    if (dragCompId) {
      store.pushHistory();
      setDragCompId(null);
      setDragStart(null);
    }
  }, [dragCompId, store]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const newZoom = Math.max(0.1, Math.min(5, zoom * delta));
    const factor = newZoom / zoom;
    store.setZoom(newZoom);
    store.setPan({ x: mx - factor * (mx - pan.x), y: my - factor * (my - pan.y) });
  }, [zoom, pan, store]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      switch (e.key) {
        case 'w': case 'W': store.setToolMode('wire'); break;
        case 'l': case 'L': store.setToolMode('label'); break;
        case 'r': case 'R':
          if (selection.type === 'component' && selection.id) store.rotateComponent(selection.id);
          break;
        case 'm': case 'M':
          if (selection.type === 'component' && selection.id) store.mirrorComponent(selection.id, 'horizontal');
          break;
        case 'Delete': case 'Backspace':
          if (selection.type === 'component' && selection.id) store.deleteComponent(selection.id);
          else if (selection.type === 'wire' && selection.id) store.deleteWire(selection.id);
          break;
        case 'Escape':
          store.cancelWire();
          store.setToolMode('select');
          store.clearSelection();
          break;
        case 'z':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); store.undo(); }
          break;
        case 'y':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); store.redo(); }
          break;
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            store.saveToBrowser();
          }
          break;
        case 'a':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); store.selectAll(); }
          break;
        case 'c':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); store.copy(); }
          break;
        case 'v':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); store.paste(); }
          break;
        case 'd':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); store.duplicate(); }
          break;
        case 'F5':
          e.preventDefault();
          store.runSim();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection, store]);

  // Handle component click for selection and drag start
  const handleComponentMouseDown = useCallback((compId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    store.select('component', compId);
    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    setDragCompId(compId);
    setDragStart(canvasPos);
  }, [screenToCanvas, store]);

  const handleWireMouseDown = useCallback((wireId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    store.select('wire', wireId);
  }, [store]);

  // Grid rendering
  const renderGrid = () => {
    if (!gridVisible) return null;
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    const startX = Math.floor(-pan.x / zoom / gridSize) * gridSize;
    const startY = Math.floor(-pan.y / zoom / gridSize) * gridSize;
    const endX = startX + w / zoom + gridSize * 2;
    const endY = startY + h / zoom + gridSize * 2;

    const dots: React.ReactNode[] = [];
    const majorEvery = 5;
    
    for (let x = startX; x < endX; x += gridSize) {
      for (let y = startY; y < endY; y += gridSize) {
        const isMajor = Math.round(x / gridSize) % majorEvery === 0 && Math.round(y / gridSize) % majorEvery === 0;
        dots.push(
          <circle
            key={`${x}-${y}`}
            cx={x} cy={y}
            r={isMajor ? 1 : 0.5}
            fill={isMajor ? 'var(--cb-grid-major)' : 'var(--cb-grid)'}
          />
        );
      }
    }
    return <g className="grid">{dots}</g>;
  };

  // Crosshair cursor
  const renderCrosshair = () => {
    if (toolMode !== 'wire' && toolMode !== 'component') return null;
    return (
      <g opacity="0.4">
        <line x1={cursorPos.x - 1000} y1={cursorPos.y} x2={cursorPos.x + 1000} y2={cursorPos.y} stroke="var(--cb-accent)" strokeWidth="0.5" />
        <line x1={cursorPos.x} y1={cursorPos.y - 1000} x2={cursorPos.x} y2={cursorPos.y + 1000} stroke="var(--cb-accent)" strokeWidth="0.5" />
      </g>
    );
  };

  // Wire preview while drawing
  const renderWirePreview = () => {
    if (!wireState.isDrawing || wireState.points.length === 0) return null;
    const points = wireState.points;
    const lastPt = points[points.length - 1];
    const previewPts = routeOrthogonal(lastPt, cursorPos);
    const allPts = [...points, ...previewPts.slice(1)];
    const d = allPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    return (
      <path d={d} fill="none" stroke="var(--cb-accent)" strokeWidth="1.5" strokeDasharray="4 2" />
    );
  };

  // Junction dots
  const renderJunctions = () => {
    return sheet.junctions.map(j => (
      <circle key={j.id} cx={j.position.x} cy={j.position.y} r={3} fill="var(--cb-wire)" />
    ));
  };

  // Net labels
  const renderNetLabels = () => {
    return sheet.labels.map(label => (
      <g key={label.id} transform={`translate(${label.position.x}, ${label.position.y})`}>
        <rect x={-2} y={-12} width={label.name.length * 7 + 4} height={16} fill="var(--cb-surface)" stroke="var(--cb-border)" strokeWidth="0.5" rx="2" />
        <text x={0} y={0} fontSize="10" fill="var(--cb-accent)" fontFamily="var(--cb-font-mono)">{label.name}</text>
        <line x1={0} y1={2} x2={0} y2={10} stroke="var(--cb-accent)" strokeWidth="1" />
      </g>
    ));
  };

  // Power symbols
  const renderPowerSymbols = () => {
    return sheet.powerSymbols.map(ps => {
      const isGnd = ps.type === 'gnd';
      return (
        <g key={ps.id} transform={`translate(${ps.position.x}, ${ps.position.y})`}>
          {isGnd ? (
            <g>
              <line x1={0} y1={-20} x2={0} y2={0} stroke="var(--cb-component)" strokeWidth="1.5" />
              <line x1={-10} y1={0} x2={10} y2={0} stroke="var(--cb-component)" strokeWidth="1.5" />
              <line x1={-7} y1={5} x2={7} y2={5} stroke="var(--cb-component)" strokeWidth="1.5" />
              <line x1={-3} y1={10} x2={3} y2={10} stroke="var(--cb-component)" strokeWidth="1.5" />
            </g>
          ) : (
            <g>
              <line x1={0} y1={20} x2={0} y2={4} stroke="var(--cb-component)" strokeWidth="1.5" />
              <polygon points="-6,4 0,-4 6,4" fill="none" stroke="var(--cb-component)" strokeWidth="1.5" />
              <text x={0} y={-10} textAnchor="middle" fontSize="9" fill="var(--cb-text-secondary)" fontFamily="var(--cb-font-mono)">{ps.type.toUpperCase()}</text>
            </g>
          )}
        </g>
      );
    });
  };

  // Probes
  const renderProbes = () => {
    return sheet.probes.map(probe => {
      const colors: Record<string, string> = {
        voltage: '#2563eb', current: '#d97706', differential: '#7c3aed', power: '#16a34a',
      };
      const c = probe.color || colors[probe.type] || '#2563eb';
      return (
        <g key={probe.id} transform={`translate(${probe.position.x}, ${probe.position.y})`}>
          <circle cx={0} cy={0} r={6} fill={c} opacity="0.3" />
          <circle cx={0} cy={0} r={3} fill={c} />
          <text x={10} y={4} fontSize="9" fill={c} fontFamily="var(--cb-font-mono)">{probe.name}</text>
        </g>
      );
    });
  };

  const cursorStyle = toolMode === 'wire' ? 'crosshair' :
    toolMode === 'component' ? 'copy' :
    isPanning ? 'grabbing' : 'default';

  return (
    <div className="canvas-container flex-1 relative" style={{ cursor: cursorStyle }}>
      {/* Coordinates display */}
      <div className="absolute bottom-2 right-2 text-[10px] text-[var(--cb-text-muted)] mono bg-[var(--cb-surface)] border border-[var(--cb-border)] px-2 py-0.5 rounded z-10">
        {Math.round(cursorPos.x)}, {Math.round(cursorPos.y)}
      </div>

      <svg
        ref={svgRef}
        className="w-full h-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Background */}
          <rect className="canvas-bg" x={-10000} y={-10000} width={20000} height={20000} fill="var(--cb-canvas-bg)" />

          {/* Grid */}
          {renderGrid()}

          {/* Crosshair */}
          {renderCrosshair()}

          {/* Wires */}
          {sheet.wires.map(wire => (
            <WireSVG
              key={wire.id}
              wire={wire}
              isSelected={selection.ids.includes(wire.id)}
              onMouseDown={(e) => handleWireMouseDown(wire.id, e)}
            />
          ))}

          {/* Wire preview */}
          {renderWirePreview()}

          {/* Junctions */}
          {renderJunctions()}

          {/* Power symbols */}
          {renderPowerSymbols()}

          {/* Net labels */}
          {renderNetLabels()}

          {/* Components */}
          {sheet.components.map(comp => (
            <ComponentSVG
              key={comp.id}
              comp={comp}
              isSelected={selection.ids.includes(comp.id)}
              onMouseDown={(e) => handleComponentMouseDown(comp.id, e)}
            />
          ))}

          {/* Probes */}
          {renderProbes()}
        </g>
      </svg>

      {/* Tool mode indicator */}
      {toolMode !== 'select' && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-[var(--cb-accent)] text-white px-3 py-1 rounded text-xs font-medium z-10">
          {toolMode === 'wire' ? 'Wire Mode (Click to place, Escape to cancel)' :
           toolMode === 'component' ? 'Place Component (Click to place, Escape to cancel)' :
           toolMode === 'label' ? 'Net Label Mode' : toolMode}
        </div>
      )}
    </div>
  );
}