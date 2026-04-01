/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { AppState, ConfigurationState, ResourceInstance, ValidationError, Platform, ConfigMode } from '../types';
import { schemasByName } from '../schemas';

const STORAGE_KEY = 'azure-mc-builder-config';
const MAX_HISTORY = 50;

function getDefaultConfig(): ConfigurationState {
  return {
    configName: 'MyConfiguration',
    platform: 'Windows',
    mode: 'Audit',
    version: '1.0.0',
    description: '',
    resources: [],
  };
}

function extractConfig(state: AppState): ConfigurationState {
  return {
    configName: state.configName,
    platform: state.platform,
    mode: state.mode,
    version: state.version,
    description: state.description,
    resources: state.resources,
  };
}

function loadFromStorage(): ConfigurationState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    // Basic shape check — if corrupted, fall back to defaults
    if (
      typeof parsed !== 'object' || parsed === null ||
      typeof parsed.configName !== 'string' ||
      (parsed.platform !== 'Windows' && parsed.platform !== 'Linux') ||
      (parsed.mode !== 'Audit' && parsed.mode !== 'AuditAndSet') ||
      !Array.isArray(parsed.resources)
    ) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function saveToStorage(config: ConfigurationState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch { /* ignore */ }
}

/** Check for circular dependencies using DFS */
function hasCycle(resources: ResourceInstance[]): boolean {
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(id: string): boolean {
    if (inStack.has(id)) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    inStack.add(id);

    const resource = resources.find(r => r.id === id);
    if (resource) {
      for (const depId of resource.dependsOn) {
        if (dfs(depId)) return true;
      }
    }

    inStack.delete(id);
    return false;
  }

  for (const r of resources) {
    if (dfs(r.id)) return true;
  }
  return false;
}

const initial = loadFromStorage() || getDefaultConfig();

export const useConfigStore = create<AppState>((set, get) => ({
  ...initial,
  selectedResourceId: null,
  past: [],
  future: [],

  // Helper to push state to history before mutation
  _pushHistory: () => {
    const state = get();
    const snapshot = extractConfig(state);
    set(s => ({
      past: [...s.past.slice(-(MAX_HISTORY - 1)), snapshot],
      future: [],
    }));
  },

  setConfigName: (name: string) => {
    (get() as any)._pushHistory();
    set({ configName: name });
    saveToStorage(extractConfig(get()));
  },

  setPlatform: (platform: Platform) => {
    (get() as any)._pushHistory();
    // Remove resources that don't match the new platform
    const resources = get().resources.filter(r => {
      const schema = schemasByName[r.schemaName];
      return schema && schema.platform === platform;
    });
    set({ platform, resources, selectedResourceId: null });
    saveToStorage(extractConfig(get()));
  },

  setMode: (mode: ConfigMode) => {
    (get() as any)._pushHistory();
    set({ mode });
    saveToStorage(extractConfig(get()));
  },

  setVersion: (version: string) => {
    (get() as any)._pushHistory();
    set({ version });
    saveToStorage(extractConfig(get()));
  },

  setDescription: (desc: string) => {
    (get() as any)._pushHistory();
    set({ description: desc });
    saveToStorage(extractConfig(get()));
  },

  addResource: (schemaName: string, instanceName: string) => {
    (get() as any)._pushHistory();
    const schema = schemasByName[schemaName];
    if (!schema) return;

    // Initialize with default values
    const properties: Record<string, unknown> = {};
    for (const prop of schema.properties) {
      if (prop.defaultValue !== undefined) {
        properties[prop.name] = prop.defaultValue;
      }
    }

    const resource: ResourceInstance = {
      id: uuidv4(),
      schemaName,
      instanceName,
      properties,
      dependsOn: [],
    };

    set(s => ({ resources: [...s.resources, resource] }));
    saveToStorage(extractConfig(get()));
  },

  removeResource: (id: string) => {
    (get() as any)._pushHistory();
    set(s => ({
      resources: s.resources
        .filter(r => r.id !== id)
        .map(r => ({
          ...r,
          dependsOn: r.dependsOn.filter(depId => depId !== id),
        })),
      selectedResourceId: s.selectedResourceId === id ? null : s.selectedResourceId,
    }));
    saveToStorage(extractConfig(get()));
  },

  updateResourceProperty: (id: string, property: string, value: unknown) => {
    (get() as any)._pushHistory();
    set(s => ({
      resources: s.resources.map(r =>
        r.id === id ? { ...r, properties: { ...r.properties, [property]: value } } : r
      ),
    }));
    saveToStorage(extractConfig(get()));
  },

  updateResourceInstanceName: (id: string, name: string) => {
    (get() as any)._pushHistory();
    set(s => ({
      resources: s.resources.map(r =>
        r.id === id ? { ...r, instanceName: name } : r
      ),
    }));
    saveToStorage(extractConfig(get()));
  },

  updateResourceDependsOn: (id: string, deps: string[]) => {
    (get() as any)._pushHistory();
    set(s => ({
      resources: s.resources.map(r =>
        r.id === id ? { ...r, dependsOn: deps } : r
      ),
    }));
    saveToStorage(extractConfig(get()));
  },

  reorderResource: (fromIndex: number, toIndex: number) => {
    (get() as any)._pushHistory();
    set(s => {
      const resources = [...s.resources];
      const [moved] = resources.splice(fromIndex, 1);
      resources.splice(toIndex, 0, moved);
      return { resources };
    });
    saveToStorage(extractConfig(get()));
  },

  selectResource: (id: string | null) => {
    set({ selectedResourceId: id });
  },

  cloneResource: (id: string) => {
    (get() as any)._pushHistory();
    const resource = get().resources.find(r => r.id === id);
    if (!resource) return;

    const clone: ResourceInstance = {
      id: uuidv4(),
      schemaName: resource.schemaName,
      instanceName: `${resource.instanceName}_Copy`,
      properties: { ...resource.properties },
      dependsOn: [...resource.dependsOn],
    };

    set(s => {
      const index = s.resources.findIndex(r => r.id === id);
      const resources = [...s.resources];
      resources.splice(index + 1, 0, clone);
      return { resources };
    });
    saveToStorage(extractConfig(get()));
  },

  resetConfig: () => {
    (get() as any)._pushHistory();
    const fresh = getDefaultConfig();
    set({ ...fresh, selectedResourceId: null });
    saveToStorage(fresh);
  },

  loadTemplate: (state: ConfigurationState) => {
    (get() as any)._pushHistory();
    set({
      ...state,
      selectedResourceId: null,
    });
    saveToStorage(state);
  },

  undo: () => {
    const { past } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const current = extractConfig(get());
    set({
      ...previous,
      past: past.slice(0, -1),
      future: [current, ...get().future].slice(0, MAX_HISTORY),
      selectedResourceId: null,
    });
    saveToStorage(previous);
  },

  redo: () => {
    const { future } = get();
    if (future.length === 0) return;
    const next = future[0];
    const current = extractConfig(get());
    set({
      ...next,
      past: [...get().past, current].slice(-MAX_HISTORY),
      future: future.slice(1),
      selectedResourceId: null,
    });
    saveToStorage(next);
  },

  exportJSON: () => {
    return JSON.stringify(extractConfig(get()), null, 2);
  },

  importJSON: (json: string) => {
    try {
      const raw = JSON.parse(json);

      // Schema validation: ensure imported data matches ConfigurationState shape
      if (typeof raw !== 'object' || raw === null) throw new Error('Root must be an object');
      if (typeof raw.configName !== 'string') throw new Error('Missing or invalid configName');
      if (raw.platform !== 'Windows' && raw.platform !== 'Linux') throw new Error('platform must be "Windows" or "Linux"');
      if (raw.mode !== 'Audit' && raw.mode !== 'AuditAndSet') throw new Error('mode must be "Audit" or "AuditAndSet"');
      if (typeof raw.version !== 'string') throw new Error('Missing or invalid version');
      if (typeof raw.description !== 'string' && raw.description !== undefined) throw new Error('description must be a string');
      if (!Array.isArray(raw.resources)) throw new Error('resources must be an array');

      // Validate each resource
      for (let i = 0; i < raw.resources.length; i++) {
        const r = raw.resources[i];
        if (typeof r !== 'object' || r === null) throw new Error(`resources[${i}] must be an object`);
        if (typeof r.id !== 'string') throw new Error(`resources[${i}].id must be a string`);
        if (typeof r.schemaName !== 'string') throw new Error(`resources[${i}].schemaName must be a string`);
        if (typeof r.instanceName !== 'string') throw new Error(`resources[${i}].instanceName must be a string`);
        if (typeof r.properties !== 'object' || r.properties === null) throw new Error(`resources[${i}].properties must be an object`);
        if (!Array.isArray(r.dependsOn)) throw new Error(`resources[${i}].dependsOn must be an array`);
      }

      const config: ConfigurationState = {
        configName: String(raw.configName),
        platform: raw.platform,
        mode: raw.mode,
        version: String(raw.version),
        description: raw.description ? String(raw.description) : '',
        resources: raw.resources.map((r: Record<string, unknown>) => ({
          id: String(r.id),
          schemaName: String(r.schemaName),
          instanceName: String(r.instanceName),
          properties: r.properties as Record<string, unknown>,
          dependsOn: (r.dependsOn as unknown[]).map(String),
        })),
      };

      (get() as any)._pushHistory();
      set({ ...config, selectedResourceId: null });
      saveToStorage(config);
    } catch (e) {
      throw new Error(`Invalid configuration file: ${e instanceof Error ? e.message : e}`);
    }
  },

  validate: (): ValidationError[] => {
    const state = get();
    const errors: ValidationError[] = [];

    // Config name validation
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(state.configName)) {
      errors.push({
        level: 'error',
        message: 'Configuration name must be a valid identifier (letters, numbers, underscores; cannot start with a number)',
      });
    }

    // "No resources" is handled by the empty-state UI, not the validation bar

    // Resource count warnings
    if (state.resources.length > 40) {
      errors.push({ level: 'error', message: `${state.resources.length} resources — likely to exceed MC agent's 5-minute evaluation timeout. Split into multiple packages.` });
    } else if (state.resources.length > 30) {
      errors.push({ level: 'warning', message: `${state.resources.length} resources — approaching MC agent's evaluation timeout limit` });
    }

    // Per-resource validation
    const instanceNames = new Set<string>();
    for (const resource of state.resources) {
      const schema = schemasByName[resource.schemaName];
      if (!schema) continue;

      // Platform consistency
      if (schema.platform !== state.platform) {
        errors.push({
          level: 'error',
          resourceId: resource.id,
          message: `[${resource.instanceName}] ${schema.resourceName} is a ${schema.platform} resource but platform is set to ${state.platform}`,
        });
      }

      // Unique instance names
      if (instanceNames.has(resource.instanceName)) {
        errors.push({
          level: 'error',
          resourceId: resource.id,
          message: `Duplicate instance name: ${resource.instanceName}`,
        });
      }
      instanceNames.add(resource.instanceName);

      // Required properties
      for (const prop of schema.properties) {
        if (prop.required) {
          const val = resource.properties[prop.name];
          if (val === undefined || val === null || val === '') {
            errors.push({
              level: 'error',
              resourceId: resource.id,
              field: prop.name,
              message: `[${resource.instanceName}] Required property "${prop.name}" is empty`,
            });
          }
        }

        // Enum validation
        if (prop.enumValues) {
          const val = resource.properties[prop.name];
          if (val !== undefined && val !== null && val !== '') {
            if (prop.type === 'string[]') {
              const arr = Array.isArray(val) ? val : [val];
              for (const item of arr) {
                if (!prop.enumValues.includes(String(item))) {
                  errors.push({
                    level: 'error',
                    resourceId: resource.id,
                    field: prop.name,
                    message: `[${resource.instanceName}] "${prop.name}" value "${item}" is not valid. Allowed: ${prop.enumValues.join(', ')}`,
                  });
                }
              }
            } else if (!prop.enumValues.includes(String(val))) {
              errors.push({
                level: 'error',
                resourceId: resource.id,
                field: prop.name,
                message: `[${resource.instanceName}] "${prop.name}" value "${val}" is not valid. Allowed: ${prop.enumValues.join(', ')}`,
              });
            }
          }
        }
      }

      // Pattern validation
      for (const prop of schema.properties) {
        if (prop.validationPattern) {
          const val = resource.properties[prop.name];
          if (val !== undefined && val !== null && val !== '') {
            const re = new RegExp(prop.validationPattern);
            if (!re.test(String(val))) {
              errors.push({
                level: 'error',
                resourceId: resource.id,
                field: prop.name,
                message: `[${resource.instanceName}] ${prop.validationMessage || `"${prop.name}" has invalid format`}`,
              });
            }
          }
        }
      }

      // Platform-specific hints (shown as info icon on the resource, not as validation warnings)
      // nxPackage: dpkg-based — noted in the schema description instead

      // nxFile: Mode is technically optional in schema but the nxtools DSC resource
      // throws "Cannot bind argument to parameter 'Mode' because it is null" when
      // creating files without it. Warn if Mode is empty for nxFile with Ensure=Present.
      if (resource.schemaName === 'nxFile') {
        const ensure = resource.properties['Ensure'] ?? 'Present';
        const mode = resource.properties['Mode'];
        if (ensure === 'Present' && (!mode || mode === '')) {
          errors.push({
            level: 'warning',
            resourceId: resource.id,
            field: 'Mode',
            message: `[${resource.instanceName}] nxFile Mode should be set (e.g. "0644") — the nxtools agent will fail at runtime without it`,
          });
        }
      }
    }

    // Circular dependency check
    if (hasCycle(state.resources)) {
      errors.push({ level: 'error', message: 'Circular dependency detected in DependsOn chain' });
    }

    return errors;
  },

  getSnapshot: () => extractConfig(get()),
}));
