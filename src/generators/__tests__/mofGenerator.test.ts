import { describe, it, expect } from 'vitest';
import { escapeMofString, formatMofValue, generateMofContent, generateMofFile } from '../mofGenerator';
import { ConfigurationState } from '../../types';

describe('escapeMofString', () => {
  it('escapes backslashes', () => {
    expect(escapeMofString('HKLM:\\SOFTWARE\\Test')).toBe('HKLM:\\\\SOFTWARE\\\\Test');
  });
  it('escapes double quotes', () => {
    expect(escapeMofString('say "hello"')).toBe('say \\"hello\\"');
  });
  it('escapes newlines', () => {
    expect(escapeMofString('line1\nline2')).toBe('line1\\nline2');
  });
  it('handles combined escaping', () => {
    expect(escapeMofString('path\\to\n"file"')).toBe('path\\\\to\\n\\"file\\"');
  });
});

describe('formatMofValue', () => {
  it('formats strings with quotes', () => {
    expect(formatMofValue('Running', 'string')).toBe('"Running"');
  });
  it('formats booleans as True/False', () => {
    expect(formatMofValue(true, 'boolean')).toBe('True');
    expect(formatMofValue(false, 'boolean')).toBe('False');
  });
  it('formats integers as bare numbers', () => {
    expect(formatMofValue(30000, 'integer')).toBe('30000');
  });
  it('formats string arrays with curly braces', () => {
    expect(formatMofValue(['host1', 'host2'], 'string[]')).toBe('{"host1", "host2"}');
  });
  it('formats single-value string array (like Dword ValueData)', () => {
    expect(formatMofValue(['0'], 'string[]')).toBe('{"0"}');
  });
  it('escapes strings inside arrays', () => {
    expect(formatMofValue(['HKLM:\\Test'], 'string[]')).toBe('{"HKLM:\\\\Test"}');
  });
});

describe('generateMofContent', () => {
  const makeConfig = (overrides?: Partial<ConfigurationState>): ConfigurationState => ({
    configName: 'TestConfig',
    platform: 'Windows',
    mode: 'Audit',
    version: '1.0.0',
    description: 'Test',
    resources: [],
    ...overrides,
  });

  it('generates header with config name', () => {
    const mof = generateMofContent(makeConfig());
    expect(mof).toContain('@GeneratedBy=TestConfig');
    expect(mof).toContain('@GenerationHost=AzureMCBuilder');
  });

  it('puts OMI_ConfigurationDocument at the end', () => {
    const mof = generateMofContent(makeConfig({
      resources: [{
        id: '1', schemaName: 'Service', instanceName: 'W32Time',
        properties: { Name: 'W32Time', State: 'Running' }, dependsOn: [],
      }],
    }));
    const omiPos = mof.indexOf('instance of OMI_ConfigurationDocument');
    const resourcePos = mof.indexOf('instance of MSFT_ServiceResource');
    expect(omiPos).toBeGreaterThan(resourcePos);
  });

  it('includes ResourceID, SourceInfo, ModuleName, ModuleVersion, ConfigurationName', () => {
    const mof = generateMofContent(makeConfig({
      resources: [{
        id: '1', schemaName: 'Service', instanceName: 'W32Time',
        properties: { Name: 'W32Time' }, dependsOn: [],
      }],
    }));
    expect(mof).toContain('ResourceID = "[Service]W32Time"');
    expect(mof).toContain('SourceInfo = "TestConfig::Service::W32Time"');
    expect(mof).toContain('ModuleName = "PSDscResources"');
    expect(mof).toContain('ModuleVersion = "2.12.0.0"');
    expect(mof).toContain('ConfigurationName = "TestConfig"');
  });

  it('formats DependsOn correctly', () => {
    const mof = generateMofContent(makeConfig({
      resources: [
        { id: 'svc1', schemaName: 'Service', instanceName: 'W32Time', properties: { Name: 'W32Time' }, dependsOn: [] },
        { id: 'reg1', schemaName: 'Registry', instanceName: 'TestReg', properties: { Key: 'HKLM:\\Test', ValueName: 'Val' }, dependsOn: ['svc1'] },
      ],
    }));
    expect(mof).toContain('DependsOn = {"[Service]W32Time"}');
  });

  it('uses correct class names for Linux resources (no MSFT_ prefix)', () => {
    const mof = generateMofContent(makeConfig({
      platform: 'Linux',
      resources: [{
        id: '1', schemaName: 'nxService', instanceName: 'SSHD',
        properties: { Name: 'sshd' }, dependsOn: [],
      }],
    }));
    expect(mof).toContain('instance of nxService as $nxService1ref');
    expect(mof).not.toContain('MSFT_');
  });

  it('formats boolean properties correctly', () => {
    const mof = generateMofContent(makeConfig({
      resources: [{
        id: '1', schemaName: 'WindowsFeature', instanceName: 'IIS',
        properties: { Name: 'Web-Server', IncludeAllSubFeature: true }, dependsOn: [],
      }],
    }));
    expect(mof).toContain('IncludeAllSubFeature = True;');
  });
});

describe('generateMofFile', () => {
  it('starts with UTF-8 BOM', () => {
    const bytes = generateMofFile({
      configName: 'Test', platform: 'Windows', mode: 'Audit', version: '1.0.0', description: '', resources: [],
    });
    expect(bytes[0]).toBe(0xEF);
    expect(bytes[1]).toBe(0xBB);
    expect(bytes[2]).toBe(0xBF);
  });
});
