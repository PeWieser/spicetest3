// CircuitBench - Persistence Layer (no database)
//
// Storage strategy for a fully static / serverless deployment:
//   - Autosave + crash recovery : localStorage "circuitbench.autosave.v1"
//   - Named projects            : localStorage "circuitbench.project.<id>"
//   - Project index (recents)   : localStorage "circuitbench.projects.v1"
//   - Arbitrary local files     : JSON download / upload via File API
//
// Everything in here is browser-only and guarded against SSR access.

import type { Project } from '@/circuit/types';

const AUTOSAVE_KEY = 'circuitbench.autosave.v1';
const INDEX_KEY = 'circuitbench.projects.v1';
const PROJECT_PREFIX = 'circuitbench.project.';
const SCHEMA_VERSION = 1;

export interface SavedProjectMeta {
  id: string;
  name: string;
  modifiedAt: number;
  sheetCount: number;
  componentCount: number;
  schemaVersion: number;
}

export interface AutosaveEnvelope {
  project: Project;
  savedAt: number;
}

// ─── JSON-safe serialisation ───────────────────────────────────────────
//
// Simulation results contain Float64Array traces. Those do not survive
// JSON.stringify usefully (they turn into {"0":1.2,...}) and they would blow
// up the localStorage quota. We therefore keep only the scalar summary of a
// run inside stored project files.

export function serializeProject(project: Project): Project {
  return {
    ...project,
    savedResults: (project.savedResults || []).map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      analysisType: r.analysisType,
      status: r.status,
      parameters: r.parameters,
      measurements: r.measurements,
      error: r.error,
      traces: [],
    })),
    // nets are derived state - never store them
    nets: [],
    uiState: {
      ...project.uiState,
      zoom: project.uiState.zoom,
      panX: project.uiState.panX,
      panY: project.uiState.panY,
    },
  };
}

export function migrateProject(raw: unknown): Project | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<Project>;
  if (!Array.isArray(p.sheets) || p.sheets.length === 0) return null;

  // Migration hooks for future schema versions live here.
  const migrated: Project = {
    ...(raw as Project),
    schemaVersion: SCHEMA_VERSION,
    nets: [],
    savedResults: (p.savedResults || []).map(r => ({ ...r, traces: r.traces || [] })),
  };
  return migrated;
}

// ─── Low level helpers ─────────────────────────────────────────────────

function canUseBrowserStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

function readJSON<T>(key: string): T | null {
  if (!canUseBrowserStorage()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): boolean {
  if (!canUseBrowserStorage()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn('[CircuitBench] localStorage write failed', err);
    return false;
  }
}

function removeKey(key: string): void {
  if (!canUseBrowserStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// ─── Named projects ────────────────────────────────────────────────────

export function listSavedProjects(): SavedProjectMeta[] {
  const index = readJSON<SavedProjectMeta[]>(INDEX_KEY);
  if (!index) return [];
  return index.sort((a, b) => b.modifiedAt - a.modifiedAt);
}

export function saveProjectToBrowser(project: Project): SavedProjectMeta | null {
  const safe = serializeProject(project);
  const meta: SavedProjectMeta = {
    id: safe.id,
    name: safe.name || 'Untitled Project',
    modifiedAt: Date.now(),
    sheetCount: safe.sheets.length,
    componentCount: safe.sheets.reduce((n, s) => n + s.components.length, 0),
    schemaVersion: safe.schemaVersion,
  };

  const ok = writeJSON(PROJECT_PREFIX + safe.id, { meta, project: safe });
  if (!ok) return null;

  const index = listSavedProjects().filter(m => m.id !== meta.id);
  writeJSON(INDEX_KEY, [meta, ...index].slice(0, 30));
  return meta;
}

export function loadProjectFromBrowser(id: string): Project | null {
  const entry = readJSON<{ meta: SavedProjectMeta; project: Project }>(PROJECT_PREFIX + id);
  if (!entry) return null;
  return migrateProject(entry.project);
}

export function deleteProjectFromBrowser(id: string): void {
  removeKey(PROJECT_PREFIX + id);
  writeJSON(INDEX_KEY, listSavedProjects().filter(m => m.id !== id));
}

// ─── Autosave / crash recovery ─────────────────────────────────────────

export function writeAutosave(project: Project): void {
  writeJSON(AUTOSAVE_KEY, { project: serializeProject(project), savedAt: Date.now() } satisfies AutosaveEnvelope);
}

export function readAutosave(): AutosaveEnvelope | null {
  const env = readJSON<AutosaveEnvelope>(AUTOSAVE_KEY);
  if (!env?.project) return null;
  const migrated = migrateProject(env.project);
  if (!migrated) return null;
  return { project: migrated, savedAt: env.savedAt ?? 0 };
}

export function clearAutosave(): void {
  removeKey(AUTOSAVE_KEY);
}

// Only restore when the snapshot actually contains work, so a reload of a
// pristine "Untitled Project" does not resurrect an old session forever.
export function autosaveHasContent(project: Project): boolean {
  return project.sheets.some(
    s =>
      s.components.length > 0 ||
      s.wires.length > 0 ||
      s.labels.length > 0 ||
      s.probes.length > 0 ||
      s.powerSymbols.length > 0 ||
      s.instruments.length > 0
  );
}

// ─── File helpers ──────────────────────────────────────────────────────

export function downloadTextFile(filename: string, content: string, mime: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFileName(name: string, ext: string): string {
  const base = (name || 'circuit').replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_');
  return base.endsWith(ext) ? base : `${base}${ext}`;
}
