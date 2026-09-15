import type { ConfigurationState, ConfigMode, PropertySchema, ResourceInstance } from '../types';
import { schemasByName } from '../schemas';
import { v4 as uuidv4, validate as isUuid } from 'uuid';
import type { ProjectSettings } from '../types';

export const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
export const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

export function getConditionalRequiredProperties(resource: ResourceInstance, mode: ConfigMode): string[] {
  // nxtools 1.6.0 calls all three setters unconditionally when creating an absent item.
  return resource.schemaName === 'nxFile' && mode === 'AuditAndSet' && resource.properties.Ensure !== 'Absent'
    ? ['Mode', 'Owner', 'Group'] : [];
}

export function createProjectSettings(definitionName?: string): ProjectSettings {
  const policyId = uuidv4();
  const validName = definitionName && /^[A-Za-z0-9_-]{1,64}$/.test(definitionName);
  return { schemaVersion: 2, policyId, definitionName: validName ? definitionName : policyId,
    workflow: 'legacy', includeArc: true };
}

export function assertValidIdentifiers(config: ConfigurationState): void {
  if (!IDENTIFIER_PATTERN.test(config.configName)) {
    throw new Error('Configuration name must be a valid identifier');
  }
  if (!VERSION_PATTERN.test(config.version)) {
    throw new Error('Version must have the format major.minor.patch (e.g. 1.0.0)');
  }
  for (const resource of config.resources) {
    if (!IDENTIFIER_PATTERN.test(resource.instanceName)) {
      throw new Error(`Invalid instance name: ${resource.instanceName}`);
    }
  }
}

export function getPropertyValue(resource: ResourceInstance, property: PropertySchema): unknown {
  if (resource.schemaName === 'ScheduledTask' && property.name === 'AllowStartIfOnBatteries' &&
      resource.properties.AllowStartIfOnBatteries === undefined &&
      typeof resource.properties.DisallowStartIfOnBatteries === 'boolean') {
    return !resource.properties.DisallowStartIfOnBatteries;
  }
  const value = resource.properties[property.name];
  return value === undefined ? property.defaultValue : value;
}

export function isMissingProperty(value: unknown, property: PropertySchema): boolean {
  return value === undefined || value === null ||
    (value === '' && !property.allowEmptyString) ||
    (Array.isArray(value) && value.length === 0);
}

export function withResourceDefaults(resource: ResourceInstance): ResourceInstance {
  const properties = { ...resource.properties };
  if (resource.schemaName === 'ScheduledTask' && typeof properties.DisallowStartIfOnBatteries === 'boolean') {
    properties.AllowStartIfOnBatteries ??= !properties.DisallowStartIfOnBatteries;
    delete properties.DisallowStartIfOnBatteries;
  }
  for (const prop of schemasByName[resource.schemaName].properties) {
    if (properties[prop.name] === undefined && prop.defaultValue !== undefined) {
      properties[prop.name] = structuredClone(prop.defaultValue);
    }
  }
  return { ...resource, properties };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parse editable state without requiring all fields to be deployment-ready yet. */
export function parseConfiguration(json: string): ConfigurationState {
  const raw: unknown = JSON.parse(json);
  if (!isRecord(raw)) throw new Error('Root must be an object');
  if (typeof raw.configName !== 'string') throw new Error('Missing or invalid configName');
  if (raw.platform !== 'Windows' && raw.platform !== 'Linux') throw new Error('Invalid platform');
  if (raw.mode !== 'Audit' && raw.mode !== 'AuditAndSet') throw new Error('Invalid mode');
  if (typeof raw.version !== 'string') throw new Error('Missing or invalid version');
  if (raw.description !== undefined && typeof raw.description !== 'string') throw new Error('Invalid description');
  if (!Array.isArray(raw.resources)) throw new Error('resources must be an array');
  let project = createProjectSettings(`MC-${raw.configName}`);
  if (raw.project !== undefined) {
    const p = raw.project;
    if (!isRecord(p) || p.schemaVersion !== 2 || typeof p.policyId !== 'string' || !isUuid(p.policyId) ||
        typeof p.definitionName !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(p.definitionName) ||
        (p.workflow !== 'legacy' && p.workflow !== 'official') || typeof p.includeArc !== 'boolean') {
      throw new Error('Invalid or unsupported project metadata');
    }
    project = { schemaVersion: 2, policyId: p.policyId, definitionName: p.definitionName,
      workflow: p.workflow, includeArc: p.includeArc };
  }
  const ids = new Set<string>();
  const resources = raw.resources.map((resource: unknown, index: number) => {
    if (!isRecord(resource)) throw new Error(`resources[${index}] must be an object`);
    const { id, schemaName, instanceName, properties, dependsOn } = resource;
    if (typeof id !== 'string' || !id || ids.has(id)) throw new Error(`resources[${index}] has an invalid or duplicate id`);
    ids.add(id);
    if (typeof schemaName !== 'string' || !Object.hasOwn(schemasByName, schemaName)) {
      throw new Error(`resources[${index}].schemaName is not a valid resource type`);
    }
    if (typeof instanceName !== 'string') throw new Error(`resources[${index}].instanceName must be a string`);
    if (!isRecord(properties)) throw new Error(`resources[${index}].properties must be an object`);
    if (!Array.isArray(dependsOn) || !dependsOn.every((dep): dep is string => typeof dep === 'string')) {
      throw new Error(`resources[${index}].dependsOn must be an array of strings`);
    }
    return withResourceDefaults({ id, schemaName, instanceName, properties, dependsOn });
  });
  return {
    configName: raw.configName,
    platform: raw.platform,
    mode: raw.mode,
    version: raw.version,
    description: raw.description ?? '',
    resources,
    project,
  };
}
