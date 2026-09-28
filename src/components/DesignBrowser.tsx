'use client';
import React, { useState } from 'react';
import { useProjectStore } from '@/store/project-store';
import { COMPONENT_MAP, COMPONENT_CATEGORIES, getComponentsBySubcategory, searchComponents } from '@/circuit/library';
import type { SymbolDef } from '@/circuit/types';

type BrowserTab = 'components' | 'hierarchy' | 'nets' | 'probes' | 'instruments';

export default function DesignBrowser() {
  const store = useProjectStore();
  const [activeTab, setActiveTab] = useState<BrowserTab>('components');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(['Basic', 'Sources']));
  const sheet = store.getCurrentSheet();

  const tabs: { id: BrowserTab; label: string }[] = [
    { id: 'components', label: 'Components' },
    { id: 'hierarchy', label: 'Hierarchy' },
    { id: 'nets', label: 'Nets' },
    { id: 'probes', label: 'Probes' },
    { id: 'instruments', label: 'Instruments' },
  ];

  const toggleCat = (cat: string) => {
    const next = new Set(expandedCats);
    next.has(cat) ? next.delete(cat) : next.add(cat);
    setExpandedCats(next);
  };

  const filteredComponents = searchQuery
    ? searchComponents(searchQuery)
    : COMPONENT_CATEGORIES.flatMap(cat =>
        expandedCats.has(cat.name)
          ? cat.subcategories.flatMap(sub => getComponentsBySubcategory(cat.name, sub))
          : []
      );

  const handleComponentSelect = (symId: string) => {
    store.setPlacementSymbolId(symId);
    store.setToolMode('component');
  };

  const nets = store.project.nets || [];

  return (
    <div className="flex flex-col h-full bg-[var(--cb-surface)] border-r border-[var(--cb-border)]" style={{ width: 'var(--cb-panel-width-left)' }}>
      {/* Tabs */}
      <div className="flex border-b border-[var(--cb-border)] bg-[var(--cb-surface-alt)] overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn whitespace-nowrap ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Components Tab */}
        {activeTab === 'components' && (
          <div className="p-2">
            <input
              type="text"
              placeholder="Search components..."
              className="w-full mb-2 text-xs"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            
            {searchQuery ? (
              <div className="space-y-0.5">
                {filteredComponents.map(sym => (
                  <ComponentListItem key={sym.id} sym={sym} onSelect={() => handleComponentSelect(sym.id)} />
                ))}
                {filteredComponents.length === 0 && (
                  <div className="text-xs text-[var(--cb-text-muted)] p-2">No components found</div>
                )}
              </div>
            ) : (
              COMPONENT_CATEGORIES.map(cat => (
                <div key={cat.name} className="mb-1">
                  <button
                    className="flex items-center w-full px-1 py-1 text-xs font-semibold text-[var(--cb-text-secondary)] hover:bg-[var(--cb-border)] rounded"
                    onClick={() => toggleCat(cat.name)}
                  >
                    <span className="mr-1 text-[10px]">{expandedCats.has(cat.name) ? '▼' : '▶'}</span>
                    {cat.name}
                  </button>
                  {expandedCats.has(cat.name) && cat.subcategories.map(sub => (
                    <div key={sub}>
                      <div className="pl-4 text-[10px] text-[var(--cb-text-muted)] font-medium mt-1 mb-0.5">{sub}</div>
                      {getComponentsBySubcategory(cat.name, sub).map(sym => (
                        <ComponentListItem key={sym.id} sym={sym} onSelect={() => handleComponentSelect(sym.id)} />
                      ))}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {/* Hierarchy Tab */}
        {activeTab === 'hierarchy' && (
          <div className="p-2">
            <div className="text-xs font-semibold text-[var(--cb-text-secondary)] mb-2">Sheets</div>
            {store.project.sheets.map(s => (
              <div
                key={s.id}
                className={`comp-item text-xs ${s.id === store.currentSheetId ? 'selected' : ''}`}
                onClick={() => { store.setCurrentSheet(s.id); }}
              >
                <span className="text-[var(--cb-text-muted)]">📄</span>
                <span>{s.name}</span>
                <span className="ml-auto text-[var(--cb-text-muted)] text-[10px]">
                  {s.components.length}C {s.wires.length}W
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Nets Tab */}
        {activeTab === 'nets' && (
          <div className="p-2">
            <div className="text-xs font-semibold text-[var(--cb-text-secondary)] mb-2">
              Nets ({nets.length})
            </div>
            {nets.length === 0 ? (
              <div className="text-xs text-[var(--cb-text-muted)] p-2">
                No nets resolved. Run simulation or ERC to resolve nets.
              </div>
            ) : (
              nets.map(net => (
                <div key={net.id} className="comp-item text-xs">
                  <span className={`w-2 h-2 rounded-full ${
                    net.type === 'ground' ? 'bg-green-500' :
                    net.type === 'power' ? 'bg-red-500' :
                    'bg-blue-500'
                  }`} />
                  <span className="mono">{net.name}</span>
                  <span className="ml-auto text-[var(--cb-text-muted)] text-[10px]">
                    {net.pinRefs.length} pins
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Probes Tab */}
        {activeTab === 'probes' && (
          <div className="p-2">
            <div className="text-xs font-semibold text-[var(--cb-text-secondary)] mb-2">
              Probes ({sheet.probes.length})
            </div>
            {sheet.probes.length === 0 ? (
              <div className="text-xs text-[var(--cb-text-muted)] p-2">
                No probes placed. Use Place → Probe or toolbar.
              </div>
            ) : (
              sheet.probes.map(probe => (
                <div key={probe.id} className="comp-item text-xs">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: probe.color }} />
                  <span>{probe.name}</span>
                  <span className="ml-auto text-[var(--cb-text-muted)] text-[10px]">{probe.type}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Instruments Tab */}
        {activeTab === 'instruments' && (
          <div className="p-2">
            <div className="text-xs font-semibold text-[var(--cb-text-secondary)] mb-2">
              Instruments ({sheet.instruments.length})
            </div>
            {sheet.instruments.length === 0 ? (
              <div className="text-xs text-[var(--cb-text-muted)] p-2">
                No instruments placed.
              </div>
            ) : (
              sheet.instruments.map(inst => (
                <div key={inst.id} className="comp-item text-xs">
                  <span>🔧</span>
                  <span>{inst.name}</span>
                  <span className="ml-auto text-[var(--cb-text-muted)] text-[10px]">{inst.type}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ComponentListItem({ sym, onSelect }: { sym: SymbolDef; onSelect: () => void }) {
  return (
    <div className="comp-item text-xs pl-2" onClick={onSelect} title={sym.description}>
      <span className="mono text-[var(--cb-accent)] font-medium">{sym.referencePrefix || '·'}</span>
      <span className="truncate">{sym.name}</span>
    </div>
  );
}