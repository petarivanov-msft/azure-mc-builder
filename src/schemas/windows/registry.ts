import { ResourceSchema } from '../../types';

export const registrySchema: ResourceSchema = {
  resourceName: 'Registry',
  moduleName: 'PSDscResources',
  moduleVersion: '2.12.0.0',
  mofClassName: 'MSFT_RegistryResource',
  dscV3TypeName: 'PSDscResources/Registry',
  platform: 'Windows',
  description: 'Manage Windows registry keys and values',
  docUrl: 'https://learn.microsoft.com/powershell/dsc/reference/psdscresources/resources/registry/registry',
  category: 'File & Package',
  properties: [
    { name: 'Key', description: 'Registry key path (e.g., HKLM:\\SOFTWARE\\...)', type: 'string', required: true, isKey: true, placeholder: 'HKLM:\\SOFTWARE\\MyApp', validationPattern: '^(HKLM|HKCU|HKEY_LOCAL_MACHINE|HKEY_CURRENT_USER):\\\\', validationMessage: 'Registry key must start with HKLM:\\ or HKCU:\\ (e.g. HKLM:\\SOFTWARE\\Policies\\...)' },
    { name: 'ValueName', description: 'Registry value name (empty string for default value)', type: 'string', required: true, isKey: true },
    { name: 'ValueData', description: 'Value data (array for MultiString type)', type: 'string[]', required: false, isKey: false },
    { name: 'ValueType', description: 'Registry value type. Casing: Dword/Qword (lowercase w)', type: 'string', required: false, isKey: false, enumValues: ['String', 'Binary', 'Dword', 'Qword', 'MultiString', 'ExpandString'] },
    { name: 'Ensure', description: 'Present or Absent', type: 'string', required: false, isKey: false, enumValues: ['Present', 'Absent'], defaultValue: 'Present' },
    { name: 'Hex', description: 'Whether Dword/Qword data is in hex format', type: 'boolean', required: false, isKey: false, defaultValue: false },
    { name: 'Force', description: 'Overwrite or delete with subkeys', type: 'boolean', required: false, isKey: false, defaultValue: false },
  ],
};
