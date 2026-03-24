import { ResourceSchema } from '../../types';

export const msiPackageSchema: ResourceSchema = {
  resourceName: 'MsiPackage',
  moduleName: 'PSDscResources',
  moduleVersion: '2.12.0.0',
  mofClassName: 'MSFT_MsiPackage',
  dscV3TypeName: 'PSDscResources/MsiPackage',
  platform: 'Windows',
  description: 'Install or uninstall MSI packages',
  docUrl: 'https://learn.microsoft.com/powershell/dsc/reference/psdscresources/resources/msipackage/msipackage',
  category: 'File & Package',
  properties: [
    { name: 'ProductId', description: 'MSI product ID (GUID)', type: 'string', required: true, isKey: true, placeholder: '{12345678-1234-1234-1234-123456789012}', validationPattern: '^\\{?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\\}?$', validationMessage: 'ProductId must be a valid GUID (e.g. {12345678-1234-1234-1234-123456789012})' },
    { name: 'Path', description: 'Path or URL to the MSI file', type: 'string', required: true, isKey: false, placeholder: 'C:\\Installers\\app.msi' },
    { name: 'Ensure', description: 'Present or Absent', type: 'string', required: false, isKey: false, enumValues: ['Present', 'Absent'], defaultValue: 'Present' },
    { name: 'Arguments', description: 'Additional MSI arguments', type: 'string', required: false, isKey: false },
    { name: 'LogPath', description: 'Path to log file', type: 'string', required: false, isKey: false },
  ],
};
