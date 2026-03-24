import { ResourceSchema } from '../../types';

export const auditPolicyOptionSchema: ResourceSchema = {
  resourceName: 'AuditPolicyOption',
  moduleName: 'AuditPolicyDsc',
  moduleVersion: '1.4.0.0',
  mofClassName: 'MSFT_AuditPolicyOption',
  dscV3TypeName: 'AuditPolicyDsc/AuditPolicyOption',
  platform: 'Windows',
  description: 'Configure audit policy options (CrashOnAuditFail, FullPrivilegeAuditing, etc.)',
  docUrl: 'https://github.com/dsccommunity/AuditPolicyDsc',
  category: 'Audit Policy',
  properties: [
    { name: 'Name', description: 'Audit policy option name', type: 'string', required: true, isKey: true, enumValues: ['CrashOnAuditFail', 'FullPrivilegeAuditing', 'AuditBaseObjects', 'AuditBaseDirectories'] },
    { name: 'Value', description: 'Option value', type: 'string', required: true, isKey: true, enumValues: ['Enabled', 'Disabled'] },
  ],
};
