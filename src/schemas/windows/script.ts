import { ResourceSchema } from '../../types';

export const scriptSchema: ResourceSchema = {
  resourceName: 'Script',
  moduleName: 'PSDscResources',
  moduleVersion: '2.12.0.0',
  mofClassName: 'MSFT_ScriptResource',
  dscV3TypeName: 'PSDscResources/Script',
  platform: 'Windows',
  description: 'Run custom PowerShell scripts for Get/Test/Set',
  docUrl: 'https://learn.microsoft.com/powershell/dsc/reference/psdscresources/resources/script/script',
  category: 'Custom',
  properties: [
    { name: 'GetScript', description: 'Script that returns the current state', type: 'string', required: true, isKey: true },
    { name: 'TestScript', description: 'Script that returns $true if compliant', type: 'string', required: true, isKey: false },
    { name: 'SetScript', description: 'Script that enforces the desired state', type: 'string', required: true, isKey: false },
  ],
};
