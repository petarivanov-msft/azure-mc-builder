import { ResourceSchema } from '../../types';

export const nxSysctlSchema: ResourceSchema = {
  resourceName: 'nxSysctl',
  moduleName: 'nxtools',
  moduleVersion: '1.6.0',
  mofClassName: 'nxSysctl',
  dscV3TypeName: 'nxtools/nxSysctl',
  platform: 'Linux',
  description: 'Manage Linux kernel parameters (sysctl.conf)',
  docUrl: 'https://github.com/Azure/nxtools#readme',
  category: 'System',
  properties: [
    { name: 'Key', description: 'Sysctl parameter name', type: 'string', required: true, isKey: true, placeholder: 'net.ipv4.ip_forward' },
    { name: 'Value', description: 'Desired parameter value', type: 'string', required: true, isKey: false, placeholder: '1' },
    { name: 'Ensure', description: 'Whether the parameter should be set', type: 'string', required: false, isKey: false, enumValues: ['Present', 'Absent'], defaultValue: 'Present' },
    { name: 'FilePath', description: 'Sysctl config file path (default: /etc/sysctl.conf)', type: 'string', required: false, isKey: false, placeholder: '/etc/sysctl.d/99-custom.conf' },
  ],
};
