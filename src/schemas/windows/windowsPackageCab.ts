import { ResourceSchema } from '../../types';

export const windowsPackageCabSchema: ResourceSchema = {
  resourceName: 'WindowsPackageCab',
  moduleName: 'PSDscResources',
  moduleVersion: '2.12.0.0',
  mofClassName: 'MSFT_WindowsPackageCab',
  dscV3TypeName: 'PSDscResources/WindowsPackageCab',
  platform: 'Windows',
  description: 'Install or uninstall Windows CAB packages',
  docUrl: 'https://learn.microsoft.com/powershell/dsc/reference/psdscresources/resources/windowspackagecab/windowspackagecab',
  category: 'File & Package',
  properties: [
    { name: 'Name', description: 'Package name', type: 'string', required: true, isKey: true, placeholder: 'Package_for_KB1234567' },
    { name: 'SourcePath', description: 'Path to the CAB file', type: 'string', required: true, isKey: false, placeholder: 'C:\\Updates\\kb1234567.cab' },
    { name: 'Ensure', description: 'Present or Absent', type: 'string', required: false, isKey: false, enumValues: ['Present', 'Absent'], defaultValue: 'Present' },
    { name: 'LogPath', description: 'Path to log file', type: 'string', required: false, isKey: false },
  ],
};
