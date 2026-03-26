import { ResourceSchema } from '../../types';

export const nxUserSchema: ResourceSchema = {
  resourceName: 'nxUser',
  moduleName: 'nxtools',
  moduleVersion: '1.6.0',
  mofClassName: 'nxUser',
  dscV3TypeName: 'nxtools/nxUser',
  platform: 'Linux',
  description: 'Manage local user accounts on Linux',
  docUrl: 'https://github.com/Azure/nxtools#readme',
  category: 'Identity',
  properties: [
    { name: 'UserName', description: 'Username to manage', type: 'string', required: true, isKey: true, placeholder: 'appuser' },
    { name: 'Ensure', description: 'Whether the user should exist', type: 'string', required: false, isKey: false, enumValues: ['Present', 'Absent'], defaultValue: 'Present' },
    { name: 'FullName', description: 'Full name (GECOS field)', type: 'string', required: false, isKey: false },
    { name: 'Description', description: 'User description', type: 'string', required: false, isKey: false },
    { name: 'Password', description: 'Hashed password string', type: 'string', required: false, isKey: false },
    { name: 'Disabled', description: 'Whether the account is disabled', type: 'boolean', required: false, isKey: false },
    { name: 'HomeDirectory', description: 'Home directory path', type: 'string', required: false, isKey: false, placeholder: '/home/appuser' },
    { name: 'GroupID', description: 'Primary group ID', type: 'string', required: false, isKey: false },
  ],
};
