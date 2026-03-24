import React from 'react';
import { Button, Badge, Tooltip } from '@fluentui/react-components';
import { useConfigStore } from '../store/configStore';
import { schemasByName } from '../schemas';

export const ResourceList: React.FC = () => {
  const { resources, selectedResourceId, selectResource, removeResource, cloneResource, reorderResource } = useConfigStore();

  if (resources.length === 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.4 }}>📦</div>
        <div style={{ color: '#666', fontSize: '14px', lineHeight: '1.5' }}>
          No resources yet.<br />
          Click <strong>+ Add Resource</strong> to get started,<br />
          or load a <strong>Template</strong>.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 8px' }}>
      {resources.map((resource, index) => {
        const schema = schemasByName[resource.schemaName];
        const isSelected = resource.id === selectedResourceId;
        const filledRequired = schema?.properties.filter(p => p.required).every(p => {
          const val = resource.properties[p.name];
          return val !== undefined && val !== null && val !== '';
        });

        return (
          <div
            key={resource.id}
            onClick={() => selectResource(resource.id)}
            style={{
              padding: '10px 12px',
              marginBottom: '2px',
              border: isSelected ? '2px solid #0078d4' : '1px solid transparent',
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: isSelected ? '#f0f6ff' : 'transparent',
              transition: 'background 0.1s, border-color 0.1s',
            }}
            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8f8f8'; }}
            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <Badge appearance="filled" color={filledRequired ? 'success' : 'warning'} size="small">
                  {index + 1}
                </Badge>
                <span style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  [{resource.schemaName}]
                </span>
                <span style={{ fontSize: '13px', color: '#444', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {resource.instanceName}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '2px', flexShrink: 0, marginLeft: '8px' }}>
                {index > 0 && (
                  <Tooltip content="Move up" relationship="label">
                    <Button size="small" appearance="subtle" onClick={(e) => { e.stopPropagation(); reorderResource(index, index - 1); }} style={{ minWidth: '24px', padding: '2px' }}>▲</Button>
                  </Tooltip>
                )}
                {index < resources.length - 1 && (
                  <Tooltip content="Move down" relationship="label">
                    <Button size="small" appearance="subtle" onClick={(e) => { e.stopPropagation(); reorderResource(index, index + 1); }} style={{ minWidth: '24px', padding: '2px' }}>▼</Button>
                  </Tooltip>
                )}
                <Tooltip content="Duplicate" relationship="label">
                  <Button size="small" appearance="subtle" onClick={(e) => { e.stopPropagation(); cloneResource(resource.id); }} style={{ minWidth: '24px', padding: '2px' }}>⧉</Button>
                </Tooltip>
                <Tooltip content="Remove" relationship="label">
                  <Button size="small" appearance="subtle" onClick={(e) => { e.stopPropagation(); removeResource(resource.id); }} style={{ minWidth: '24px', padding: '2px', color: '#c50f1f' }}>✕</Button>
                </Tooltip>
              </div>
            </div>
            {resource.dependsOn.length > 0 && (
              <div style={{ fontSize: '11px', color: '#888', marginTop: '2px', paddingLeft: '30px' }}>
                ↳ depends on {resource.dependsOn.length} resource(s)
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
