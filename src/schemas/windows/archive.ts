import { ResourceSchema } from '../../types';

export const archiveSchema: ResourceSchema = {
  resourceName: 'Archive',
  moduleName: 'PSDscResources',
  moduleVersion: '2.12.0.0',
  mofClassName: 'MSFT_ArchiveResource',
  dscV3TypeName: 'PSDscResources/Archive',
  platform: 'Windows',
  description: 'Extract ZIP archives to a target directory',
  docUrl: 'https://learn.microsoft.com/powershell/dsc/reference/psdscresources/resources/archive/archive',
  category: 'File & Package',
  properties: [
    { name: 'Path', description: 'Path to the ZIP archive', type: 'string', required: true, isKey: true, placeholder: 'C:\\Archives\\app.zip' },
    { name: 'Destination', description: 'Extraction destination directory', type: 'string', required: true, isKey: true, placeholder: 'C:\\Program Files\\MyApp' },
    { name: 'Ensure', description: 'Present or Absent', type: 'string', required: false, isKey: false, enumValues: ['Present', 'Absent'], defaultValue: 'Present' },
    { name: 'Validate', description: 'Validate archive checksum', type: 'boolean', required: false, isKey: false, defaultValue: false },
    { name: 'Checksum', description: 'Checksum algorithm to validate', type: 'string', required: false, isKey: false, enumValues: ['SHA-1', 'SHA-256', 'SHA-512', 'CreatedDate', 'ModifiedDate'] },
    { name: 'Force', description: 'Overwrite existing files', type: 'boolean', required: false, isKey: false, defaultValue: false },
  ],
};
