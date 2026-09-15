import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConfigStore } from '../configStore';
import { generatePs1 } from '../../generators/ps1Generator';
import { parseConfiguration } from '../../utils/configuration';
import type { ConfigurationState } from '../../types';

const storageKey = 'azure-mc-builder-config';
const config: ConfigurationState = {
  configName: 'StoreTest', platform: 'Windows', mode: 'Audit', version: '1.0.0',
  description: '', resources: [],
};

beforeEach(() => {
  vi.useFakeTimers();
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  });
  useConfigStore.setState({ ...config, past: [], future: [], selectedResourceId: null });
  useConfigStore.getState().finishEditing();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('coalesced, typed history', () => {
  it('undoes 80 keystrokes in one step while persisting every edit', () => {
    for (let i = 1; i <= 80; i++) {
      useConfigStore.getState().setDescription('x'.repeat(i));
      vi.advanceTimersByTime(50);
    }
    expect(useConfigStore.getState().past).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(storageKey)!).description).toHaveLength(80);
    useConfigStore.getState().undo();
    expect(useConfigStore.getState().description).toBe('');
    useConfigStore.getState().redo();
    expect(useConfigStore.getState().description).toHaveLength(80);
  });

  it('separates different fields, pauses and focus boundaries', () => {
    const store = useConfigStore.getState();
    store.setConfigName('Name1');
    store.setDescription('first');
    vi.advanceTimersByTime(751);
    store.setDescription('second');
    store.finishEditing();
    store.setDescription('third');
    expect(useConfigStore.getState().past).toHaveLength(4);
    store.undo();
    expect(useConfigStore.getState().description).toBe('second');
  });

  it('invalidates redo on editing after undo', () => {
    const store = useConfigStore.getState();
    store.setDescription('old');
    store.undo();
    store.setDescription('new');
    expect(useConfigStore.getState().future).toHaveLength(0);
    store.undo();
    expect(useConfigStore.getState().description).toBe('');
  });

  it('coalesces resource text but keeps checkboxes and dependency changes separate', () => {
    const store = useConfigStore.getState();
    store.addResource('Registry', 'R1');
    const id = useConfigStore.getState().resources[0].id;
    store.updateResourceProperty(id, 'ValueName', 'a');
    store.updateResourceProperty(id, 'ValueName', 'ab');
    store.updateResourceProperty(id, 'Force', true);
    store.updateResourceProperty(id, 'Force', false);
    expect(useConfigStore.getState().past).toHaveLength(4);
    store.undo();
    expect(useConfigStore.getState().resources[0].properties.Force).toBe(true);
    store.undo();
    store.undo();
    expect(useConfigStore.getState().resources[0].properties.ValueName).toBeUndefined();
  });

  it('bounds distinct actions to 50 and ignores unchanged scalar values', () => {
    const store = useConfigStore.getState();
    store.setConfigName(config.configName);
    expect(useConfigStore.getState().past).toHaveLength(0);
    for (let i = 0; i < 60; i++) {
      store.finishEditing();
      store.setDescription(String(i));
    }
    expect(useConfigStore.getState().past).toHaveLength(50);
    expect(store).not.toHaveProperty('_pushHistory');
  });
});

describe('import, defaults and validation', () => {
  it('normalizes missing defaults on import and round-trips persisted state', () => {
    useConfigStore.getState().importJSON(JSON.stringify({ ...config, resources: [{
      id: '1', schemaName: 'TimeZone', instanceName: 'TZ', properties: { TimeZone: 'UTC' }, dependsOn: [],
    }] }));
    const state = useConfigStore.getState();
    expect(state.resources[0].properties.IsSingleInstance).toBe('Yes');
    expect(state.validate()).toEqual([]);
    expect(generatePs1(state.getSnapshot())).toContain("IsSingleInstance = 'Yes'");
    expect(parseConfiguration(localStorage.getItem(storageKey)!)).toEqual(state.getSnapshot());
  });

  it('allows explicitly empty Registry default-value names but not missing names', () => {
    const state = useConfigStore.getState();
    state.addResource('Registry', 'DefaultValue');
    const id = useConfigStore.getState().resources[0].id;
    state.updateResourceProperty(id, 'Key', 'HKLM:\\SOFTWARE\\Test');
    state.updateResourceProperty(id, 'ValueName', '');
    expect(state.validate()).toEqual([]);
    state.updateResourceProperty(id, 'ValueName', undefined);
    expect(state.validate().some(e => e.field === 'ValueName')).toBe(true);
  });

  it('reports invalid package versions before download', () => {
    useConfigStore.getState().setVersion('2.x');
    expect(useConfigStore.getState().validate().some(e => e.message.includes('Version'))).toBe(true);
  });

  it.each([
    { id: '1', schemaName: 'Service', instanceName: 'Svc', properties: [], dependsOn: [] },
    { id: '1', schemaName: 'toString', instanceName: 'Svc', properties: {}, dependsOn: [] },
    { id: '1', schemaName: 'Service', instanceName: 'Svc', properties: {}, dependsOn: [{}] },
  ])('rejects malformed imported resources without changing state', resource => {
    const before = useConfigStore.getState().getSnapshot();
    expect(() => useConfigStore.getState().importJSON(JSON.stringify({ ...config, resources: [resource] }))).toThrow();
    expect(useConfigStore.getState().getSnapshot()).toEqual(before);
    expect(useConfigStore.getState().past).toHaveLength(0);
  });
});
