import { ConfigurationState } from '../types';
import { v4 as uuidv4 } from 'uuid';

/** Windows Audit Policy Baseline — CIS-aligned audit settings */
export const windowsAuditPolicy: ConfigurationState = {
  configName: 'WindowsAuditPolicyBaseline',
  platform: 'Windows',
  mode: 'Audit',
  version: '1.0.0',
  description: 'CIS-aligned audit policy settings for Windows Server — covers logon, account management, policy changes, and system events',
  resources: [
    { id: uuidv4(), schemaName: 'AuditPolicySubcategory', instanceName: 'AuditLogonSuccess',
      properties: { Name: 'Logon', AuditFlag: 'Success', Ensure: 'Present' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'AuditPolicySubcategory', instanceName: 'AuditLogonFailure',
      properties: { Name: 'Logon', AuditFlag: 'Failure', Ensure: 'Present' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'AuditPolicySubcategory', instanceName: 'AuditAccountManagement',
      properties: { Name: 'User Account Management', AuditFlag: 'Success', Ensure: 'Present' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'AuditPolicySubcategory', instanceName: 'AuditPolicyChange',
      properties: { Name: 'Audit Policy Change', AuditFlag: 'Success', Ensure: 'Present' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'AuditPolicySubcategory', instanceName: 'AuditSystemIntegrity',
      properties: { Name: 'System Integrity', AuditFlag: 'Success', Ensure: 'Present' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'AuditPolicySubcategory', instanceName: 'AuditSecurityGroupMgmt',
      properties: { Name: 'Security Group Management', AuditFlag: 'Success', Ensure: 'Present' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'AuditPolicySubcategory', instanceName: 'AuditProcessCreation',
      properties: { Name: 'Process Creation', AuditFlag: 'Success', Ensure: 'Present' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'AuditPolicyOption', instanceName: 'CrashOnAuditFail',
      properties: { Name: 'CrashOnAuditFail', Value: 'Disabled' }, dependsOn: [] },
  ],
};
