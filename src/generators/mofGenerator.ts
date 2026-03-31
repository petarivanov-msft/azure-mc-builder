import { ConfigurationState, ResourceInstance } from '../types';
import { schemasByName } from '../schemas';

/** Escape a string value for MOF format.
 *  MOF string literals use double-quote delimiters.
 *  We escape backslash, double-quote, newline, tab, and strip null bytes. */
export function escapeMofString(value: string): string {
  return value
    .replace(/\0/g, '')          // strip null bytes
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/** Format a value for MOF based on property type */
export function formatMofValue(value: unknown, type: string): string {
  if (value === null || value === undefined) return '';

  switch (type) {
    case 'string':
      return `"${escapeMofString(String(value))}"`;
    case 'string[]': {
      const arr = Array.isArray(value) ? value : [value];
      return `{${arr.map(v => `"${escapeMofString(String(v))}"`).join(', ')}}`;
    }
    case 'boolean':
      return value ? 'True' : 'False';
    case 'integer': {
      const n = Number(value);
      if (!Number.isFinite(n)) return '0';
      return String(Math.trunc(n));
    }
    default:
      return `"${escapeMofString(String(value))}"`;
  }
}

/** Format DependsOn array for MOF */
function formatDependsOn(resource: ResourceInstance, allResources: ResourceInstance[]): string | null {
  if (!resource.dependsOn || resource.dependsOn.length === 0) return null;

  const deps = resource.dependsOn
    .map(depId => {
      const dep = allResources.find(r => r.id === depId);
      if (!dep) return null;
      const schema = schemasByName[dep.schemaName];
      if (!schema) return null;
      return `"[${schema.resourceName}]${dep.instanceName}"`;
    })
    .filter(Boolean);

  if (deps.length === 0) return null;
  return `{${deps.join(', ')}}`;
}

/** Generate MOF header comment */
function generateHeader(configName: string): string {
  const now = new Date();
  const date = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  return `/*
@TargetNode='localhost'
@GeneratedBy=${configName}
@GenerationDate=${date}
@GenerationHost=AzureMCBuilder
*/`;
}

/** Generate a single resource instance block */
function generateResourceBlock(
  resource: ResourceInstance,
  index: number,
  allResources: ResourceInstance[],
  configName: string
): string {
  const schema = schemasByName[resource.schemaName];
  if (!schema) throw new Error(`Unknown schema: ${resource.schemaName}`);

  const className = schema.mofClassName;
  const lines: string[] = [];

  lines.push(`instance of ${className} as $${className}${index}ref`);
  lines.push('{');

  // ResourceID is always first
  lines.push(`    ResourceID = "[${schema.resourceName}]${resource.instanceName}";`);

  // User-configured properties
  for (const propSchema of schema.properties) {
    const value = resource.properties[propSchema.name];
    if (value === undefined || value === null) continue;

    // Skip empty strings ONLY if the property is not required/key
    if (value === '' && !propSchema.required && !propSchema.isKey) continue;

    // Skip arrays that are empty
    if (Array.isArray(value) && value.length === 0) continue;

    const formatted = formatMofValue(value, propSchema.type);
    lines.push(`    ${propSchema.name} = ${formatted};`);
  }

  // DependsOn
  const dependsOn = formatDependsOn(resource, allResources);
  if (dependsOn) {
    lines.push(`    DependsOn = ${dependsOn};`);
  }

  // Metadata properties
  lines.push(`    SourceInfo = "${configName}::${schema.resourceName}::${resource.instanceName}";`);
  lines.push(`    ModuleName = "${schema.moduleName}";`);
  lines.push(`    ModuleVersion = "${schema.moduleVersion}";`);
  lines.push(`    ConfigurationName = "${configName}";`);

  lines.push('};');

  return lines.join('\n');
}

/** Generate OMI_ConfigurationDocument block (MUST be at END) */
function generateOmiDocument(configName: string): string {
  const now = new Date();
  const date = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  return `instance of OMI_ConfigurationDocument
{
    Version = "2.0.0";
    MinimumCompatibleVersion = "1.0.0";
    CompatibleVersionAdditionalProperties = {"Omi_BaseResource:ConfigurationName"};
    Author = "${configName}";
    GenerationDate = "${date}";
    GenerationHost = "AzureMCBuilder";
    Name = "${configName}";
};`;
}

// Resources known to be unsupported in the GC agent sandbox
export const GC_UNSUPPORTED_CLASSES = new Set([
  'MSFT_RoleResource',           // WindowsFeature — needs Server Manager
  'MSFT_WindowsOptionalFeature', // needs DISM
  'MSFT_ArchiveResource',        // needs Expand-Archive
  'MSFT_MsiPackage',             // needs MSI subsystem
  'MSFT_WindowsPackageCab',      // needs DISM/CAB
]);

/** Validate a config before MOF generation. Throws on fatal issues. */
export function validateConfig(config: ConfigurationState): string[] {
  const warnings: string[] = [];

  for (const resource of config.resources) {
    const schema = schemasByName[resource.schemaName];
    if (!schema) {
      throw new Error(`Unknown schema "${resource.schemaName}" in resource "${resource.instanceName}"`);
    }

    // Check for GC-unsupported resources
    if (GC_UNSUPPORTED_CLASSES.has(schema.mofClassName)) {
      throw new Error(
        `Resource "${resource.instanceName}" uses ${schema.mofClassName} (${resource.schemaName}) ` +
        `which is NOT supported in the Azure Guest Configuration agent sandbox. ` +
        `Remove it or use an alternative resource.`
      );
    }

    // Check required/key properties are present
    for (const propSchema of schema.properties) {
      if ((propSchema.required || propSchema.isKey) && !propSchema.defaultValue) {
        const value = resource.properties[propSchema.name];
        if (value === undefined || value === null) {
          throw new Error(
            `Required property "${propSchema.name}" is missing for resource ` +
            `"[${schema.resourceName}]${resource.instanceName}". ` +
            `This will cause a DSC runtime error on the target VM.`
          );
        }
      }

      // Validate enum values (skip comma-separated multi-values like "Domain,Private")
      if (propSchema.enumValues && resource.properties[propSchema.name] !== undefined) {
        const value = String(resource.properties[propSchema.name]);
        const parts = value.includes(',') ? value.split(',').map(s => s.trim()) : [value];
        for (const part of parts) {
          if (!propSchema.enumValues.includes(part)) {
            throw new Error(
              `Invalid value "${part}" for property "${propSchema.name}" in resource ` +
              `"[${schema.resourceName}]${resource.instanceName}". ` +
              `Valid values: ${propSchema.enumValues.join(', ')}`
            );
          }
        }
      }
    }
  }

  return warnings;
}

/** Generate full MOF content as string (without BOM) */
export function generateMofContent(config: ConfigurationState): string {
  // Validate before generating
  validateConfig(config);

  const parts: string[] = [];

  // Header
  parts.push(generateHeader(config.configName));
  parts.push('');

  // Track per-class index for unique ref naming
  const classIndexMap = new Map<string, number>();

  // Resource instances
  for (const resource of config.resources) {
    const schema = schemasByName[resource.schemaName];
    if (!schema) continue;

    const currentIndex = (classIndexMap.get(schema.mofClassName) || 0) + 1;
    classIndexMap.set(schema.mofClassName, currentIndex);

    parts.push(generateResourceBlock(resource, currentIndex, config.resources, config.configName));
    parts.push('');
  }

  // OMI_ConfigurationDocument at the END
  parts.push(generateOmiDocument(config.configName));
  parts.push('');

  return parts.join('\n');
}

/** Generate MOF file as Uint8Array with UTF-8 BOM */
export function generateMofFile(config: ConfigurationState): Uint8Array {
  const content = generateMofContent(config);
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const encoded = new TextEncoder().encode(content);
  const result = new Uint8Array(bom.length + encoded.length);
  result.set(bom);
  result.set(encoded, bom.length);
  return result;
}
