import React, { useState } from 'react';
import {
  Dialog, DialogTrigger, DialogSurface, DialogTitle, DialogBody, DialogActions, DialogContent,
  Button, Input, Label, Tooltip,
} from '@fluentui/react-components';
import { useConfigStore } from '../store/configStore';
import { getSchemasByCategory } from '../schemas';
import { ResourceSchema } from '../types';

export const ResourcePicker: React.FC = () => {
  const { platform, addResource, resources } = useConfigStore();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const categories = getSchemasByCategory(platform);

  const handleAdd = (schema: ResourceSchema) => {
    // Auto-generate unique instance name
    const baseName = schema.resourceName.replace(/^nx/, '');
    const existingNames = new Set(resources.map(r => r.instanceName));
    let name = baseName;
    let counter = 1;
    while (existingNames.has(name)) {
      counter++;
      name = `${baseName}${counter}`;
    }
    addResource(schema.resourceName, name);
    setOpen(false);
    setFilter('');
  };

  const lowerFilter = filter.toLowerCase();

  return (
    <Dialog open={open} onOpenChange={(_, d) => { setOpen(d.open); if (!d.open) setFilter(''); }}>
      <DialogTrigger disableButtonEnhancement>
        <Button appearance="primary" size="small">+ Add Resource</Button>
      </DialogTrigger>
      <DialogSurface style={{ maxWidth: '560px' }}>
        <DialogBody>
          <DialogTitle>Add Resource — {platform}</DialogTitle>
          <DialogContent>
            <Input
              value={filter}
              onChange={(_, d) => setFilter(d.value)}
              placeholder="Filter resources..."
              style={{ width: '100%', marginBottom: '16px' }}
              autoFocus
            />
            {categories.map(cat => {
              const filtered = cat.schemas.filter(s =>
                !lowerFilter || s.resourceName.toLowerCase().includes(lowerFilter) || s.description.toLowerCase().includes(lowerFilter)
              );
              if (filtered.length === 0) return null;
              return (
                <div key={cat.category} style={{ marginBottom: '16px' }}>
                  <Label style={{ fontWeight: 600, fontSize: '12px', color: '#0078d4', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {cat.category}
                  </Label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                    {filtered.map(schema => (
                      <Tooltip key={schema.resourceName} content={`${schema.description} (${schema.moduleName})`} relationship="description">
                        <Button
                          appearance="outline"
                          size="small"
                          onClick={() => handleAdd(schema)}
                          style={{ fontSize: '13px' }}
                        >
                          {schema.resourceName}
                        </Button>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              );
            })}
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary">Cancel</Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
