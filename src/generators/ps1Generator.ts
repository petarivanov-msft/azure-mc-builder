import { ConfigurationState, ResourceInstance } from '../types';
import { schemasByName } from '../schemas';

/** Sanitise a string for safe embedding inside PowerShell single-quoted literals.
 *  Single-quoted strings in PS don't interpret variables or subexpressions,
 *  so the only escape needed is doubling single quotes.
 *  We also strip control characters (null bytes, carriage returns not part of
 *  newlines) that could break the script structure. */
function sanitisePs1String(value: string): string {
  return value
    .replace(/\0/g, '')           // strip null bytes
    .replace(/\r(?!\n)/g, '')     // strip lone CR (keep CRLF)
    .replace(/'/g, "''");         // escape single quotes for PS
}

/** Format a value for PowerShell DSC syntax */
function formatPs1Value(value: unknown, type: string): string {
  switch (type) {
    case 'string':
      return `'${sanitisePs1String(String(value))}'`;
    case 'string[]': {
      const arr = Array.isArray(value) ? value : [value];
      return `@(${arr.map(v => `'${sanitisePs1String(String(v))}'`).join(', ')})`;
    }
    case 'boolean':
      return value ? '$true' : '$false';
    case 'integer': {
      const n = Number(value);
      if (!Number.isFinite(n)) return '0';
      return String(Math.trunc(n));
    }
    default:
      return `'${sanitisePs1String(String(value))}'`;
  }
}

/** Format DependsOn for PS1 */
function formatPs1DependsOn(resource: ResourceInstance, allResources: ResourceInstance[]): string | null {
  if (!resource.dependsOn || resource.dependsOn.length === 0) return null;

  const deps = resource.dependsOn
    .map(depId => {
      const dep = allResources.find(r => r.id === depId);
      if (!dep) return null;
      const schema = schemasByName[dep.schemaName];
      if (!schema) return null;
      return `'[${sanitisePs1String(schema.resourceName)}]${sanitisePs1String(dep.instanceName)}'`;
    })
    .filter(Boolean);

  if (deps.length === 0) return null;
  if (deps.length === 1) return deps[0]!;
  return `@(${deps.join(', ')})`;
}

/** Sanitise a DSC identifier (config name, instance name, module name).
 *  Must match [a-zA-Z_][a-zA-Z0-9_]* — strip anything else. */
function sanitiseIdentifier(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_]/g, '');
  return /^[a-zA-Z_]/.test(cleaned) ? cleaned : `_${cleaned}`;
}

/** Generate PowerShell DSC Configuration script */
export function generatePs1(config: ConfigurationState): string {
  const lines: string[] = [];
  const safeName = sanitiseIdentifier(config.configName);

  // Collect all unique modules used by resources in this configuration
  const moduleMap = new Map<string, string>();
  for (const resource of config.resources) {
    const schema = schemasByName[resource.schemaName];
    if (schema && !moduleMap.has(schema.moduleName)) {
      moduleMap.set(schema.moduleName, schema.moduleVersion);
    }
  }

  lines.push(`Configuration ${safeName} {`);
  for (const [modName, modVersion] of moduleMap) {
    lines.push(`    Import-DscResource -ModuleName '${sanitisePs1String(modName)}' -ModuleVersion '${sanitisePs1String(modVersion)}'`);
  }
  lines.push('');
  lines.push('    Node localhost {');

  for (const resource of config.resources) {
    const schema = schemasByName[resource.schemaName];
    if (!schema) continue;

    lines.push(`        ${schema.resourceName} '${sanitisePs1String(resource.instanceName)}' {`);

    for (const propSchema of schema.properties) {
      const value = resource.properties[propSchema.name];
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value) && value.length === 0) continue;

      const formatted = formatPs1Value(value, propSchema.type);
      lines.push(`            ${propSchema.name} = ${formatted}`);
    }

    const dependsOn = formatPs1DependsOn(resource, config.resources);
    if (dependsOn) {
      lines.push(`            DependsOn = ${dependsOn}`);
    }

    lines.push('        }');
    lines.push('');
  }

  lines.push('    }');
  lines.push('}');

  return lines.join('\n');
}
