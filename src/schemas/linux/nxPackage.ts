import { ResourceSchema } from '../../types';

export const nxPackageSchema: ResourceSchema = {
  resourceName: 'nxPackage',
  moduleName: 'nxtools',
  moduleVersion: '1.6.0',
  mofClassName: 'nxPackage',
  dscV3TypeName: 'nxtools/nxPackage',
  platform: 'Linux',
  description: 'Manage packages using the system package manager (apt, yum, dnf)',
  docUrl: 'https://github.com/Azure/nxtools#readme',
  category: 'File & Package',
  properties: [
    { name: 'Name', description: 'Package name', type: 'string', required: true, isKey: true, placeholder: 'nginx' },
    { name: 'Ensure', description: 'Whether the package should be installed', type: 'string', required: false, isKey: false, enumValues: ['Present', 'Absent'], defaultValue: 'Present' },
    { name: 'Version', description: 'Specific version to ensure', type: 'string', required: false, isKey: false },
    { name: 'PackageType', description: 'Package manager type (apt, yum, dnf, zypper)', type: 'string', required: false, isKey: false },
  ],
};
