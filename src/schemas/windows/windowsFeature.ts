import { ResourceSchema } from '../../types';

export const windowsFeatureSchema: ResourceSchema = {
  resourceName: 'WindowsFeature',
  moduleName: 'PSDscResources',
  moduleVersion: '2.12.0.0',
  mofClassName: 'MSFT_RoleResource',
  dscV3TypeName: 'PSDscResources/WindowsFeature',
  platform: 'Windows',
  description: 'Install or remove Windows Server roles and features (Server SKU only — not Windows 10/11)',
  docUrl: 'https://learn.microsoft.com/powershell/dsc/reference/psdscresources/resources/windowsfeature/windowsfeature',
  category: 'Roles & Features',
  properties: [
    { name: 'Name', description: 'Feature name (e.g., Web-Server, Telnet-Client)', type: 'string', required: true, isKey: true, placeholder: 'Web-Server' },
    { name: 'Ensure', description: 'Present or Absent', type: 'string', required: false, isKey: false, enumValues: ['Present', 'Absent'], defaultValue: 'Present' },
    { name: 'IncludeAllSubFeature', description: 'Include all sub-features', type: 'boolean', required: false, isKey: false, defaultValue: false },
    { name: 'Source', description: 'SxS source path for offline install', type: 'string', required: false, isKey: false },
  ],
};
