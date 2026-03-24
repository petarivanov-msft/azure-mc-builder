import { ResourceSchema } from '../../types';

export const serviceSchema: ResourceSchema = {
  resourceName: 'Service',
  moduleName: 'PSDscResources',
  moduleVersion: '2.12.0.0',
  mofClassName: 'MSFT_ServiceResource',
  dscV3TypeName: 'PSDscResources/Service',
  platform: 'Windows',
  description: 'Manage Windows services (start, stop, configure startup type)',
  docUrl: 'https://learn.microsoft.com/powershell/dsc/reference/psdscresources/resources/service/service',
  category: 'System',
  properties: [
    { name: 'Name', description: 'Service name (not display name)', type: 'string', required: true, isKey: true, placeholder: 'wuauserv' },
    { name: 'Ensure', description: 'Present or Absent', type: 'string', required: false, isKey: false, enumValues: ['Present', 'Absent'], defaultValue: 'Present' },
    { name: 'State', description: 'Desired service state', type: 'string', required: false, isKey: false, enumValues: ['Running', 'Stopped', 'Ignore'], defaultValue: 'Running' },
    { name: 'StartupType', description: 'Service startup type', type: 'string', required: false, isKey: false, enumValues: ['Automatic', 'Manual', 'Disabled'] },
    { name: 'BuiltInAccount', description: 'Account to run the service under', type: 'string', required: false, isKey: false, enumValues: ['LocalSystem', 'LocalService', 'NetworkService'] },
    { name: 'Path', description: 'Path to the service executable', type: 'string', required: false, isKey: false },
    { name: 'DisplayName', description: 'Service display name', type: 'string', required: false, isKey: false },
    { name: 'Description', description: 'Service description', type: 'string', required: false, isKey: false },
    { name: 'Dependencies', description: 'Service dependencies', type: 'string[]', required: false, isKey: false },
    { name: 'DesktopInteract', description: 'Allow desktop interaction', type: 'boolean', required: false, isKey: false, defaultValue: false },
    { name: 'StartupTimeout', description: 'Start timeout in milliseconds', type: 'integer', required: false, isKey: false, defaultValue: 30000 },
    { name: 'TerminateTimeout', description: 'Stop timeout in milliseconds', type: 'integer', required: false, isKey: false, defaultValue: 30000 },
  ],
};
