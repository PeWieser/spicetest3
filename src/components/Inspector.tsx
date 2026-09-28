'use client';
import React from 'react';
import { useProjectStore } from '@/store/project-store';
import { COMPONENT_MAP } from '@/circuit/library';

export default function Inspector() {
  const store = useProjectStore();
  const sheet = store.getCurrentSheet();
  const { selection } = store;

  if (!store.rightPanelVisible) return null;

  const selectedComp = selection.type === 'component' && selection.id
    ? sheet.components.find(c => c.id === selection.id) : null;

  const selectedWire = selection.type === 'wire' && selection.id
    ? sheet.wires.find(w => w.id === selection.id) : null;

  const selectedProbe = selection.type === 'probe' && selection.id
    ? sheet.probes.find(p => p.id === selection.id) : null;

  return (
    <div className="flex flex-col h-full bg-[var(--cb-surface)] border-l border-[var(--cb-border)]" style={{ width: 'var(--cb-panel-width-right)' }}>
      <div className="panel-header">Inspector</div>

      <div className="flex-1 overflow-y-auto p-2">
        {/* No selection */}
        {!selectedComp && !selectedWire && !selectedProbe && (
          <div className="text-xs text-[var(--cb-text-muted)] p-4 text-center">
            Select a component, wire, or probe to view properties.
          </div>
        )}

        {/* Component Inspector */}
        {selectedComp && (() => {
          const sym = COMPONENT_MAP.get(selectedComp.symbolId);
          if (!sym) return <div className="text-xs text-[var(--cb-error)]">Unknown component</div>;

          return (
            <div className="space-y-3">
              {/* General */}
              <InspectorSection title="General">
                <PropertyRow label="Symbol" value={sym.name} readOnly />
                <PropertyRow label="Reference" value={selectedComp.reference} onChange={v => {
                  store.updateComponentProperty(selectedComp.id, 'reference', v);
                  // Also update the component's reference field directly
                }} />
                <PropertyRow label="Value" value={selectedComp.value} onChange={v => store.updateComponentValue(selectedComp.id, v)} />
              </InspectorSection>

              {/* Simulation Parameters */}
              <InspectorSection title="Simulation">
                <PropertyRow label="Model Type" value={sym.simulationModel.type} readOnly />
                {sym.propertySchema.map(prop => (
                  <PropertyRow
                    key={prop.key}
                    label={prop.label}
                    value={selectedComp.properties[prop.key] || prop.default}
                    unit={prop.unit}
                    onChange={v => store.updateComponentProperty(selectedComp.id, prop.key, v)}
                  />
                ))}
              </InspectorSection>

              {/* Appearance */}
              <InspectorSection title="Appearance">
                <div className="prop-row">
                  <span className="prop-label">Show Ref</span>
                  <div className="prop-value">
                    <input
                      type="checkbox"
                      checked={selectedComp.visible.reference}
                      onChange={e => {
                        store.updateComponentProperty(selectedComp.id, '_visible_ref', String(e.target.checked));
                      }}
                    />
                  </div>
                </div>
                <div className="prop-row">
                  <span className="prop-label">Show Value</span>
                  <div className="prop-value">
                    <input
                      type="checkbox"
                      checked={selectedComp.visible.value}
                      onChange={e => {
                        store.updateComponentProperty(selectedComp.id, '_visible_val', String(e.target.checked));
                      }}
                    />
                  </div>
                </div>
                <div className="prop-row">
                  <span className="prop-label">Orientation</span>
                  <div className="prop-value flex gap-1">
                    {[0, 90, 180, 270].map(deg => (
                      <button
                        key={deg}
                        className={`text-[10px] px-1.5 py-0.5 rounded border ${
                          selectedComp.transform.orientation === deg
                            ? 'bg-[var(--cb-accent)] text-white border-[var(--cb-accent)]'
                            : 'border-[var(--cb-border)]'
                        }`}
                        onClick={() => {
                          // Set specific orientation
                          while (selectedComp.transform.orientation !== deg) {
                            store.rotateComponent(selectedComp.id);
                          }
                        }}
                      >
                        {deg}°
                      </button>
                    ))}
                  </div>
                </div>
                <div className="prop-row">
                  <span className="prop-label">Mirror</span>
                  <div className="prop-value flex gap-1">
                    <button
                      className={`text-[10px] px-1.5 py-0.5 rounded border ${
                        selectedComp.transform.mirror === 'horizontal'
                          ? 'bg-[var(--cb-accent)] text-white border-[var(--cb-accent)]'
                          : 'border-[var(--cb-border)]'
                      }`}
                      onClick={() => store.mirrorComponent(selectedComp.id, 'horizontal')}
                    >
                      ↔ Horiz
                    </button>
                    <button
                      className={`text-[10px] px-1.5 py-0.5 rounded border ${
                        selectedComp.transform.mirror === 'vertical'
                          ? 'bg-[var(--cb-accent)] text-white border-[var(--cb-accent)]'
                          : 'border-[var(--cb-border)]'
                      }`}
                      onClick={() => store.mirrorComponent(selectedComp.id, 'vertical')}
                    >
                      ↕ Vert
                    </button>
                  </div>
                </div>
              </InspectorSection>

              {/* Position */}
              <InspectorSection title="Position">
                <PropertyRow label="X" value={String(selectedComp.position.x)} readOnly />
                <PropertyRow label="Y" value={String(selectedComp.position.y)} readOnly />
                <PropertyRow label="Pins" value={String(sym.pins.length)} readOnly />
              </InspectorSection>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  className="text-xs px-3 py-1 bg-[var(--cb-accent)] text-white rounded hover:bg-[var(--cb-accent-hover)]"
                  onClick={() => store.rotateComponent(selectedComp.id)}
                >
                  Rotate (R)
                </button>
                <button
                  className="text-xs px-3 py-1 bg-[var(--cb-accent)] text-white rounded hover:bg-[var(--cb-accent-hover)]"
                  onClick={() => store.mirrorComponent(selectedComp.id, 'horizontal')}
                >
                  Mirror (M)
                </button>
                <button
                  className="text-xs px-3 py-1 bg-[var(--cb-error)] text-white rounded hover:opacity-90"
                  onClick={() => store.deleteComponent(selectedComp.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })()}

        {/* Wire Inspector */}
        {selectedWire && (
          <div className="space-y-3">
            <InspectorSection title="Wire">
              <PropertyRow label="ID" value={selectedWire.id} readOnly />
              <PropertyRow label="Points" value={String(selectedWire.points.length)} readOnly />
              <PropertyRow label="Net" value={selectedWire.netId || '(unresolved)'} readOnly />
            </InspectorSection>
            <button
              className="text-xs px-3 py-1 bg-[var(--cb-error)] text-white rounded"
              onClick={() => store.deleteWire(selectedWire.id)}
            >
              Delete Wire
            </button>
          </div>
        )}

        {/* Probe Inspector */}
        {selectedProbe && (
          <div className="space-y-3">
            <InspectorSection title="Probe">
              <PropertyRow label="Name" value={selectedProbe.name} onChange={v => store.updateProbe(selectedProbe.id, { name: v })} />
              <PropertyRow label="Type" value={selectedProbe.type} readOnly />
              <div className="prop-row">
                <span className="prop-label">Color</span>
                <div className="prop-value">
                  <input
                    type="color"
                    value={selectedProbe.color}
                    onChange={e => store.updateProbe(selectedProbe.id, { color: e.target.value })}
                    className="w-8 h-6 border rounded cursor-pointer"
                  />
                </div>
              </div>
              <PropertyRow label="Net" value={selectedProbe.netId || '(unresolved)'} readOnly />
              <div className="prop-row">
                <span className="prop-label">Plot Visible</span>
                <div className="prop-value">
                  <input
                    type="checkbox"
                    checked={selectedProbe.plotVisible}
                    onChange={e => store.updateProbe(selectedProbe.id, { plotVisible: e.target.checked })}
                  />
                </div>
              </div>
            </InspectorSection>
            <button
              className="text-xs px-3 py-1 bg-[var(--cb-error)] text-white rounded"
              onClick={() => store.deleteProbe(selectedProbe.id)}
            >
              Delete Probe
            </button>
          </div>
        )}

        {/* Simulation Settings */}
        <InspectorSection title="Simulation Settings">
          <div className="prop-row">
            <span className="prop-label">Analysis</span>
            <div className="prop-value">
              <select
                className="w-full text-xs"
                value={store.simSettings.analysisType}
                onChange={e => store.setSimSettings({ analysisType: e.target.value as any })}
              >
                <option value="op">Operating Point</option>
                <option value="transient">Transient</option>
                <option value="ac">AC Analysis</option>
                <option value="dcSweep">DC Sweep</option>
                <option value="paramSweep">Parameter Sweep</option>
              </select>
            </div>
          </div>

          {store.simSettings.analysisType === 'transient' && store.simSettings.transient && (
            <>
              <PropertyRow label="Stop Time" value={String(store.simSettings.transient.stopTime)} unit="s"
                onChange={v => store.setSimSettings({ transient: { ...store.simSettings.transient!, stopTime: parseFloat(v) || 0.01 } })} />
              <PropertyRow label="Max Step" value={String(store.simSettings.transient.maxTimeStep)} unit="s"
                onChange={v => store.setSimSettings({ transient: { ...store.simSettings.transient!, maxTimeStep: parseFloat(v) || 1e-5 } })} />
              <PropertyRow label="Start Time" value={String(store.simSettings.transient.startTime)} unit="s"
                onChange={v => store.setSimSettings({ transient: { ...store.simSettings.transient!, startTime: parseFloat(v) || 0 } })} />
            </>
          )}

          {store.simSettings.analysisType === 'ac' && store.simSettings.ac && (
            <>
              <PropertyRow label="Start Freq" value={String(store.simSettings.ac.startFreq)} unit="Hz"
                onChange={v => store.setSimSettings({ ac: { ...store.simSettings.ac!, startFreq: parseFloat(v) || 1 } })} />
              <PropertyRow label="Stop Freq" value={String(store.simSettings.ac.stopFreq)} unit="Hz"
                onChange={v => store.setSimSettings({ ac: { ...store.simSettings.ac!, stopFreq: parseFloat(v) || 1e6 } })} />
              <PropertyRow label="Pts/Decade" value={String(store.simSettings.ac.pointsPerDecade)}
                onChange={v => store.setSimSettings({ ac: { ...store.simSettings.ac!, pointsPerDecade: parseInt(v) || 20 } })} />
              <div className="prop-row">
                <span className="prop-label">Sweep</span>
                <div className="prop-value">
                  <select className="w-full text-xs" value={store.simSettings.ac.sweepType}
                    onChange={e => store.setSimSettings({ ac: { ...store.simSettings.ac!, sweepType: e.target.value as any } })}>
                    <option value="decade">Decade</option>
                    <option value="linear">Linear</option>
                    <option value="octave">Octave</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {store.simSettings.analysisType === 'dcSweep' && store.simSettings.dcSweep && (
            <>
              <PropertyRow label="Source" value={store.simSettings.dcSweep.source}
                onChange={v => store.setSimSettings({ dcSweep: { ...store.simSettings.dcSweep!, source: v } })} />
              <PropertyRow label="Start" value={String(store.simSettings.dcSweep.startValue)} unit="V"
                onChange={v => store.setSimSettings({ dcSweep: { ...store.simSettings.dcSweep!, startValue: parseFloat(v) || 0 } })} />
              <PropertyRow label="Stop" value={String(store.simSettings.dcSweep.stopValue)} unit="V"
                onChange={v => store.setSimSettings({ dcSweep: { ...store.simSettings.dcSweep!, stopValue: parseFloat(v) || 10 } })} />
              <PropertyRow label="Step" value={String(store.simSettings.dcSweep.stepValue)} unit="V"
                onChange={v => store.setSimSettings({ dcSweep: { ...store.simSettings.dcSweep!, stepValue: parseFloat(v) || 0.1 } })} />
            </>
          )}

          {store.simSettings.analysisType === 'paramSweep' && store.simSettings.paramSweep && (
            <>
              <PropertyRow label="Target" value={store.simSettings.paramSweep.target || ''}
                onChange={v => store.setSimSettings({ paramSweep: { ...store.simSettings.paramSweep!, target: v } })} />
              <div className="prop-row">
                <span className="prop-label">Scale</span>
                <div className="prop-value">
                  <select className="w-full text-xs" value={store.simSettings.paramSweep.sweepType}
                    onChange={e => store.setSimSettings({ paramSweep: { ...store.simSettings.paramSweep!, sweepType: e.target.value as any } })}>
                    <option value="linear">Linear</option>
                    <option value="logarithmic">Logarithmic</option>
                    <option value="list">List</option>
                  </select>
                </div>
              </div>
              <PropertyRow label="Start" value={String(store.simSettings.paramSweep.startValue || 0)}
                onChange={v => store.setSimSettings({ paramSweep: { ...store.simSettings.paramSweep!, startValue: parseFloat(v) || 0 } })} />
              <PropertyRow label="Stop" value={String(store.simSettings.paramSweep.stopValue || 10000)}
                onChange={v => store.setSimSettings({ paramSweep: { ...store.simSettings.paramSweep!, stopValue: parseFloat(v) || 10000 } })} />
              <PropertyRow label="Points" value={String(store.simSettings.paramSweep.points || 10)}
                onChange={v => store.setSimSettings({ paramSweep: { ...store.simSettings.paramSweep!, points: parseInt(v) || 10 } })} />
            </>
          )}
        </InspectorSection>
      </div>
    </div>
  );
}

function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[var(--cb-border)] rounded overflow-hidden">
      <div className="px-2 py-1 text-[11px] font-semibold text-[var(--cb-text-secondary)] bg-[var(--cb-surface-alt)] border-b border-[var(--cb-border)]">
        {title}
      </div>
      <div className="p-2 space-y-1">{children}</div>
    </div>
  );
}

function PropertyRow({ label, value, unit, readOnly, onChange }: {
  label: string;
  value: string;
  unit?: string;
  readOnly?: boolean;
  onChange?: (v: string) => void;
}) {
  return (
    <div className="prop-row">
      <span className="prop-label">{label}</span>
      <div className="prop-value flex items-center gap-1">
        <input
          type="text"
          value={value}
          readOnly={readOnly}
          className={`text-xs mono ${readOnly ? 'bg-transparent border-transparent' : ''}`}
          onChange={e => onChange?.(e.target.value)}
        />
        {unit && <span className="text-[10px] text-[var(--cb-text-muted)]">{unit}</span>}
      </div>
    </div>
  );
}