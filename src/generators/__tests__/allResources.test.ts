import { describe, it, expect } from 'vitest';
import { generateMofContent } from '../mofGenerator';
import { generatePs1 } from '../ps1Generator';
import { generatePackageScript } from '../packageScriptGenerator';
import { allSchemas, schemasByName } from '../../schemas';
import { templates } from '../../templates';
import { ConfigurationState, ResourceInstance } from '../../types';

/**
 * Build a minimal valid ResourceInstance for a given schema name.
 * Fills all required properties with realistic sample values.
 */
function buildTestInstance(schemaName: string, instanceName: string): ResourceInstance {
  const schema = schemasByName[schemaName];
  if (!schema) throw new Error(`Unknown schema: ${schemaName}`);

  const props: Record<string, unknown> = {};

  for (const p of schema.properties) {
    if (!p.required) continue;

    if (p.defaultValue !== undefined) {
      props[p.name] = p.defaultValue;
    } else if (p.enumValues && p.enumValues.length > 0) {
      props[p.name] = p.type === 'string[]' ? [p.enumValues[0]] : p.enumValues[0];
    } else if (p.placeholder) {
      props[p.name] = p.type === 'string[]' ? [p.placeholder] : p.placeholder;
    } else {
      switch (p.type) {
        case 'string': props[p.name] = `test-${p.name}`; break;
        case 'string[]': props[p.name] = [`test-${p.name}`]; break;
        case 'boolean': props[p.name] = true; break;
        case 'integer': props[p.name] = 1; break;
      }
    }
  }

  return {
    id: `test-${schemaName}-${instanceName}`,
    schemaName,
    instanceName,
    properties: props,
    dependsOn: [],
  };
}

function makeConfig(platform: 'Windows' | 'Linux', resources: ResourceInstance[]): ConfigurationState {
  return {
    configName: 'AllResourcesTest',
    platform,
    mode: 'Audit',
    version: '1.0.0',
    description: 'Test all resources',
    resources,
  };
}

// ─── Schema Validation ───────────────────────────────────

describe('Schema consistency checks', () => {
  it('every schema is registered in schemasByName', () => {
    for (const s of allSchemas) {
      expect(schemasByName[s.resourceName]).toBeDefined();
    }
  });

  it('every schema has at least one Key property', () => {
    for (const s of allSchemas) {
      const keys = s.properties.filter(p => p.isKey);
      expect(keys.length, `${s.resourceName} has no Key properties`).toBeGreaterThanOrEqual(1);
    }
  });

  it('every schema has required metadata fields', () => {
    for (const s of allSchemas) {
      expect(s.resourceName, `missing resourceName`).toBeTruthy();
      expect(s.moduleName, `${s.resourceName}: missing moduleName`).toBeTruthy();
      expect(s.moduleVersion, `${s.resourceName}: missing moduleVersion`).toBeTruthy();
      expect(s.mofClassName, `${s.resourceName}: missing mofClassName`).toBeTruthy();
      expect(s.dscV3TypeName, `${s.resourceName}: missing dscV3TypeName`).toBeTruthy();
      expect(s.platform, `${s.resourceName}: missing platform`).toBeTruthy();
      expect(s.category, `${s.resourceName}: missing category`).toBeTruthy();
      expect(s.description, `${s.resourceName}: missing description`).toBeTruthy();
    }
  });

  it('no duplicate resourceNames', () => {
    const names = allSchemas.map(s => s.resourceName);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dupes, `Duplicate resourceNames: ${dupes.join(', ')}`).toEqual([]);
  });

  it('all property types are valid', () => {
    const validTypes = ['string', 'string[]', 'boolean', 'integer'];
    for (const s of allSchemas) {
      for (const p of s.properties) {
        expect(validTypes, `${s.resourceName}.${p.name} has invalid type '${p.type}'`).toContain(p.type);
      }
    }
  });

  it('enum properties have enumValues defined', () => {
    for (const s of allSchemas) {
      for (const p of s.properties) {
        if (p.enumValues) {
          expect(p.enumValues.length, `${s.resourceName}.${p.name} has empty enumValues`).toBeGreaterThan(0);
        }
      }
    }
  });
});

// ─── Windows Resources — MOF Generation ──────────────────

const windowsSchemas = allSchemas.filter(s => s.platform === 'Windows');
const linuxSchemas = allSchemas.filter(s => s.platform === 'Linux');

describe('MOF generation — all Windows resources', () => {
  for (const schema of windowsSchemas) {
    it(`generates valid MOF for ${schema.resourceName} (${schema.moduleName})`, () => {
      const instance = buildTestInstance(schema.resourceName, `Test${schema.resourceName}`);
      const config = makeConfig('Windows', [instance]);
      const mof = generateMofContent(config);

      // Must contain the MOF class
      expect(mof).toContain(`instance of ${schema.mofClassName}`);
      // Must contain the ResourceID
      expect(mof).toContain(`ResourceID = "[${schema.resourceName}]Test${schema.resourceName}"`);
      // Must contain module metadata
      expect(mof).toContain(`ModuleName = "${schema.moduleName}"`);
      expect(mof).toContain(`ModuleVersion = "${schema.moduleVersion}"`);
      // Must contain OMI_ConfigurationDocument
      expect(mof).toContain('instance of OMI_ConfigurationDocument');
      // Must contain all required property values
      for (const p of schema.properties) {
        if (p.required && instance.properties[p.name] !== undefined) {
          expect(mof, `Missing required property ${p.name}`).toContain(p.name);
        }
      }
    });
  }
});

describe('MOF generation — all Linux resources', () => {
  for (const schema of linuxSchemas) {
    it(`generates valid MOF for ${schema.resourceName} (${schema.moduleName})`, () => {
      const instance = buildTestInstance(schema.resourceName, `Test${schema.resourceName}`);
      const config = makeConfig('Linux', [instance]);
      const mof = generateMofContent(config);

      expect(mof).toContain(`instance of ${schema.mofClassName}`);
      expect(mof).toContain(`ResourceID = "[${schema.resourceName}]Test${schema.resourceName}"`);
      expect(mof).toContain(`ModuleName = "${schema.moduleName}"`);
      expect(mof).toContain('instance of OMI_ConfigurationDocument');
    });
  }
});

// ─── PS1 Generation ──────────────────────────────────────

describe('PS1 generation — all Windows resources', () => {
  for (const schema of windowsSchemas) {
    it(`generates valid PS1 for ${schema.resourceName} (${schema.moduleName})`, () => {
      const instance = buildTestInstance(schema.resourceName, `Test${schema.resourceName}`);
      const config = makeConfig('Windows', [instance]);
      const ps1 = generatePs1(config);

      // Must be a DSC Configuration block
      expect(ps1).toContain('Configuration AllResourcesTest');
      expect(ps1).toContain('Node localhost');
      // Must contain the resource block
      expect(ps1).toContain(`${schema.resourceName} 'Test${schema.resourceName}'`);
      // Must contain required properties
      for (const p of schema.properties) {
        if (p.required && instance.properties[p.name] !== undefined) {
          expect(ps1, `Missing required property ${p.name}`).toContain(p.name);
        }
      }
    });
  }
});

describe('PS1 generation — all Linux resources', () => {
  for (const schema of linuxSchemas) {
    it(`generates valid PS1 for ${schema.resourceName} (${schema.moduleName})`, () => {
      const instance = buildTestInstance(schema.resourceName, `Test${schema.resourceName}`);
      const config = makeConfig('Linux', [instance]);
      const ps1 = generatePs1(config);

      expect(ps1).toContain(`${schema.resourceName} 'Test${schema.resourceName}'`);
    });
  }
});

// ─── PS1 Import-DscResource ─────────────────────────────

describe('PS1 Import-DscResource includes correct module', () => {
  it('uses PSDscResources for Windows', () => {
    const instance = buildTestInstance('Service', 'TestSvc');
    const ps1 = generatePs1(makeConfig('Windows', [instance]));
    expect(ps1).toContain("Import-DscResource -ModuleName 'PSDscResources'");
  });

  it('uses nxtools for Linux', () => {
    const instance = buildTestInstance('nxFile', 'TestFile');
    const ps1 = generatePs1(makeConfig('Linux', [instance]));
    expect(ps1).toContain("Import-DscResource -ModuleName 'nxtools'");
  });
});

// ─── Multi-resource config ──────────────────────────────

describe('Multi-resource generation', () => {
  it('generates MOF with all Windows resources in one config', () => {
    const instances = windowsSchemas.map((s, i) =>
      buildTestInstance(s.resourceName, `Inst${i}`)
    );
    const config = makeConfig('Windows', instances);
    const mof = generateMofContent(config);

    for (const schema of windowsSchemas) {
      expect(mof, `Missing MOF class ${schema.mofClassName}`).toContain(`instance of ${schema.mofClassName}`);
    }
    expect(mof).toContain('instance of OMI_ConfigurationDocument');
  });

  it('generates PS1 with all Windows resources in one config', () => {
    const instances = windowsSchemas.map((s, i) =>
      buildTestInstance(s.resourceName, `Inst${i}`)
    );
    const config = makeConfig('Windows', instances);
    const ps1 = generatePs1(config);

    for (const schema of windowsSchemas) {
      expect(ps1, `Missing PS1 block for ${schema.resourceName}`).toContain(`${schema.resourceName} 'Inst`);
    }
  });
});

// ─── New modules specific tests ─────────────────────────

describe('SecurityPolicyDsc resources', () => {
  it('AccountPolicy generates correct MOF with password settings', () => {
    const instance: ResourceInstance = {
      id: 'ap1', schemaName: 'AccountPolicy', instanceName: 'PasswordPolicy',
      dependsOn: [],
      properties: {
        Name: 'CorpPasswordPolicy',
        Enforce_password_history: 24,
        Minimum_Password_Length: 14,
        Password_must_meet_complexity_requirements: 'Enabled',
        Account_lockout_threshold: 5,
        Account_lockout_duration: 30,
      },
    };
    const mof = generateMofContent(makeConfig('Windows', [instance]));
    expect(mof).toContain('instance of MSFT_AccountPolicy');
    expect(mof).toContain('Enforce_password_history = 24;');
    expect(mof).toContain('Minimum_Password_Length = 14;');
    expect(mof).toContain('Password_must_meet_complexity_requirements = "Enabled";');
    expect(mof).toContain('Account_lockout_threshold = 5;');
    expect(mof).toContain('Account_lockout_duration = 30;');
    expect(mof).toContain('ModuleName = "SecurityPolicyDsc";');
    expect(mof).toContain('ModuleVersion = "2.10.0.0";');
  });

  it('UserRightsAssignment generates correct MOF with identity array', () => {
    const instance: ResourceInstance = {
      id: 'ura1', schemaName: 'UserRightsAssignment', instanceName: 'DenyRDP',
      dependsOn: [],
      properties: {
        Policy: 'Deny_log_on_through_Remote_Desktop_Services',
        Identity: ['Guests', 'BUILTIN\\Users'],
        Force: true,
      },
    };
    const mof = generateMofContent(makeConfig('Windows', [instance]));
    expect(mof).toContain('instance of MSFT_UserRightsAssignment');
    expect(mof).toContain('Policy = "Deny_log_on_through_Remote_Desktop_Services";');
    expect(mof).toContain('Identity = {"Guests", "BUILTIN\\\\Users"};');
    expect(mof).toContain('Force = True;');
  });

  it('SecurityOption generates correct MOF with UAC and logon settings', () => {
    const instance: ResourceInstance = {
      id: 'so1', schemaName: 'SecurityOption', instanceName: 'HardenedOptions',
      dependsOn: [],
      properties: {
        Name: 'CISLevel1',
        Accounts_Guest_account_status: 'Disabled',
        Interactive_logon_Do_not_display_last_user_name: 'Enabled',
        Interactive_logon_Message_text_for_users_attempting_to_log_on: 'Authorized access only.',
        Network_security_LAN_Manager_authentication_level: 'Send NTLMv2 responses only. Refuse LM & NTLM',
        User_Account_Control_Run_all_administrators_in_Admin_Approval_Mode: 'Enabled',
      },
    };
    const mof = generateMofContent(makeConfig('Windows', [instance]));
    expect(mof).toContain('instance of MSFT_SecurityOption');
    expect(mof).toContain('Accounts_Guest_account_status = "Disabled";');
    expect(mof).toContain('Interactive_logon_Do_not_display_last_user_name = "Enabled";');
    expect(mof).toContain('Interactive_logon_Message_text_for_users_attempting_to_log_on = "Authorized access only.";');
    expect(mof).toContain('Network_security_LAN_Manager_authentication_level = "Send NTLMv2 responses only. Refuse LM & NTLM";');
  });
});

describe('AuditPolicyDsc resources', () => {
  it('AuditPolicySubcategory generates correct MOF for logon success auditing', () => {
    const instance: ResourceInstance = {
      id: 'aps1', schemaName: 'AuditPolicySubcategory', instanceName: 'AuditLogonSuccess',
      dependsOn: [],
      properties: {
        Name: 'Logon',
        AuditFlag: 'Success',
        Ensure: 'Present',
      },
    };
    const mof = generateMofContent(makeConfig('Windows', [instance]));
    expect(mof).toContain('instance of MSFT_AuditPolicySubcategory');
    expect(mof).toContain('Name = "Logon";');
    expect(mof).toContain('AuditFlag = "Success";');
    expect(mof).toContain('ModuleName = "AuditPolicyDsc";');
    expect(mof).toContain('ModuleVersion = "1.4.0.0";');
  });

  it('AuditPolicyOption generates correct MOF', () => {
    const instance: ResourceInstance = {
      id: 'apo1', schemaName: 'AuditPolicyOption', instanceName: 'CrashOnFail',
      dependsOn: [],
      properties: {
        Name: 'CrashOnAuditFail',
        Value: 'Disabled',
      },
    };
    const mof = generateMofContent(makeConfig('Windows', [instance]));
    expect(mof).toContain('instance of MSFT_AuditPolicyOption');
    expect(mof).toContain('Name = "CrashOnAuditFail";');
    expect(mof).toContain('Value = "Disabled";');
  });
});

describe('NetworkingDsc resources', () => {
  it('Firewall generates correct MOF with ports and profiles', () => {
    const instance: ResourceInstance = {
      id: 'fw1', schemaName: 'Firewall', instanceName: 'AllowHTTPS',
      dependsOn: [],
      properties: {
        Name: 'AllowHTTPS',
        DisplayName: 'Allow HTTPS Inbound',
        Action: 'Allow',
        Direction: 'Inbound',
        Protocol: 'TCP',
        LocalPort: ['443'],
        Profile: ['Domain', 'Private'],
        Enabled: 'True',
        Ensure: 'Present',
      },
    };
    const mof = generateMofContent(makeConfig('Windows', [instance]));
    expect(mof).toContain('instance of DSC_Firewall');
    expect(mof).toContain('Name = "AllowHTTPS";');
    expect(mof).toContain('DisplayName = "Allow HTTPS Inbound";');
    expect(mof).toContain('Action = "Allow";');
    expect(mof).toContain('Direction = "Inbound";');
    expect(mof).toContain('Protocol = "TCP";');
    expect(mof).toContain('LocalPort = {"443"};');
    expect(mof).toContain('Profile = {"Domain", "Private"};');
    expect(mof).toContain('ModuleName = "NetworkingDsc";');
    expect(mof).toContain('ModuleVersion = "9.0.0";');
  });
});

describe('ComputerManagementDsc resources', () => {
  it('ScheduledTask generates correct MOF with schedule settings', () => {
    const instance: ResourceInstance = {
      id: 'st1', schemaName: 'ScheduledTask', instanceName: 'DailyBackup',
      dependsOn: [],
      properties: {
        TaskName: 'DailyBackup',
        ActionExecutable: 'C:\\Scripts\\backup.ps1',
        ScheduleType: 'Daily',
        DaysInterval: 1,
        StartTime: '2024-01-01T02:00:00',
        RunLevel: 'Highest',
        Enable: true,
      },
    };
    const mof = generateMofContent(makeConfig('Windows', [instance]));
    expect(mof).toContain('instance of DSC_ScheduledTask');
    expect(mof).toContain('TaskName = "DailyBackup";');
    expect(mof).toContain('ActionExecutable = "C:\\\\Scripts\\\\backup.ps1";');
    expect(mof).toContain('ScheduleType = "Daily";');
    expect(mof).toContain('DaysInterval = 1;');
    expect(mof).toContain('RunLevel = "Highest";');
    expect(mof).toContain('Enable = True;');
    expect(mof).toContain('ModuleName = "ComputerManagementDsc";');
  });

  it('TimeZone generates correct MOF', () => {
    const instance: ResourceInstance = {
      id: 'tz1', schemaName: 'TimeZone', instanceName: 'SetGMT',
      dependsOn: [],
      properties: {
        IsSingleInstance: 'Yes',
        TimeZone: 'GMT Standard Time',
      },
    };
    const mof = generateMofContent(makeConfig('Windows', [instance]));
    expect(mof).toContain('instance of DSC_TimeZone');
    expect(mof).toContain('IsSingleInstance = "Yes";');
    expect(mof).toContain('TimeZone = "GMT Standard Time";');
  });

  it('PowerPlan generates correct MOF', () => {
    const instance: ResourceInstance = {
      id: 'pp1', schemaName: 'PowerPlan', instanceName: 'HighPerf',
      dependsOn: [],
      properties: {
        IsSingleInstance: 'Yes',
        Name: 'High performance',
      },
    };
    const mof = generateMofContent(makeConfig('Windows', [instance]));
    expect(mof).toContain('instance of DSC_PowerPlan');
    expect(mof).toContain('IsSingleInstance = "Yes";');
    expect(mof).toContain('Name = "High performance";');
  });
});

// ─── PS1 module-specific tests ──────────────────────────

describe('PS1 generation — new module resources', () => {
  it('AccountPolicy PS1 uses correct format', () => {
    const instance = buildTestInstance('AccountPolicy', 'TestAP');
    const ps1 = generatePs1(makeConfig('Windows', [instance]));
    expect(ps1).toContain("AccountPolicy 'TestAP'");
  });

  it('Firewall PS1 formats arrays correctly', () => {
    const instance: ResourceInstance = {
      id: 'fw1', schemaName: 'Firewall', instanceName: 'TestFW',
      dependsOn: [],
      properties: {
        Name: 'TestFW',
        LocalPort: ['80', '443'],
        Profile: ['Domain', 'Private', 'Public'],
      },
    };
    const ps1 = generatePs1(makeConfig('Windows', [instance]));
    expect(ps1).toContain("LocalPort = @('80', '443')");
    expect(ps1).toContain("Profile = @('Domain', 'Private', 'Public')");
  });

  it('UserRightsAssignment PS1 formats Identity array', () => {
    const instance: ResourceInstance = {
      id: 'ura1', schemaName: 'UserRightsAssignment', instanceName: 'TestURA',
      dependsOn: [],
      properties: {
        Policy: 'Allow_log_on_locally',
        Identity: ['Administrators', 'Remote Desktop Users'],
      },
    };
    const ps1 = generatePs1(makeConfig('Windows', [instance]));
    expect(ps1).toContain("Policy = 'Allow_log_on_locally'");
    expect(ps1).toContain("Identity = @('Administrators', 'Remote Desktop Users')");
  });

  it('ScheduledTask PS1 formats mixed types', () => {
    const instance: ResourceInstance = {
      id: 'st1', schemaName: 'ScheduledTask', instanceName: 'TestST',
      dependsOn: [],
      properties: {
        TaskName: 'TestTask',
        ScheduleType: 'Weekly',
        DaysOfWeek: ['Monday', 'Friday'],
        Enable: true,
        Priority: 4,
      },
    };
    const ps1 = generatePs1(makeConfig('Windows', [instance]));
    expect(ps1).toContain("TaskName = 'TestTask'");
    expect(ps1).toContain("DaysOfWeek = @('Monday', 'Friday')");
    expect(ps1).toContain('Enable = $true');
    expect(ps1).toContain('Priority = 4');
  });
});

// ─── Package script references correct modules ──────────

describe('Package script generation', () => {
  it('generates valid package.ps1 for Windows', () => {
    const config = makeConfig('Windows', [buildTestInstance('Service', 'TestSvc')]);
    const script = generatePackageScript(config);
    expect(script).toContain('Install-Module -Name GuestConfiguration');
    expect(script).toContain("'PSDscResources' = '2.12.0.0'");
    expect(script).toContain('New-GuestConfigurationPackage');
    expect(script).toContain('Test-GuestConfigurationPackage');
    expect(script).toContain('$mofPath');
    expect(script).toContain('ModuleName');  // MOF parsing
  });

  it('installs ALL required modules for multi-module configs', () => {
    // Mix resources from 3 different modules
    const resources: ResourceInstance[] = [
      { id: 'r1', schemaName: 'Service', instanceName: 'Svc',
        properties: { Name: 'wuauserv' }, dependsOn: [] },
      { id: 'r2', schemaName: 'AccountPolicy', instanceName: 'Pwd',
        properties: { Name: 'PwdPolicy' }, dependsOn: [] },
      { id: 'r3', schemaName: 'Firewall', instanceName: 'Fw',
        properties: { Name: 'BlockAll' }, dependsOn: [] },
    ];
    const config = makeConfig('Windows', resources);
    const script = generatePackageScript(config);
    expect(script).toContain("'PSDscResources' = '2.12.0.0'");
    expect(script).toContain("'SecurityPolicyDsc' = '2.10.0.0'");
    expect(script).toContain("'NetworkingDsc' = '9.0.0'");
    expect(script).toContain('ModuleName');  // MOF parsing regex
  });

  it('generates valid package.ps1 for Linux', () => {
    const config = makeConfig('Linux', [buildTestInstance('nxFileLine', 'SshLine')]);
    const script = generatePackageScript(config);
    expect(script).toContain("'nxtools' = '1.6.0'");
    expect(script).not.toContain('PSDscResources');
  });
});

// ─── Multi-module PS1 Import-DscResource ────────────────

describe('PS1 multi-module imports', () => {
  it('emits Import-DscResource for each unique module used', () => {
    const resources: ResourceInstance[] = [
      { id: 'r1', schemaName: 'Service', instanceName: 'Svc',
        properties: { Name: 'wuauserv' }, dependsOn: [] },
      { id: 'r2', schemaName: 'AccountPolicy', instanceName: 'Pwd',
        properties: { Name: 'PwdPolicy' }, dependsOn: [] },
      { id: 'r3', schemaName: 'Firewall', instanceName: 'Fw',
        properties: { Name: 'BlockAll' }, dependsOn: [] },
      { id: 'r4', schemaName: 'TimeZone', instanceName: 'Tz',
        properties: { TimeZone: 'UTC' }, dependsOn: [] },
    ];
    const ps1 = generatePs1(makeConfig('Windows', resources));
    expect(ps1).toContain("Import-DscResource -ModuleName 'PSDscResources' -ModuleVersion '2.12.0.0'");
    expect(ps1).toContain("Import-DscResource -ModuleName 'SecurityPolicyDsc' -ModuleVersion '2.10.0.0'");
    expect(ps1).toContain("Import-DscResource -ModuleName 'NetworkingDsc' -ModuleVersion '9.0.0'");
    expect(ps1).toContain("Import-DscResource -ModuleName 'ComputerManagementDsc' -ModuleVersion '9.2.0'");
  });

  it('only emits one Import-DscResource per module even with multiple resources', () => {
    const resources: ResourceInstance[] = [
      { id: 'r1', schemaName: 'Service', instanceName: 'Svc1',
        properties: { Name: 'wuauserv' }, dependsOn: [] },
      { id: 'r2', schemaName: 'Registry', instanceName: 'Reg1',
        properties: { Key: 'HKLM:\\Test', ValueName: 'x' }, dependsOn: [] },
    ];
    const ps1 = generatePs1(makeConfig('Windows', resources));
    const matches = ps1.match(/Import-DscResource/g) || [];
    expect(matches.length).toBe(1); // Both are PSDscResources — only one import
  });
});

// ─── DependsOn across new resources ─────────────────────

describe('Cross-resource dependencies', () => {
  it('new resources can reference each other via DependsOn', () => {
    const ap: ResourceInstance = {
      id: 'ap1', schemaName: 'AccountPolicy', instanceName: 'Passwords',
      properties: { Name: 'PasswordSettings' }, dependsOn: [],
    };
    const ura: ResourceInstance = {
      id: 'ura1', schemaName: 'UserRightsAssignment', instanceName: 'DenyGuests',
      properties: { Policy: 'Deny_log_on_locally', Identity: ['Guests'] },
      dependsOn: ['ap1'],
    };
    const fw: ResourceInstance = {
      id: 'fw1', schemaName: 'Firewall', instanceName: 'BlockAll',
      properties: { Name: 'BlockAll' },
      dependsOn: ['ura1'],
    };

    const mof = generateMofContent(makeConfig('Windows', [ap, ura, fw]));
    expect(mof).toContain('DependsOn = {"[AccountPolicy]Passwords"}');
    expect(mof).toContain('DependsOn = {"[UserRightsAssignment]DenyGuests"}');
  });
});

// ─── Resource count sanity check ────────────────────────

describe('Resource count', () => {
  it('has 21 Windows resources', () => {
    expect(allSchemas.filter(s => s.platform === 'Windows').length).toBe(21);
  });

  it('has 8 Linux resources', () => {
    expect(allSchemas.filter(s => s.platform === 'Linux').length).toBe(8);
  });

  it('has 29 total resources', () => {
    expect(allSchemas.length).toBe(29);
  });
});

// ─── Validation pattern tests ───────────────────────────

// ─── Validation pattern tests ───────────────────────────

describe('Validation patterns', () => {
  it('MsiPackage ProductId has GUID validation pattern', () => {
    const schema = schemasByName['MsiPackage'];
    const prop = schema.properties.find(p => p.name === 'ProductId');
    expect(prop?.validationPattern).toBeDefined();
    const re = new RegExp(prop!.validationPattern!);
    expect(re.test('12345')).toBe(false);
    expect(re.test('not-a-guid')).toBe(false);
    expect(re.test('{12345678-1234-1234-1234-123456789012}')).toBe(true);
    expect(re.test('12345678-1234-1234-1234-123456789012')).toBe(true);
  });

  it('Registry Key has path validation pattern', () => {
    const schema = schemasByName['Registry'];
    const prop = schema.properties.find(p => p.name === 'Key');
    expect(prop?.validationPattern).toBeDefined();
    const re = new RegExp(prop!.validationPattern!);
    expect(re.test('SOFTWARE\\MyApp')).toBe(false);
    expect(re.test('HKLM:\\SOFTWARE\\MyApp')).toBe(true);
    expect(re.test('HKCU:\\SOFTWARE\\MyApp')).toBe(true);
  });

  it('ScheduledTask RepeatInterval has time format validation', () => {
    const schema = schemasByName['ScheduledTask'];
    const prop = schema.properties.find(p => p.name === 'RepeatInterval');
    expect(prop?.validationPattern).toBeDefined();
    const re = new RegExp(prop!.validationPattern!);
    expect(re.test('00:15:00')).toBe(true);
    expect(re.test('1:00:00')).toBe(true);
    expect(re.test('fifteen minutes')).toBe(false);
  });
});

// ─── Template validation ────────────────────────────────

describe('Templates', () => {
  it('all templates have valid schema references', () => {
    for (const tmpl of templates) {
      for (const resource of tmpl.config.resources) {
        const schema = schemasByName[resource.schemaName];
        expect(schema, `Template "${tmpl.name}" references unknown schema "${resource.schemaName}"`).toBeDefined();
        // Check all properties exist in schema
        for (const propName of Object.keys(resource.properties)) {
          const schemaProp = schema.properties.find(p => p.name === propName);
          expect(schemaProp, `Template "${tmpl.name}" resource "${resource.instanceName}" has unknown property "${propName}" for schema "${resource.schemaName}"`).toBeDefined();
        }
      }
    }
  });

  it('all templates have correct platform', () => {
    for (const tmpl of templates) {
      expect(tmpl.config.platform).toBe(tmpl.platform);
      for (const resource of tmpl.config.resources) {
        const schema = schemasByName[resource.schemaName];
        expect(schema.platform, `Template "${tmpl.name}" has ${schema.platform} resource "${resource.schemaName}" but platform is ${tmpl.platform}`).toBe(tmpl.platform);
      }
    }
  });

  it('has 9 templates total', () => {
    expect(templates.length).toBe(9);
  });
});
