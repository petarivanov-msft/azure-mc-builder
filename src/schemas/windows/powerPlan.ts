import { ResourceSchema } from '../../types';

export const powerPlanSchema: ResourceSchema = {
  resourceName: 'PowerPlan',
  moduleName: 'ComputerManagementDsc',
  moduleVersion: '9.2.0',
  mofClassName: 'DSC_PowerPlan',
  dscV3TypeName: 'ComputerManagementDsc/PowerPlan',
  platform: 'Windows',
  description: 'Set the active Windows power plan',
  docUrl: 'https://github.com/dsccommunity/ComputerManagementDsc/wiki/PowerPlan',
  category: 'System',
  properties: [
    { name: 'IsSingleInstance', description: 'Must be Yes (singleton resource)', type: 'string', required: true, isKey: true, enumValues: ['Yes'], defaultValue: 'Yes' },
    { name: 'Name', description: 'Power plan name', type: 'string', required: true, isKey: false, placeholder: 'High performance' },
  ],
};
