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

// ─── Edge Cases ───────────────────────────────────────────────────
describe('edge cases', () => {
  const makeConfig = (overrides?: Partial<ConfigurationState>): ConfigurationState => ({
    configName: 'EdgeTest',
    platform: 'Windows',
    mode: 'Audit',
    version: '1.0.0',
    description: 'Edge case test',
    resources: [],
    ...overrides,
  });

  describe('escapeMofString edge cases', () => {
    it('strips null bytes', () => {
      expect(escapeMofString('test\0value')).toBe('testvalue');
    });
    it('escapes carriage returns', () => {
      expect(escapeMofString('line1\rline2')).toBe('line1\\rline2');
    });
    it('escapes tabs', () => {
      expect(escapeMofString('col1\tcol2')).toBe('col1\\tcol2');
    });
    it('handles empty string', () => {
      expect(escapeMofString('')).toBe('');
    });
    it('handles string with only special characters', () => {
      expect(escapeMofString('\\\n"\t\r\0')).toBe('\\\\\\n\\"\\t\\r');
    });
    it('handles deeply nested backslashes (registry paths)', () => {
      expect(escapeMofString('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows Defender\\Real-Time Protection'))
        .toBe('HKLM:\\\\SOFTWARE\\\\Policies\\\\Microsoft\\\\Windows Defender\\\\Real-Time Protection');
    });
    it('handles unicode characters', () => {
      expect(escapeMofString('résumé — "café"')).toBe('résumé — \\"café\\"');
    });
  });

  describe('formatMofValue edge cases', () => {
    it('returns empty string for null', () => {
      expect(formatMofValue(null, 'string')).toBe('');
    });
    it('returns empty string for undefined', () => {
      expect(formatMofValue(undefined, 'string')).toBe('');
    });
    it('handles NaN for integer type', () => {
      expect(formatMofValue(NaN, 'integer')).toBe('0');
    });
    it('handles Infinity for integer type', () => {
      expect(formatMofValue(Infinity, 'integer')).toBe('0');
    });
    it('truncates floating point to integer', () => {
      expect(formatMofValue(3.14, 'integer')).toBe('3');
    });
    it('handles negative integers', () => {
      expect(formatMofValue(-1, 'integer')).toBe('-1');
    });
    it('wraps non-array value in array for string[] type', () => {
      expect(formatMofValue('single', 'string[]')).toBe('{"single"}');
    });
    it('handles empty array for string[] type', () => {
      expect(formatMofValue([], 'string[]')).toBe('{}');
    });
    it('handles unknown type by treating as string', () => {
      expect(formatMofValue('test', 'unknown' as never)).toBe('"test"');
    });
  });

  describe('multi-resource DependsOn chains', () => {
    it('generates correct DependsOn for 3-deep chain', () => {
      const mof = generateMofContent(makeConfig({
        resources: [
          { id: 'a', schemaName: 'Service', instanceName: 'First', properties: { Name: 'svcA' }, dependsOn: [] },
          { id: 'b', schemaName: 'Registry', instanceName: 'Second', properties: { Key: 'HKLM:\\Test', ValueName: 'X' }, dependsOn: ['a'] },
          { id: 'c', schemaName: 'Registry', instanceName: 'Third', properties: { Key: 'HKLM:\\Test2', ValueName: 'Y' }, dependsOn: ['b'] },
        ],
      }));
      expect(mof).toContain('DependsOn = {"[Service]First"}');
      expect(mof).toContain('DependsOn = {"[Registry]Second"}');
    });

    it('generates multi-dependency DependsOn (fan-in)', () => {
      const mof = generateMofContent(makeConfig({
        resources: [
          { id: 'a', schemaName: 'Service', instanceName: 'SvcA', properties: { Name: 'svcA' }, dependsOn: [] },
          { id: 'b', schemaName: 'Service', instanceName: 'SvcB', properties: { Name: 'svcB' }, dependsOn: [] },
          { id: 'c', schemaName: 'Registry', instanceName: 'RegAfterBoth', properties: { Key: 'HKLM:\\Test', ValueName: 'X' }, dependsOn: ['a', 'b'] },
        ],
      }));
      expect(mof).toContain('DependsOn = {"[Service]SvcA", "[Service]SvcB"}');
    });

    it('ignores DependsOn with invalid resource ID', () => {
      const mof = generateMofContent(makeConfig({
        resources: [
          { id: 'a', schemaName: 'Service', instanceName: 'SvcA', properties: { Name: 'svcA' }, dependsOn: ['nonexistent'] },
        ],
      }));
      expect(mof).not.toContain('DependsOn');
    });
  });

  describe('special property values', () => {
    it('handles registry path with spaces and special chars', () => {
      const mof = generateMofContent(makeConfig({
        resources: [{
          id: '1', schemaName: 'Registry', instanceName: 'SpacePath',
          properties: {
            Key: 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion',
            ValueName: 'Product Name (x64)',
            ValueData: ['Windows Server 2022 "Datacenter"'],
            ValueType: 'String',
          },
          dependsOn: [],
        }],
      }));
      expect(mof).toContain('HKLM:\\\\SOFTWARE\\\\Microsoft\\\\Windows NT\\\\CurrentVersion');
      expect(mof).toContain('Product Name (x64)');
      expect(mof).toContain('Windows Server 2022 \\"Datacenter\\"');
    });

    it('handles multi-line SecurityOption values', () => {
      const mof = generateMofContent(makeConfig({
        resources: [{
          id: '1', schemaName: 'SecurityOption', instanceName: 'LogonMsg',
          properties: {
            Name: 'LogonMessage',
            Interactive_logon_Message_text_for_users_attempting_to_log_on: 'WARNING: Unauthorized access prohibited.\nAll activity is monitored.',
          },
          dependsOn: [],
        }],
      }));
      expect(mof).toContain('WARNING: Unauthorized access prohibited.\\nAll activity is monitored.');
    });

    it('skips empty string property values', () => {
      const mof = generateMofContent(makeConfig({
        resources: [{
          id: '1', schemaName: 'Registry', instanceName: 'EmptyVal',
          properties: { Key: 'HKLM:\\SOFTWARE\\Test', ValueName: '', ValueType: 'String' },
          dependsOn: [],
        }],
      }));
      // Empty string values are correctly omitted from MOF output
      expect(mof).not.toContain('ValueName');
      expect(mof).toContain('Key = "HKLM:\\\\SOFTWARE\\\\Test"');
    });
  });

  describe('config name edge cases', () => {
    it('handles config name with underscores', () => {
      const mof = generateMofContent(makeConfig({ configName: 'My_Config_Name' }));
      expect(mof).toContain('@GeneratedBy=My_Config_Name');
    });

    it('generates valid MOF with no resources (empty config)', () => {
      const mof = generateMofContent(makeConfig({ resources: [] }));
      expect(mof).toContain('instance of OMI_ConfigurationDocument');
      expect(mof).not.toContain('ResourceID');
    });
  });
});
