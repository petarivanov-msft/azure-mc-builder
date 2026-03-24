import { ResourceSchema } from '../../types';

export const groupSchema: ResourceSchema = {
  resourceName: 'Group',
  moduleName: 'PSDscResources',
  moduleVersion: '2.12.0.0',
  mofClassName: 'MSFT_GroupResource',
  dscV3TypeName: 'PSDscResources/Group',
  platform: 'Windows',
  description: 'Manage local groups and membership',
  docUrl: 'https://learn.microsoft.com/powershell/dsc/reference/psdscresources/resources/group/group',
  category: 'Identity',
  properties: [
    { name: 'GroupName', description: 'Name of the local group', type: 'string', required: true, isKey: true, placeholder: 'Administrators' },
    { name: 'Ensure', description: 'Present or Absent', type: 'string', required: false, isKey: false, enumValues: ['Present', 'Absent'], defaultValue: 'Present' },
    { name: 'Description', description: 'Group description', type: 'string', required: false, isKey: false },
    { name: 'Members', description: 'Exact group membership (replaces all)', type: 'string[]', required: false, isKey: false },
    { name: 'MembersToInclude', description: 'Members to add (additive)', type: 'string[]', required: false, isKey: false },
    { name: 'MembersToExclude', description: 'Members to remove', type: 'string[]', required: false, isKey: false },
  ],
};
