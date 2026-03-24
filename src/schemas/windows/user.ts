import { ResourceSchema } from '../../types';

export const userSchema: ResourceSchema = {
  resourceName: 'User',
  moduleName: 'PSDscResources',
  moduleVersion: '2.12.0.0',
  mofClassName: 'MSFT_UserResource',
  dscV3TypeName: 'PSDscResources/User',
  platform: 'Windows',
  description: 'Manage local user accounts',
  docUrl: 'https://learn.microsoft.com/powershell/dsc/reference/psdscresources/resources/user/user',
  category: 'Identity',
  properties: [
    { name: 'UserName', description: 'User account name', type: 'string', required: true, isKey: true, placeholder: 'AppServiceUser' },
    { name: 'Ensure', description: 'Present or Absent', type: 'string', required: false, isKey: false, enumValues: ['Present', 'Absent'], defaultValue: 'Present' },
    { name: 'FullName', description: 'Full name of the user', type: 'string', required: false, isKey: false },
    { name: 'Description', description: 'User description', type: 'string', required: false, isKey: false },
    { name: 'Password', description: 'Password (PSCredential in DSC — entered as string here for the MOF)', type: 'string', required: false, isKey: false },
    { name: 'Disabled', description: 'Account is disabled', type: 'boolean', required: false, isKey: false, defaultValue: false },
    { name: 'PasswordNeverExpires', description: 'Password never expires', type: 'boolean', required: false, isKey: false, defaultValue: false },
    { name: 'PasswordChangeRequired', description: 'User must change password at next logon', type: 'boolean', required: false, isKey: false, defaultValue: false },
    { name: 'PasswordChangeNotAllowed', description: 'User cannot change password', type: 'boolean', required: false, isKey: false, defaultValue: false },
  ],
};
