import { describe, expect, it } from 'vitest';
import { allSchemas, schemasByName } from '../../schemas';
import { templates } from '../../templates';
import { generatePs1 } from '../ps1Generator';
import { GC_UNSUPPORTED_CLASSES } from '../../utils/resourceValidation';
import { schemaConfig } from './fixtures';

const knownClasses: Record<string, string[]> = {
  PSDscResources: ['MSFT_EnvironmentResource', 'MSFT_MsiPackage', 'MSFT_RegistryResource',
    'MSFT_ScriptResource', 'MSFT_ServiceResource', 'MSFT_UserResource', 'MSFT_WindowsProcess'],
  SecurityPolicyDsc: ['MSFT_AccountPolicy', 'MSFT_UserRightsAssignment', 'MSFT_SecurityOption'],
  AuditPolicyDsc: ['MSFT_AuditPolicySubcategory', 'MSFT_AuditPolicyOption'],
  NetworkingDsc: ['DSC_Firewall'],
  ComputerManagementDsc: ['DSC_ScheduledTask', 'DSC_TimeZone', 'DSC_PowerPlan'],
  nxtools: ['nxFile', 'nxGroup', 'nxUser', 'nxPackage', 'nxFileLine', 'nxFileContentReplace', 'nxService', 'nxScript'],
};

describe('resource catalog contracts', () => {
  it('retains all 24 supported resources and nine templates', () => {
    expect(allSchemas).toHaveLength(24);
    expect(allSchemas.filter(s => s.platform === 'Windows')).toHaveLength(16);
    expect(allSchemas.filter(s => s.platform === 'Linux')).toHaveLength(8);
    expect(templates).toHaveLength(9);
  });
  it('has unique registered resource names and native class names', () => {
    expect(new Set(allSchemas.map(s => s.resourceName)).size).toBe(allSchemas.length);
    expect(new Set(allSchemas.map(s => s.mofClassName)).size).toBe(allSchemas.length);
    for (const schema of allSchemas) expect(schemasByName[schema.resourceName]).toBe(schema);
  });
  for (const schema of allSchemas) {
    it(`${schema.resourceName} has verified metadata and property types`, () => {
      expect(knownClasses[schema.moduleName]).toContain(schema.mofClassName);
      expect(GC_UNSUPPORTED_CLASSES.has(schema.mofClassName)).toBe(false);
      expect(schema.moduleVersion).toMatch(/^\d+(\.\d+){2,3}$/);
      expect(schema.description).not.toBe('');
      expect(schema.category).not.toBe('');
      expect(schema.properties.some(p => p.isKey)).toBe(true);
      for (const prop of schema.properties) {
        expect(['string', 'string[]', 'boolean', 'integer']).toContain(prop.type);
        if (prop.enumValues) expect(prop.enumValues.length).toBeGreaterThan(0);
      }
    });
    it(`${schema.resourceName} emits DSC source with pinned imports and required properties`, () => {
      const config = schemaConfig(schema.resourceName);
      const source = generatePs1(config);
      expect(source).toContain(`Configuration ${config.configName}`);
      expect(source).toContain('Node localhost');
      expect(source).toContain(`${schema.resourceName} 'Test${schema.resourceName}'`);
      expect(source).toContain(`Import-DscResource -ModuleName '${schema.moduleName}' -ModuleVersion '${schema.moduleVersion}'`);
      for (const prop of schema.properties.filter(p => p.required || p.isKey)) expect(source).toContain(`${prop.name} =`);
    });
  }
});

describe('catalog validation patterns', () => {
  it.each([
    ['MsiPackage', 'ProductId', ['{12345678-1234-1234-1234-123456789012}', '12345678-1234-1234-1234-123456789012'], ['12345', 'not-a-guid']],
    ['Registry', 'Key', ['HKLM:\\SOFTWARE\\MyApp', 'HKCU:\\SOFTWARE\\MyApp'], ['SOFTWARE\\MyApp']],
    ['ScheduledTask', 'RepeatInterval', ['00:15:00', '1:00:00'], ['fifteen minutes']],
  ] as const)('%s.%s preserves its input constraints', (resource, property, valid, invalid) => {
    const pattern = schemasByName[resource].properties.find(p => p.name === property)?.validationPattern;
    expect(pattern).toBeDefined();
    const regex = new RegExp(pattern!);
    for (const value of valid) expect(regex.test(value)).toBe(true);
    for (const value of invalid) expect(regex.test(value)).toBe(false);
  });
});

describe('DSC source formatting', () => {
  it('formats arrays, booleans and integers without converting them into text', () => {
    const config = schemaConfig('ScheduledTask');
    Object.assign(config.resources[0].properties, {
      DaysOfWeek: ['Monday', 'Friday'], Enable: true, Priority: 4, ScheduleType: 'Weekly',
    });
    const source = generatePs1(config);
    expect(source).toContain("DaysOfWeek = @('Monday', 'Friday')");
    expect(source).toContain('Enable = $true');
    expect(source).toContain('Priority = 4');
  });
  it('preserves firewall ports and profile arrays', () => {
    const config = schemaConfig('Firewall');
    Object.assign(config.resources[0].properties, { LocalPort: ['80', '443'], Profile: ['Domain', 'Private'] });
    const source = generatePs1(config);
    expect(source).toContain("LocalPort = @('80', '443')");
    expect(source).toContain("Profile = @('Domain', 'Private')");
  });
  it('preserves security policy numbers and multiline text', () => {
    const config = schemaConfig('AccountPolicy');
    Object.assign(config.resources[0].properties, { Enforce_password_history: 24, Minimum_Password_Length: 14 });
    expect(generatePs1(config)).toContain('Enforce_password_history = 24');
    expect(generatePs1(config)).toContain('Minimum_Password_Length = 14');
    const security = schemaConfig('SecurityOption');
    security.resources[0].properties.Interactive_logon_Message_text_for_users_attempting_to_log_on = 'Line one\nLine two';
    expect(generatePs1(security)).toContain("'Line one\nLine two'");
  });
  it('emits every unique module once and preserves dependency chains and fan-in', () => {
    const config = schemaConfig('Service');
    const second = schemaConfig('Registry').resources[0];
    const third = schemaConfig('Firewall').resources[0];
    second.dependsOn = [config.resources[0].id];
    third.dependsOn = [config.resources[0].id, second.id];
    config.resources.push(second, third);
    const source = generatePs1(config);
    expect(source.match(/Import-DscResource/g)).toHaveLength(2);
    expect(source).toContain("DependsOn = '[Service]TestService'");
    expect(source).toContain("DependsOn = @('[Service]TestService', '[Registry]TestRegistry')");
  });
});
