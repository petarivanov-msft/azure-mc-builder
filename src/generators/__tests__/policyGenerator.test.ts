/* eslint-disable @typescript-eslint/no-explicit-any */
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

    it('includes roleDefinitionIds with Guest Configuration Resource Contributor role', () => {
      const policy = generatePolicyJson(makeConfig({ mode: 'AuditAndSet' })) as any;
      const roleIds = policy.properties.policyRule.then.details.roleDefinitionIds;
      expect(roleIds).toContain(
        '/providers/Microsoft.Authorization/roleDefinitions/088ab73d-1256-47ae-bea9-9de8e7131f31'
      );
    });

    it('includes deployment block with ARM template', () => {
      const policy = generatePolicyJson(makeConfig({ mode: 'AuditAndSet' })) as any;
      const deployment = policy.properties.policyRule.then.details.deployment;
      expect(deployment).toBeDefined();
      expect(deployment.properties.mode).toBe('incremental');
      expect(deployment.properties.template.$schema).toContain('deploymentTemplate.json');
    });

    it('deploys VM guestConfigurationAssignment with ApplyAndAutoCorrect', () => {
      const policy = generatePolicyJson(makeConfig({ mode: 'AuditAndSet' })) as any;
      const resources = policy.properties.policyRule.then.details.deployment.properties.template.resources;
      const gcAssignment = resources.find((r: any) =>
        r.type === 'Microsoft.Compute/virtualMachines/providers/guestConfigurationAssignments'
      );
      expect(gcAssignment).toBeDefined();
      expect(gcAssignment.properties.guestConfiguration.assignmentType).toBe('ApplyAndAutoCorrect');
      expect(gcAssignment.condition).toContain('Microsoft.Compute/virtualMachines');
    });

    it('deploys Arc guestConfigurationAssignment with ApplyAndAutoCorrect', () => {
      const policy = generatePolicyJson(makeConfig({ mode: 'AuditAndSet' })) as any;
      const resources = policy.properties.policyRule.then.details.deployment.properties.template.resources;
      const arcAssignment = resources.find((r: any) =>
        r.type === 'Microsoft.HybridCompute/machines/providers/guestConfigurationAssignments'
      );
      expect(arcAssignment).toBeDefined();
      expect(arcAssignment.properties.guestConfiguration.assignmentType).toBe('ApplyAndAutoCorrect');
      expect(arcAssignment.condition).toContain('Microsoft.HybridCompute/machines');
    });

    it('does not deploy system-assigned managed identity (handled by prerequisite initiative)', () => {
      const policy = generatePolicyJson(makeConfig({ mode: 'AuditAndSet' })) as any;
      const resources = policy.properties.policyRule.then.details.deployment.properties.template.resources;
      const vmResource = resources.find((r: any) => r.type === 'Microsoft.Compute/virtualMachines');
      expect(vmResource).toBeUndefined();
    });

    it('passes resource type as template parameter', () => {
      const policy = generatePolicyJson(makeConfig({ mode: 'AuditAndSet' })) as any;
      const params = policy.properties.policyRule.then.details.deployment.properties.parameters;
      expect(params.type).toBeDefined();
      expect(params.type.value).toBe("[field('type')]");
    });

    it('does not deploy GC extension (handled by prerequisite initiative)', () => {
      const policy = generatePolicyJson(makeConfig({ mode: 'AuditAndSet', platform: 'Windows' })) as any;
      const resources = policy.properties.policyRule.then.details.deployment.properties.template.resources;
      const ext = resources.find((r: any) => r.type === 'Microsoft.Compute/virtualMachines/extensions');
      expect(ext).toBeUndefined();
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

    it('uses simple complianceStatus existenceCondition (matches MS cmdlet)', () => {
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
      expect(ec.field).toBe('Microsoft.GuestConfiguration/guestConfigurationAssignments/complianceStatus');
      expect(ec.equals).toBe('Compliant');
    });

    it('existenceCondition is simple complianceStatus check with no parameters too', () => {
      const policy = generatePolicyJson(makeConfig({ mode: 'AuditAndSet', resources: [] })) as any;
      const ec = policy.properties.policyRule.then.details.existenceCondition;
      expect(ec.field).toContain('complianceStatus');
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

  // ─── Edge Cases ───────────────────────────────────────────────────
  describe('edge cases', () => {
    it('generates valid policy for config with many resources', () => {
      const resources = Array.from({ length: 20 }, (_, i) => ({
        id: `r${i}`, schemaName: 'Registry', instanceName: `Reg${i}`,
        properties: { Key: `HKLM:\\SOFTWARE\\Test${i}`, ValueName: `Val${i}`, ValueType: 'Dword', ValueData: ['1'] },
        dependsOn: i > 0 ? [`r${i - 1}`] : [],
      }));
      const policy = generatePolicyJson(makeConfig({ resources })) as any;
      expect(policy.properties.policyRule.if.anyOf).toHaveLength(2);
      expect(policy.properties.metadata.guestConfiguration.name).toBe('TestConfig');
    });

    it('DINE policy has conditional resources for both VM and Arc', () => {
      const policy = generatePolicyJson(makeConfig({
        mode: 'AuditAndSet',
        resources: [{ id: '1', schemaName: 'Registry', instanceName: 'R1', properties: { Key: 'HKLM:\\Test', ValueName: 'V', ValueType: 'Dword', ValueData: ['1'] }, dependsOn: [] }],
      })) as any;
      const deployment = policy.properties.policyRule.then.details.deployment;
      const resources = deployment.properties.template.resources;
      const conditions = resources.map((r: any) => r.condition).filter(Boolean);
      expect(conditions.length).toBeGreaterThanOrEqual(2);
      expect(conditions.some((c: string) => c.includes('HybridCompute'))).toBe(true);
      expect(conditions.some((c: string) => c.includes('Compute/virtualMachines'))).toBe(true);
    });

    it('DINE policy uses API version 2024-04-05 for GC assignments', () => {
      const policy = generatePolicyJson(makeConfig({
        mode: 'AuditAndSet',
        resources: [{ id: '1', schemaName: 'Registry', instanceName: 'R1', properties: { Key: 'HKLM:\\Test', ValueName: 'V' }, dependsOn: [] }],
      })) as any;
      const resources = policy.properties.policyRule.then.details.deployment.properties.template.resources;
      const gcResources = resources.filter((r: any) => r.type?.includes('guestConfigurationAssignments'));
      for (const r of gcResources) {
        expect(r.apiVersion).toBe('2024-04-05');
      }
    });

    it('DINE policy contains GC assignment resources for VM, Arc, and VMSS', () => {
      const policy = generatePolicyJson(makeConfig({
        mode: 'AuditAndSet',
        resources: [{ id: '1', schemaName: 'Registry', instanceName: 'R1', properties: { Key: 'HKLM:\\Test', ValueName: 'V' }, dependsOn: [] }],
      })) as any;
      const resources = policy.properties.policyRule.then.details.deployment.properties.template.resources;
      expect(resources.length).toBe(3);
      const types = resources.map((r: any) => r.type);
      expect(types).toContain('Microsoft.Compute/virtualMachines/providers/guestConfigurationAssignments');
      expect(types).toContain('Microsoft.HybridCompute/machines/providers/guestConfigurationAssignments');
      expect(types).toContain('Microsoft.Compute/virtualMachineScaleSets/providers/guestConfigurationAssignments');
    });

    it('Audit policy targets correct OS for Linux', () => {
      const policy = generatePolicyJson(makeConfig({
        platform: 'Linux',
        resources: [{ id: '1', schemaName: 'nxFile', instanceName: 'F1', properties: { DestinationPath: '/etc/test' }, dependsOn: [] }],
      })) as any;
      const vmCondition = policy.properties.policyRule.if.anyOf[0].allOf[1].anyOf;
      const osMatch = vmCondition.find((c: any) => c.field?.includes('osType'));
      expect(osMatch.like).toBe('Linux*');
    });

    it('configurationParameter includes all resource parameters', () => {
      const policy = generatePolicyJson(makeConfig({
        mode: 'AuditAndSet',
        resources: [
          { id: '1', schemaName: 'Registry', instanceName: 'R1', properties: { Key: 'HKLM:\\A', ValueName: 'V1', ValueType: 'Dword', ValueData: ['1'], Ensure: 'Present' }, dependsOn: [] },
          { id: '2', schemaName: 'Registry', instanceName: 'R2', properties: { Key: 'HKLM:\\B', ValueName: 'V2', ValueType: 'String', ValueData: ['test'] }, dependsOn: ['1'] },
        ],
      })) as any;
      const resources = policy.properties.policyRule.then.details.deployment.properties.template.resources;
      const vmResource = resources.find((r: any) => r.type?.includes('virtualMachines/providers'));
      const configParam = vmResource.properties.guestConfiguration.configurationParameter;
      expect(configParam.length).toBeGreaterThan(0);
      expect(configParam.some((p: any) => p.name.includes('[Registry]R1'))).toBe(true);
      expect(configParam.some((p: any) => p.name.includes('[Registry]R2'))).toBe(true);
    });
  });
});
