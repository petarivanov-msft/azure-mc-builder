import { ResourceSchema } from '../../types';

export const windowsOptionalFeatureSchema: ResourceSchema = {
  resourceName: 'WindowsOptionalFeature',
  moduleName: 'PSDscResources',
  moduleVersion: '2.12.0.0',
  mofClassName: 'MSFT_WindowsOptionalFeature',
  dscV3TypeName: 'PSDscResources/WindowsOptionalFeature',
  platform: 'Windows',
  description: 'Enable or disable Windows optional features (client OS)',
  docUrl: 'https://learn.microsoft.com/powershell/dsc/reference/psdscresources/resources/windowsoptionalfeature/windowsoptionalfeature',
  category: 'Roles & Features',
  properties: [
    { name: 'Name', description: 'Feature name (e.g., Microsoft-Hyper-V-All)', type: 'string', required: true, isKey: true, placeholder: 'Microsoft-Hyper-V-All' },
    { name: 'Ensure', description: 'Present (Enable) or Absent (Disable)', type: 'string', required: false, isKey: false, enumValues: ['Present', 'Absent'], defaultValue: 'Present' },
    { name: 'NoWindowsUpdateCheck', description: 'Do not use Windows Update for source files', type: 'boolean', required: false, isKey: false, defaultValue: false },
    { name: 'RemoveFilesOnDisable', description: 'Remove files when disabling', type: 'boolean', required: false, isKey: false, defaultValue: false },
    { name: 'Source', description: 'SxS source path for offline install', type: 'string[]', required: false, isKey: false },
    { name: 'LogPath', description: 'Path to log file', type: 'string', required: false, isKey: false },
  ],
};
