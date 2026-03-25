import { describe, it, expect } from 'vitest';
import { generatePolicyJson } from '../policyGenerator';
import { ConfigurationState } from '../../types';

function makeConfig(overrides: Partial<ConfigurationState> = {}): ConfigurationState {
  return {
    configName: 'TestConfig',
    platform: 'Windows',
    mode: 'Audit',
    version: '1.0.0',
    description: 'Test description',
    resources: [],
    ...overrides,
  } as ConfigurationState;
}

describe('policyGenerator', () => {
  describe('Audit mode', () => {
    it('generates AuditIfNotExists effect', () => {
      const policy = generatePolicyJson(makeConfig({ mode: 'Audit' })) as any;
      expect(policy.properties.policyRule.then.effect).toBe('auditIfNotExists');
    });

    it('does not include deployment block', () => {
      const policy = generatePolicyJson(makeConfig({ mode: 'Audit' })) as any;
      expect(policy.properties.policyRule.then.details.deployment).toBeUndefined();
    });

    it('does not include roleDefinitionIds', () => {
      const policy = generatePolicyJson(makeConfig({ mode: 'Audit' })) as any;
      expect(policy.properties.policyRule.then.details.roleDefinitionIds).toBeUndefined();
    });

    it('sets correct config name in details', () => {
      const policy = generatePolicyJson(makeConfig({ mode: 'Audit', configName: 'MyAudit' })) as any;
      expect(policy.properties.policyRule.then.details.name).toBe('MyAudit');
    });

    it('filters for Windows OS type', () => {
      const policy = generatePolicyJson(makeConfig({ mode: 'Audit', platform: 'Windows' })) as any;
      const vmCondition = policy.properties.policyRule.if.anyOf[0].allOf[1].anyOf[0];
      expect(vmCondition.like).toBe('Windows*');
    });

    it('filters for Linux OS type', () => {
      const policy = generatePolicyJson(makeConfig({ mode: 'Audit', platform: 'Linux' })) as any;
      const vmCondition = policy.properties.policyRule.if.anyOf[0].allOf[1].anyOf[0];
      expect(vmCondition.like).toBe('Linux*');
    });
  });

  describe('AuditAndSet (remediation) mode', () => {
    it('generates DeployIfNotExists effect', () => {
      const policy = generatePolicyJson(makeConfig({ mode: 'AuditAndSet' })) as any;
      expect(policy.properties.policyRule.then.effect).toBe('deployIfNotExists');
    });

    it('includes roleDefinitionIds with Contributor role', () => {
      const policy = generatePolicyJson(makeConfig({ mode: 'AuditAndSet' })) as any;
      const roleIds = policy.properties.policyRule.then.details.roleDefinitionIds;
      expect(roleIds).toContain(
        '/providers/microsoft.authorization/roleDefinitions/b24988ac-6180-42a0-ab88-20f7382dd24c'
      );
    });

    it('includes deployment block with ARM template', () => {
      const policy = generatePolicyJson(makeConfig({ mode: 'AuditAndSet' })) as any;
      const deployment = policy.properties.policyRule.then.details.deployment;
      expect(deployment).toBeDefined();
      expect(deployment.properties.mode).toBe('incremental');
      expect(deployment.properties.template.$schema).toContain('deploymentTemplate.json');
    });

    it('deploys guestConfigurationAssignment with ApplyAndAutoCorrect', () => {
      const policy = generatePolicyJson(makeConfig({ mode: 'AuditAndSet' })) as any;
      const resources = policy.properties.policyRule.then.details.deployment.properties.template.resources;
      const gcAssignment = resources.find((r: any) =>
        r.type === 'Microsoft.Compute/virtualMachines/providers/guestConfigurationAssignments'
      );
      expect(gcAssignment).toBeDefined();
      expect(gcAssignment.properties.guestConfiguration.assignmentType).toBe('ApplyAndAutoCorrect');
    });

    it('deploys system-assigned managed identity on VM', () => {
      const policy = generatePolicyJson(makeConfig({ mode: 'AuditAndSet' })) as any;
      const resources = policy.properties.policyRule.then.details.deployment.properties.template.resources;
      const vmResource = resources.find((r: any) => r.type === 'Microsoft.Compute/virtualMachines');
      expect(vmResource).toBeDefined();
      expect(vmResource.identity.type).toBe('SystemAssigned');
    });

    it('deploys Windows MC extension for Windows platform', () => {
      const policy = generatePolicyJson(makeConfig({ mode: 'AuditAndSet', platform: 'Windows' })) as any;
      const resources = policy.properties.policyRule.then.details.deployment.properties.template.resources;
      const ext = resources.find((r: any) => r.type === 'Microsoft.Compute/virtualMachines/extensions');
      expect(ext).toBeDefined();
      expect(ext.properties.type).toBe('ConfigurationforWindows');
      expect(ext.name).toContain('AzurePolicyforWindows');
    });

    it('deploys Linux MC extension for Linux platform', () => {
      const policy = generatePolicyJson(makeConfig({ mode: 'AuditAndSet', platform: 'Linux' })) as any;
      const resources = policy.properties.policyRule.then.details.deployment.properties.template.resources;
      const ext = resources.find((r: any) => r.type === 'Microsoft.Compute/virtualMachines/extensions');
      expect(ext).toBeDefined();
      expect(ext.properties.type).toBe('ConfigurationforLinux');
      expect(ext.name).toContain('AzurePolicyforLinux');
    });

    it('uses typeHandlerVersion 1.* for auto-upgrade compatibility', () => {
      const policy = generatePolicyJson(makeConfig({ mode: 'AuditAndSet' })) as any;
      const resources = policy.properties.policyRule.then.details.deployment.properties.template.resources;
      const ext = resources.find((r: any) => r.type === 'Microsoft.Compute/virtualMachines/extensions');
      expect(ext.properties.typeHandlerVersion).toBe('1.*');
    });

    it('includes contentUri and contentHash as template parameters', () => {
      const policy = generatePolicyJson(makeConfig({ mode: 'AuditAndSet' })) as any;
      const params = policy.properties.policyRule.then.details.deployment.properties.parameters;
      expect(params.contentUri.value).toBe('{{contentUri}}');
      expect(params.contentHash.value).toBe('{{contentHash}}');
    });

    it('emits empty configurationParameter for configs with no resource properties', () => {
      const policy = generatePolicyJson(makeConfig({ mode: 'AuditAndSet', resources: [] })) as any;
      const resources = policy.properties.policyRule.then.details.deployment.properties.template.resources;
      const gcAssignment = resources.find((r: any) =>
        r.type === 'Microsoft.Compute/virtualMachines/providers/guestConfigurationAssignments'
      );
      expect(gcAssignment.properties.guestConfiguration.configurationParameter).toEqual([]);
    });

    it('emits configurationParameter entries for resources with properties', () => {
      const config = makeConfig({
        mode: 'AuditAndSet',
        resources: [
          {
            id: 'r1',
            schemaName: 'Registry',
            instanceName: 'TestKey',
            properties: { ValueName: 'MyVal', ValueData: 'Hello' },
            dependsOn: [],
          },
        ],
      });
      const policy = generatePolicyJson(config) as any;
      const resources = policy.properties.policyRule.then.details.deployment.properties.template.resources;
      const gcAssignment = resources.find((r: any) =>
        r.type === 'Microsoft.Compute/virtualMachines/providers/guestConfigurationAssignments'
      );
      const params = gcAssignment.properties.guestConfiguration.configurationParameter;
      expect(params.length).toBe(2);
      expect(params[0].name).toBe('[Registry]TestKey;ValueName');
      expect(params[0].value).toBe('MyVal');
      expect(params[1].name).toBe('[Registry]TestKey;ValueData');
      expect(params[1].value).toBe('Hello');
    });

    it('includes parameterHash in existenceCondition when parameters exist', () => {
      const config = makeConfig({
        mode: 'AuditAndSet',
        resources: [
          {
            id: 'r1',
            schemaName: 'Registry',
            instanceName: 'TestKey',
            properties: { ValueData: 'Hello' },
            dependsOn: [],
          },
        ],
      });
      const policy = generatePolicyJson(config) as any;
      const ec = policy.properties.policyRule.then.details.existenceCondition;
      expect(ec.allOf.length).toBe(2);
      expect(ec.allOf[1].field).toBe(
        'Microsoft.GuestConfiguration/guestConfigurationAssignments/parameterHash'
      );
    });

    it('omits parameterHash from existenceCondition when no parameters', () => {
      const policy = generatePolicyJson(makeConfig({ mode: 'AuditAndSet', resources: [] })) as any;
      const ec = policy.properties.policyRule.then.details.existenceCondition;
      expect(ec.allOf.length).toBe(1);
      expect(ec.allOf[0].field).toContain('complianceStatus');
    });
  });

  describe('shared metadata', () => {
    it('sets Guest Configuration category', () => {
      const policy = generatePolicyJson(makeConfig()) as any;
      expect(policy.properties.metadata.category).toBe('Guest Configuration');
    });

    it('includes guestConfiguration metadata block', () => {
      const policy = generatePolicyJson(makeConfig({ configName: 'Foo', version: '2.0.0' })) as any;
      const gc = policy.properties.metadata.guestConfiguration;
      expect(gc.name).toBe('Foo');
      expect(gc.version).toBe('2.0.0');
      expect(gc.contentType).toBe('Custom');
    });

    it('includes Arc machine support in if condition', () => {
      const policy = generatePolicyJson(makeConfig()) as any;
      const arcCondition = policy.properties.policyRule.if.anyOf[1].allOf[0];
      expect(arcCondition.equals).toBe('Microsoft.HybridCompute/machines');
    });
  });
});
