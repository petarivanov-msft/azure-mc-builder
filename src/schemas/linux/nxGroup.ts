import { ResourceSchema } from '../../types';

export const nxGroupSchema: ResourceSchema = {
  resourceName: 'nxGroup',
  moduleName: 'nxtools',
  moduleVersion: '1.6.0',
  mofClassName: 'nxGroup',
  dscV3TypeName: 'nxtools/nxGroup',
  platform: 'Linux',
  description: 'Manage local groups on Linux',
  docUrl: 'https://github.com/Azure/nxtools#readme',
  category: 'Identity',
  properties: [
    { name: 'GroupName', description: 'Name of the group', type: 'string', required: true, isKey: true, placeholder: 'docker' },
    { name: 'Ensure', description: 'Whether the group should exist', type: 'string', required: false, isKey: false, enumValues: ['Present', 'Absent'], defaultValue: 'Present' },
    { name: 'Members', description: 'Exact list of group members (replaces all)', type: 'string[]', required: false, isKey: false },
    { name: 'MembersToInclude', description: 'Users to add to the group', type: 'string[]', required: false, isKey: false },
    { name: 'MembersToExclude', description: 'Users to remove from the group', type: 'string[]', required: false, isKey: false },
    { name: 'PreferredGroupID', description: 'Preferred GID for the group', type: 'string', required: false, isKey: false },
    { name: 'Force', description: 'Force changes even if it removes existing members', type: 'boolean', required: false, isKey: false, defaultValue: false },
  ],
};
