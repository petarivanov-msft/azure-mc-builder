import { ResourceSchema } from '../../types';

export const nxServiceSchema: ResourceSchema = {
  resourceName: 'nxService',
  moduleName: 'nxtools',
  moduleVersion: '1.6.0',
  mofClassName: 'nxService',
  dscV3TypeName: 'nxtools/nxService',
  platform: 'Linux',
  description: 'Manage Linux services (systemd, init, upstart)',
  docUrl: 'https://github.com/Azure/nxtools#readme',
  category: 'System',
  properties: [
    { name: 'Name', description: 'Service name', type: 'string', required: true, isKey: true, placeholder: 'sshd' },
    { name: 'Enabled', description: 'Service is enabled at boot', type: 'boolean', required: false, isKey: false, defaultValue: true },
    { name: 'State', description: 'Desired service state', type: 'string', required: false, isKey: false, enumValues: ['Running', 'Stopped'], defaultValue: 'Running' },
    { name: 'Controller', description: 'Service controller type', type: 'string', required: false, isKey: false, enumValues: ['systemd', 'init', 'upstart'] },
  ],
};
