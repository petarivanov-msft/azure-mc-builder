import { ResourceSchema } from '../../types';

export const timeZoneSchema: ResourceSchema = {
  resourceName: 'TimeZone',
  moduleName: 'ComputerManagementDsc',
  moduleVersion: '9.2.0',
  mofClassName: 'DSC_TimeZone',
  dscV3TypeName: 'ComputerManagementDsc/TimeZone',
  platform: 'Windows',
  description: 'Set the Windows system time zone',
  docUrl: 'https://github.com/dsccommunity/ComputerManagementDsc/wiki/TimeZone',
  category: 'System',
  properties: [
    { name: 'IsSingleInstance', description: 'Must be Yes (singleton resource)', type: 'string', required: true, isKey: true, enumValues: ['Yes'], defaultValue: 'Yes' },
    { name: 'TimeZone', description: 'Time zone ID (e.g., GMT Standard Time, Pacific Standard Time)', type: 'string', required: true, isKey: false, placeholder: 'GMT Standard Time' },
  ],
};
