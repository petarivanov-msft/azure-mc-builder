import { ResourceSchema } from '../../types';

export const environmentSchema: ResourceSchema = {
  resourceName: 'Environment',
  moduleName: 'PSDscResources',
  moduleVersion: '2.12.0.0',
  mofClassName: 'MSFT_EnvironmentResource',
  dscV3TypeName: 'PSDscResources/Environment',
  platform: 'Windows',
  description: 'Manage Windows environment variables',
  docUrl: 'https://learn.microsoft.com/powershell/dsc/reference/psdscresources/resources/environment/environment',
  category: 'System',
  properties: [
    { name: 'Name', description: 'Environment variable name', type: 'string', required: true, isKey: true, placeholder: 'MY_VAR' },
    { name: 'Value', description: 'Variable value (leave empty for Absent)', type: 'string', required: false, isKey: false },
    { name: 'Ensure', description: 'Present or Absent', type: 'string', required: false, isKey: false, enumValues: ['Present', 'Absent'], defaultValue: 'Present' },
    { name: 'Path', description: 'Treat as PATH-type variable (appends rather than overwrites)', type: 'boolean', required: false, isKey: false, defaultValue: false },
    { name: 'Target', description: 'Variable scope', type: 'string[]', required: false, isKey: false, enumValues: ['Process', 'Machine'] },
  ],
};
