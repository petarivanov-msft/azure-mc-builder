import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { AppState, ConfigurationState, ResourceInstance, ValidationError, Platform, ConfigMode } from '../types';
import { schemasByName } from '../schemas';
import { getPropertyValue, IDENTIFIER_PATTERN, isMissingProperty, parseConfiguration, VERSION_PATTERN, withResourceDefaults } from '../utils/configuration';

const STORAGE_KEY = 'azure-mc-builder-config';
const MAX_HISTORY = 50;
const EDIT_GROUP_MS = 750;

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
  if (typeof localStorage === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return parseConfiguration(stored);
  } catch (error) {
    console.warn('Could not restore saved configuration:', error);
    return null;
  }
}

function saveToStorage(config: ConfigurationState) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.warn('Could not save configuration:', error);
  }
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

export const useConfigStore = create<AppState>((set, get) => {
  let lastEdit: { key: string; at: number } | null = null;
  const finishEditing = () => { lastEdit = null; };
  const pushHistory = (editKey?: string) => {
    const now = Date.now();
    const state = get();
    const coalesce = editKey !== undefined && lastEdit?.key === editKey &&
      now - lastEdit.at < EDIT_GROUP_MS && state.future.length === 0;
    lastEdit = editKey === undefined ? null : { key: editKey, at: now };
    if (coalesce) return;
    set({
      past: [...state.past.slice(-(MAX_HISTORY - 1)), extractConfig(state)],
      future: [],
    });
  };

  return {
  ...initial,
  selectedResourceId: null,
  past: [],
  future: [],

  finishEditing,

  setConfigName: (name: string) => {
    if (name === get().configName) return;
    pushHistory('configName');
    set({ configName: name });
    saveToStorage(extractConfig(get()));
  },

  setPlatform: (platform: Platform) => {
    if (platform === get().platform) return;
    pushHistory();
    // Remove resources that don't match the new platform
    const resources = get().resources.filter(r => {
      const schema = schemasByName[r.schemaName];
      return schema && schema.platform === platform;
    });
    set({ platform, resources, selectedResourceId: null });
    saveToStorage(extractConfig(get()));
  },

  setMode: (mode: ConfigMode) => {
    if (mode === get().mode) return;
    pushHistory();
    set({ mode });
    saveToStorage(extractConfig(get()));
  },

  setVersion: (version: string) => {
    if (version === get().version) return;
    pushHistory('version');
    set({ version });
    saveToStorage(extractConfig(get()));
  },

  setDescription: (desc: string) => {
    if (desc === get().description) return;
    pushHistory('description');
    set({ description: desc });
    saveToStorage(extractConfig(get()));
  },

  addResource: (schemaName: string, instanceName: string) => {
    const schema = schemasByName[schemaName];
    if (!schema) return;
    pushHistory();

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
    pushHistory();
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
    pushHistory(typeof value === 'boolean' ? undefined : `property:${id}:${property}`);
    set(s => ({
      resources: s.resources.map(r =>
        r.id === id ? { ...r, properties: { ...r.properties, [property]: value } } : r
      ),
    }));
    saveToStorage(extractConfig(get()));
  },

  updateResourceInstanceName: (id: string, name: string) => {
    pushHistory(`instanceName:${id}`);
    set(s => ({
      resources: s.resources.map(r =>
        r.id === id ? { ...r, instanceName: name } : r
      ),
    }));
    saveToStorage(extractConfig(get()));
  },

  updateResourceDependsOn: (id: string, deps: string[]) => {
    pushHistory();
    set(s => ({
      resources: s.resources.map(r =>
        r.id === id ? { ...r, dependsOn: deps } : r
      ),
    }));
    saveToStorage(extractConfig(get()));
  },

  reorderResource: (fromIndex: number, toIndex: number) => {
    pushHistory();
    set(s => {
      const resources = [...s.resources];
      const [moved] = resources.splice(fromIndex, 1);
      resources.splice(toIndex, 0, moved);
      return { resources };
    });
    saveToStorage(extractConfig(get()));
  },

  selectResource: (id: string | null) => {
    finishEditing();
    set({ selectedResourceId: id });
  },

  cloneResource: (id: string) => {
    pushHistory();
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
    pushHistory();
    const fresh = getDefaultConfig();
    set({ ...fresh, selectedResourceId: null });
    saveToStorage(fresh);
  },

  loadTemplate: (state: ConfigurationState) => {
    pushHistory();
    const config = { ...state, resources: state.resources.map(withResourceDefaults) };
    set({
      ...config,
      selectedResourceId: null,
    });
    saveToStorage(config);
  },

  undo: () => {
    finishEditing();
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
    finishEditing();
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
      const config = parseConfiguration(json);
      pushHistory();
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
    if (!IDENTIFIER_PATTERN.test(state.configName)) {
      errors.push({
        level: 'error',
        message: 'Configuration name must be a valid identifier (letters, numbers, underscores; cannot start with a number)',
      });
    }
    if (!VERSION_PATTERN.test(state.version)) {
      errors.push({ level: 'error', message: 'Version must have the format major.minor.patch (e.g. 1.0.0)' });
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
      if (!schema) {
        errors.push({
          level: 'error',
          resourceId: resource.id,
          message: `[${resource.instanceName}] Unknown resource type "${resource.schemaName}". Remove or re-add this resource.`,
        });
        continue;
      }

      // Platform consistency
      if (schema.platform !== state.platform) {
        errors.push({
          level: 'error',
          resourceId: resource.id,
          message: `[${resource.instanceName}] ${schema.resourceName} is a ${schema.platform} resource but platform is set to ${state.platform}`,
        });
      }

      // Unique + valid instance names
      if (!IDENTIFIER_PATTERN.test(resource.instanceName)) {
        errors.push({
          level: 'error',
          resourceId: resource.id,
          message: `Invalid instance name: ${resource.instanceName}. Use letters, numbers, underscores; cannot start with a number.`,
        });
      }
      if (instanceNames.has(resource.instanceName)) {
        errors.push({
          level: 'error',
          resourceId: resource.id,
          message: `Duplicate instance name: ${resource.instanceName}`,
        });
      }
      instanceNames.add(resource.instanceName);

      // Required + key properties
      for (const prop of schema.properties) {
        if (prop.required || prop.isKey) {
          const val = getPropertyValue(resource, prop);
          if (isMissingProperty(val, prop)) {
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
          const val = getPropertyValue(resource, prop);
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
          const val = getPropertyValue(resource, prop);
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
  };
});
