import { ResourceSchema } from '../../types';

export const accountPolicySchema: ResourceSchema = {
  resourceName: 'AccountPolicy',
  moduleName: 'SecurityPolicyDsc',
  moduleVersion: '2.10.0.0',
  mofClassName: 'MSFT_AccountPolicy',
  dscV3TypeName: 'SecurityPolicyDsc/AccountPolicy',
  platform: 'Windows',
  description: 'Configure account policies (password, lockout, Kerberos) via secedit',
  docUrl: 'https://github.com/dsccommunity/SecurityPolicyDsc',
  category: 'Security Policy',
  properties: [
    { name: 'Name', description: 'Unique identifier for this policy set', type: 'string', required: true, isKey: true, placeholder: 'AccountPolicySettings' },
    { name: 'Enforce_password_history', description: 'Number of unique passwords remembered (0-24)', type: 'integer', required: false, isKey: false, placeholder: '24' },
    { name: 'Maximum_Password_Age', description: 'Maximum password age in days (0-999)', type: 'integer', required: false, isKey: false },
    { name: 'Minimum_Password_Age', description: 'Minimum password age in days (0-998)', type: 'integer', required: false, isKey: false },
    { name: 'Minimum_Password_Length', description: 'Minimum password length (0-14)', type: 'integer', required: false, isKey: false },
    { name: 'Password_must_meet_complexity_requirements', description: 'Require password complexity', type: 'string', required: false, isKey: false, enumValues: ['Enabled', 'Disabled'] },
    { name: 'Store_passwords_using_reversible_encryption', description: 'Store passwords using reversible encryption', type: 'string', required: false, isKey: false, enumValues: ['Enabled', 'Disabled'] },
    { name: 'Account_lockout_duration', description: 'Minutes account remains locked (0-99999)', type: 'integer', required: false, isKey: false },
    { name: 'Account_lockout_threshold', description: 'Failed logon attempts before lockout (0-999)', type: 'integer', required: false, isKey: false },
    { name: 'Reset_account_lockout_counter_after', description: 'Minutes before lockout counter resets (1-99999)', type: 'integer', required: false, isKey: false },
  ],
};
