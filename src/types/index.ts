export type Platform = 'Windows' | 'Linux';
export type ConfigMode = 'Audit' | 'AuditAndSet';

export interface PropertySchema {
  name: string;
  displayName?: string;
  description: string;
  type: 'string' | 'string[]' | 'boolean' | 'integer';
  required: boolean;
  isKey: boolean;
  enumValues?: string[];
  defaultValue?: unknown;
  placeholder?: string;
  validationPattern?: string;
  validationMessage?: string;
}

export interface ResourceSchema {
  resourceName: string;
  moduleName: string;
  moduleVersion: string;
  mofClassName: string;
  dscV3TypeName: string;
  platform: Platform;
  description: string;
  category: string;
  docUrl?: string;
  properties: PropertySchema[];
}

export interface ResourceInstance {
  id: string;
  schemaName: string;
  instanceName: string;
  properties: Record<string, unknown>;
  dependsOn: string[]; // IDs of other ResourceInstances
}

export interface ConfigurationState {
  configName: string;
  platform: Platform;
  mode: ConfigMode;
  version: string;
  description: string;
  resources: ResourceInstance[];
}

export interface ValidationError {
  level: 'error' | 'warning';
  resourceId?: string;
  field?: string;
  message: string;
}

export interface AppState extends ConfigurationState {
  // Selection
  selectedResourceId: string | null;

  // History for undo/redo
  past: ConfigurationState[];
  future: ConfigurationState[];

  // Actions
  setConfigName: (name: string) => void;
  setPlatform: (platform: Platform) => void;
  setMode: (mode: ConfigMode) => void;
  setVersion: (version: string) => void;
  setDescription: (desc: string) => void;
  addResource: (schemaName: string, instanceName: string) => void;
  removeResource: (id: string) => void;
  updateResourceProperty: (id: string, property: string, value: unknown) => void;
  updateResourceInstanceName: (id: string, name: string) => void;
  updateResourceDependsOn: (id: string, deps: string[]) => void;
  reorderResource: (fromIndex: number, toIndex: number) => void;
  selectResource: (id: string | null) => void;
  cloneResource: (id: string) => void;
  resetConfig: () => void;
  loadTemplate: (state: ConfigurationState) => void;
  undo: () => void;
  redo: () => void;
  exportJSON: () => string;
  importJSON: (json: string) => void;
  validate: () => ValidationError[];
  getSnapshot: () => ConfigurationState;
}
