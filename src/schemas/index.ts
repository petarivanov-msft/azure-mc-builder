import { ResourceSchema, Platform } from '../types';

// Windows — Built-in (PSDscResources)
import { environmentSchema } from './windows/environment';
import { msiPackageSchema } from './windows/msiPackage';
import { registrySchema } from './windows/registry';
import { scriptSchema } from './windows/script';
import { serviceSchema } from './windows/service';
import { userSchema } from './windows/user';
import { windowsProcessSchema } from './windows/windowsProcess';

// Windows — SecurityPolicyDsc
import { accountPolicySchema } from './windows/accountPolicy';
import { userRightsAssignmentSchema } from './windows/userRightsAssignment';
import { securityOptionSchema } from './windows/securityOption';

// Windows — AuditPolicyDsc
import { auditPolicySubcategorySchema } from './windows/auditPolicySubcategory';
import { auditPolicyOptionSchema } from './windows/auditPolicyOption';

// Windows — NetworkingDsc
import { firewallSchema } from './windows/firewall';

// Windows — ComputerManagementDsc
import { scheduledTaskSchema } from './windows/scheduledTask';
import { timeZoneSchema } from './windows/timeZone';
import { powerPlanSchema } from './windows/powerPlan';

// Linux
import { nxFileSchema } from './linux/nxFile';
import { nxGroupSchema } from './linux/nxGroup';
import { nxUserSchema } from './linux/nxUser';
import { nxPackageSchema } from './linux/nxPackage';
import { nxFileLineSchema } from './linux/nxFileLine';
import { nxFileContentReplaceSchema } from './linux/nxFileContentReplace';
import { nxServiceSchema } from './linux/nxService';
import { nxScriptSchema } from './linux/nxScript';

export const allSchemas: ResourceSchema[] = [
  // Windows — Built-in (PSDscResources)
  environmentSchema, msiPackageSchema,
  registrySchema, scriptSchema, serviceSchema, userSchema,
  windowsProcessSchema,
  // Windows — SecurityPolicyDsc
  accountPolicySchema, userRightsAssignmentSchema, securityOptionSchema,
  // Windows — AuditPolicyDsc
  auditPolicySubcategorySchema, auditPolicyOptionSchema,
  // Windows — NetworkingDsc
  firewallSchema,
  // Windows — ComputerManagementDsc
  scheduledTaskSchema, timeZoneSchema, powerPlanSchema,
  // Linux
  nxFileSchema, nxGroupSchema, nxUserSchema, nxPackageSchema,
  nxFileLineSchema, nxFileContentReplaceSchema, nxServiceSchema, nxScriptSchema,
];

export const schemasByName: Record<string, ResourceSchema> = Object.fromEntries(
  allSchemas.map(s => [s.resourceName, s])
);

export function getSchemasForPlatform(platform: Platform): ResourceSchema[] {
  return allSchemas.filter(s => s.platform === platform);
}

export interface CategoryGroup {
  category: string;
  schemas: ResourceSchema[];
}

export function getSchemasByCategory(platform: Platform): CategoryGroup[] {
  const schemas = getSchemasForPlatform(platform);
  const categoryOrder = [
    'System', 'Identity', 'Roles & Features', 'File & Package',
    'Security Policy', 'Audit Policy', 'Networking',
    'File System', 'Custom',
  ];
  const grouped = new Map<string, ResourceSchema[]>();

  for (const s of schemas) {
    const list = grouped.get(s.category) || [];
    list.push(s);
    grouped.set(s.category, list);
  }

  return categoryOrder
    .filter(c => grouped.has(c))
    .map(c => ({ category: c, schemas: grouped.get(c)! }));
}

// Re-export individual schemas
export {
  // Windows — Built-in
  environmentSchema, msiPackageSchema,
  registrySchema, scriptSchema, serviceSchema, userSchema,
  windowsProcessSchema,
  // Windows — SecurityPolicyDsc
  accountPolicySchema, userRightsAssignmentSchema, securityOptionSchema,
  // Windows — AuditPolicyDsc
  auditPolicySubcategorySchema, auditPolicyOptionSchema,
  // Windows — NetworkingDsc
  firewallSchema,
  // Windows — ComputerManagementDsc
  scheduledTaskSchema, timeZoneSchema, powerPlanSchema,
  // Linux
  nxFileSchema, nxGroupSchema, nxUserSchema, nxPackageSchema,
  nxFileLineSchema, nxFileContentReplaceSchema, nxServiceSchema, nxScriptSchema,
};
