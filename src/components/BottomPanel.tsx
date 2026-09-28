'use client';
import React from 'react';
import { useProjectStore } from '@/store/project-store';

export default function BottomPanel() {
  const store = useProjectStore();
  const { bottomTab, ercMessages, simResults, currentResultId, bottomPanelVisible } = store;

  if (!bottomPanelVisible) return null;

  const currentResult = simResults.find(r => r.id === currentResultId);

  return (
    <div className="bg-[var(--cb-surface)] border-t border-[var(--cb-border)] flex flex-col" style={{ height: 'var(--cb-panel-height-bottom)' }}>
      {/* Tabs */}
      <div className="flex items-center border-b border-[var(--cb-border)] bg-[var(--cb-surface-alt)] px-2">
        <button
          className={`tab-btn ${bottomTab === 'problems' ? 'active' : ''}`}
          onClick={() => store.setBottomTab('problems')}
        >
          Problems {ercMessages.length > 0 && <span className="badge badge-error ml-1">{ercMessages.length}</span>}
        </button>
        <button
          className={`tab-btn ${bottomTab === 'console' ? 'active' : ''}`}
          onClick={() => store.setBottomTab('console')}
        >
          Console
        </button>
        <button
          className={`tab-btn ${bottomTab === 'results' ? 'active' : ''}`}
          onClick={() => store.setBottomTab('results')}
        >
          Results {simResults.length > 0 && <span className="badge badge-success ml-1">{simResults.length}</span>}
        </button>
        <div className="flex-1" />
        <button className="toolbar-btn text-xs" onClick={() => store.clearERC()}>Clear</button>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Problems Tab */}
        {bottomTab === 'problems' && (
          <div className="p-1">
            {ercMessages.length === 0 ? (
              <div className="text-xs text-[var(--cb-text-muted)] p-3 text-center">
                No problems detected.
              </div>
            ) : (
              <table className="w-full text-xs">
                <tbody>
                  {ercMessages.map(msg => (
                    <tr key={msg.id} className="hover:bg-[var(--cb-surface-alt)]">
                      <td className="px-2 py-1 w-6">
                        {msg.severity === 'error' ? '🔴' : msg.severity === 'warning' ? '🟡' : '🔵'}
                      </td>
                      <td className="py-1">{msg.message}</td>
                      {msg.objectId && (
                        <td className="px-2 py-1 text-[var(--cb-text-muted)] mono text-right">{msg.objectId.slice(0, 8)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Console Tab */}
        {bottomTab === 'console' && (
          <div className="p-2 font-mono text-xs text-[var(--cb-text-secondary)] space-y-0.5">
            <div className="text-[var(--cb-text-muted)]">CircuitBench Console v1.0</div>
            <div className="text-[var(--cb-text-muted)]">Type: {store.simSettings.analysisType}</div>
            {store.simRunning && <div className="text-[var(--cb-accent)]">Simulation running...</div>}
            {currentResult && (
              <div className={currentResult.status === 'success' ? 'text-[var(--cb-success)]' : 'text-[var(--cb-error)]'}>
                Last simulation: {currentResult.status} ({currentResult.traces.length} traces)
              </div>
            )}
          </div>
        )}

        {/* Results Tab */}
        {bottomTab === 'results' && (
          <div className="p-1">
            {simResults.length === 0 ? (
              <div className="text-xs text-[var(--cb-text-muted)] p-3 text-center">
                No simulation results. Run a simulation first.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[var(--cb-text-muted)] text-left">
                    <th className="px-2 py-1 font-medium">Analysis</th>
                    <th className="px-2 py-1 font-medium">Status</th>
                    <th className="px-2 py-1 font-medium">Traces</th>
                    <th className="px-2 py-1 font-medium">Time</th>
                    <th className="px-2 py-1 font-medium">Measurements</th>
                  </tr>
                </thead>
                <tbody>
                  {simResults.map(result => (
                    <tr
                      key={result.id}
                      className={`hover:bg-[var(--cb-surface-alt)] cursor-pointer ${result.id === currentResultId ? 'bg-[var(--cb-accent-light)]' : ''}`}
                      onClick={() => store.setCurrentResult(result.id)}
                    >
                      <td className="px-2 py-1 mono">{result.analysisType}</td>
                      <td className="px-2 py-1">
                        <span className={`badge ${result.status === 'success' ? 'badge-success' : result.status === 'error' ? 'badge-error' : 'badge-warning'}`}>
                          {result.status}
                        </span>
                      </td>
                      <td className="px-2 py-1 mono">{result.traces.length}</td>
                      <td className="px-2 py-1 mono text-[var(--cb-text-muted)]">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-2 py-1 mono">
                        {Object.entries(result.measurements).slice(0, 3).map(([k, v]) => (
                          <span key={k} className="mr-2">{k}={typeof v === 'number' ? v.toPrecision(4) : v}</span>
                        ))}
                        {Object.keys(result.measurements).length > 3 && <span>...</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Error details */}
            {currentResult?.error && (
              <div className="mt-2 p-2 bg-[var(--cb-error-light)] border border-[var(--cb-error)] rounded text-xs text-[var(--cb-error)]">
                <strong>Error:</strong> {currentResult.error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}