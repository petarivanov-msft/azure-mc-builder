import React from 'react';
import { Input, Select, Label, Checkbox, Textarea, Divider, Badge } from '@fluentui/react-components';
import { useConfigStore } from '../store/configStore';
import { schemasByName } from '../schemas';

export const PropertyPanel: React.FC = () => {
  const { resources, selectedResourceId, updateResourceProperty, updateResourceInstanceName, updateResourceDependsOn } = useConfigStore();
  const resource = resources.find(r => r.id === selectedResourceId);

  if (!resource) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '48px 24px' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.3 }}>🔧</div>
        <div style={{ color: '#888', fontSize: '14px', textAlign: 'center' }}>
          Select a resource from the list<br />to edit its properties
        </div>
      </div>
    );
  }

  const schema = schemasByName[resource.schemaName];
  if (!schema) return null;

  const otherResources = resources.filter(r => r.id !== resource.id);
  const requiredProps = schema.properties.filter(p => p.required);
  const optionalProps = schema.properties.filter(p => !p.required);

  const renderProperty = (prop: typeof schema.properties[0]) => {
    const value = resource.properties[prop.name];
    const isEmpty = value === undefined || value === null || value === '';
    const showRequired = prop.required && isEmpty;

    // Regex validation
    let patternError = '';
    if (prop.validationPattern && value && typeof value === 'string') {
      if (!new RegExp(prop.validationPattern).test(value)) {
        patternError = prop.validationMessage || 'Invalid format';
      }
    }
    // Integer validation
    let intError = '';
    if (prop.type === 'integer' && value !== undefined && value !== '' && isNaN(Number(value))) {
      intError = 'Must be a number';
    }

    const fieldError = showRequired ? 'This field is required' : patternError || intError;

    if (prop.type === 'boolean') {
      return (
        <div key={prop.name} style={{ marginBottom: '10px' }}>
          <Checkbox
            label={
              <span>
                {prop.name}
                {prop.required && <span style={{ color: '#c50f1f' }}> *</span>}
              </span>
            }
            checked={!!value}
            onChange={(_, d) => updateResourceProperty(resource.id, prop.name, d.checked)}
          />
          <div style={{ fontSize: '11px', color: '#888', marginLeft: '30px' }}>{prop.description}</div>
        </div>
      );
    }

    if (prop.enumValues && prop.type === 'string') {
      return (
        <div key={prop.name} style={{ marginBottom: '12px' }}>
          <Label size="small" weight="semibold">
            {prop.name}{prop.required && <span style={{ color: '#c50f1f' }}> *</span>}
          </Label>
          <Select
            value={String(value || '')}
            onChange={(_, d) => updateResourceProperty(resource.id, prop.name, d.value || undefined)}
            size="small"
          >
            <option value="">— Select —</option>
            {prop.enumValues.map(v => <option key={v} value={v}>{v}</option>)}
          </Select>
          <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{prop.description}</div>
        </div>
      );
    }

    if (prop.type === 'string[]') {
      const arrValue = Array.isArray(value) ? (value as string[]).join(', ') : String(value || '');
      return (
        <div key={prop.name} style={{ marginBottom: '12px' }}>
          <Label size="small" weight="semibold">
            {prop.name}{prop.required && <span style={{ color: '#c50f1f' }}> *</span>}
            <Badge appearance="outline" size="small" style={{ marginLeft: '6px' }}>array</Badge>
          </Label>
          <Input
            value={arrValue}
            onChange={(_, d) => {
              const arr = d.value.split(',').map(s => s.trim()).filter(Boolean);
              updateResourceProperty(resource.id, prop.name, arr);
            }}
            placeholder={prop.placeholder || 'Comma-separated values'}
            size="small"
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{prop.description}</div>
        </div>
      );
    }

    // Script properties get a larger textarea
    const isScript = prop.name.toLowerCase().includes('script') || prop.name === 'Contents';
    if (isScript) {
      return (
        <div key={prop.name} style={{ marginBottom: '12px' }}>
          <Label size="small" weight="semibold">
            {prop.name}{prop.required && <span style={{ color: '#c50f1f' }}> *</span>}
          </Label>
          <Textarea
            value={String(value || '')}
            onChange={(_, d) => updateResourceProperty(resource.id, prop.name, d.value)}
            placeholder={prop.description}
            size="small"
            style={{ width: '100%', fontFamily: 'Consolas, monospace', fontSize: '12px' }}
            resize="vertical"
            rows={4}
          />
          <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{prop.description}</div>
        </div>
      );
    }

    // Default: string or integer input
    return (
      <div key={prop.name} style={{ marginBottom: '12px' }}>
        <Label size="small" weight="semibold">
          {prop.name}{prop.required && <span style={{ color: '#c50f1f' }}> *</span>}
        </Label>
        <Input
          type={prop.type === 'integer' ? 'number' : 'text'}
          value={String(value ?? '')}
          onChange={(_, d) => {
            const val = prop.type === 'integer' ? (d.value === '' ? undefined : Number(d.value)) : d.value;
            updateResourceProperty(resource.id, prop.name, val);
          }}
          placeholder={prop.placeholder || prop.description}
          size="small"
          style={{ width: '100%', ...(fieldError ? { borderColor: '#c50f1f' } : {}) }}
        />
        {fieldError ? (
          <div style={{ fontSize: '11px', color: '#c50f1f', marginTop: '2px' }}>{fieldError}</div>
        ) : (
          <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{prop.description}</div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '16px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Badge appearance="filled" color="brand" size="large">{schema.resourceName}</Badge>
        <span style={{ color: '#666', fontSize: '12px' }}>{schema.moduleName} {schema.moduleVersion}</span>
      </div>
      <p style={{ fontSize: '13px', color: '#555', marginBottom: '16px' }}>
        {schema.description}
        {schema.docUrl && (
          <>
            {' · '}
            <a href={schema.docUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#0078d4' }}>
              Learn more ↗
            </a>
          </>
        )}
      </p>

      {/* Instance Name */}
      <div style={{ marginBottom: '16px' }}>
        <Label size="small" weight="semibold">Instance Name <span style={{ color: '#c50f1f' }}>*</span></Label>
        <Input
          value={resource.instanceName}
          onChange={(_, d) => updateResourceInstanceName(resource.id, d.value)}
          size="small"
          style={{ width: '100%' }}
        />
        <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>Unique identifier for this resource instance</div>
      </div>

      {/* Required Properties */}
      {requiredProps.length > 0 && (
        <>
          <Divider style={{ marginBottom: '12px' }}>Required</Divider>
          {requiredProps.map(renderProperty)}
        </>
      )}

      {/* Optional Properties */}
      {optionalProps.length > 0 && (
        <>
          <Divider style={{ margin: '16px 0 12px' }}>Optional</Divider>
          {optionalProps.map(renderProperty)}
        </>
      )}

      {/* DependsOn */}
      {otherResources.length > 0 && (
        <>
          <Divider style={{ margin: '16px 0 12px' }}>Dependencies</Divider>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
            Resources that must be evaluated before this one:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {otherResources.map(other => (
              <Checkbox
                key={other.id}
                label={<span style={{ fontSize: '13px' }}>[{other.schemaName}] {other.instanceName}</span>}
                checked={resource.dependsOn.includes(other.id)}
                onChange={(_, d) => {
                  const deps = d.checked
                    ? [...resource.dependsOn, other.id]
                    : resource.dependsOn.filter(id => id !== other.id);
                  updateResourceDependsOn(resource.id, deps);
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
