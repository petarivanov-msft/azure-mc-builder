import React, { useState, useMemo } from 'react';
import {
  Button, Badge, Input, Tooltip,
  Dialog, DialogTrigger, DialogSurface, DialogTitle, DialogBody, DialogContent, DialogActions,
  TabList, Tab,
  Card, CardHeader,
} from '@fluentui/react-components';
import { templates, TemplateInfo } from '../templates';
import { schemasByName } from '../schemas';

interface TemplateGalleryProps {
  open: boolean;
  onClose: () => void;
  onLoad: (config: TemplateInfo['config']) => void;
}

/** Get unique module names */
function getModules(t: TemplateInfo): string[] {
  const mods = new Set(t.config.resources.map(r => {
    const schema = schemasByName[r.schemaName];
    return schema?.moduleName ?? 'Unknown';
  }));
  return [...mods].sort();
}

export const TemplateGallery: React.FC<TemplateGalleryProps> = ({ open, onClose, onLoad }) => {
  const [filter, setFilter] = useState<'All' | 'Windows' | 'Linux'>('All');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = templates;
    if (filter !== 'All') list = list.filter(t => t.platform === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.config.resources.some(r => r.schemaName.toLowerCase().includes(q))
      );
    }
    return list;
  }, [filter, search]);

  const handleLoad = (t: TemplateInfo) => {
    onLoad(t.config);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(_, d) => { if (!d.open) onClose(); }}>
      <DialogSurface style={{ maxWidth: '720px', maxHeight: '85vh' }}>
        <DialogBody>
          <DialogTitle>Template Gallery</DialogTitle>
          <DialogContent>
            <p style={{ color: '#666', marginBottom: '12px', fontSize: '13px' }}>
              Load a pre-built configuration template. This replaces your current configuration.
            </p>

            {/* Filter bar */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
              <TabList
                size="small"
                selectedValue={filter}
                onTabSelect={(_, d) => setFilter(d.value as 'All' | 'Windows' | 'Linux')}
              >
                <Tab value="All">All ({templates.length})</Tab>
                <Tab value="Windows">Windows ({templates.filter(t => t.platform === 'Windows').length})</Tab>
                <Tab value="Linux">Linux ({templates.filter(t => t.platform === 'Linux').length})</Tab>
              </TabList>
              <Input
                size="small"
                placeholder="Search templates..."
                value={search}
                onChange={(_, d) => setSearch(d.value)}
                style={{ flex: 1 }}
              />
            </div>

            {/* Template cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '55vh', overflowY: 'auto' }}>
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px', color: '#999' }}>
                  No templates match your search.
                </div>
              )}
              {filtered.map(t => {
                const isExpanded = expanded === t.name;
                const modules = getModules(t);
                return (
                  <Card
                    key={t.name}
                    style={{
                      cursor: 'pointer',
                      border: '1px solid #e0e0e0',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#0078d4';
                      e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,120,212,0.15)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#e0e0e0';
                      e.currentTarget.style.boxShadow = '';
                    }}
                  >
                    <CardHeader
                      header={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <strong style={{ fontSize: '14px' }}>{t.name}</strong>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <Badge
                              appearance="outline"
                              size="small"
                              color={t.platform === 'Windows' ? 'informative' : 'success'}
                            >
                              {t.platform}
                            </Badge>
                            <Badge appearance="outline" size="small">
                              {t.resourceCount} resource{t.resourceCount !== 1 ? 's' : ''}
                            </Badge>
                            <Badge
                              appearance="outline"
                              size="small"
                              color={t.config.mode === 'AuditAndSet' ? 'warning' : 'subtle'}
                            >
                              {t.config.mode === 'AuditAndSet' ? 'Remediation' : 'Audit'}
                            </Badge>
                          </div>
                        </div>
                      }
                      description={
                        <div>
                          <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>{t.description}</div>

                          {/* Module badges */}
                          <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
                            {modules.map(m => (
                              <Badge key={m} appearance="tint" size="small" color="brand">{m}</Badge>
                            ))}
                          </div>

                          {/* Expandable details */}
                          <div style={{ marginTop: '8px' }}>
                            <Button
                              size="small"
                              appearance="subtle"
                              onClick={(e) => { e.stopPropagation(); setExpanded(isExpanded ? null : t.name); }}
                              style={{ padding: '2px 6px', fontSize: '12px' }}
                            >
                              {isExpanded ? '▾ Hide details' : '▸ Show resources'}
                            </Button>

                            {isExpanded && (
                              <div style={{ marginTop: '8px', padding: '8px 12px', background: '#f8f8f8', borderRadius: '4px', fontSize: '12px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid #ddd' }}>
                                      <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600 }}>Resource Type</th>
                                      <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600 }}>Instance Name</th>
                                      <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600 }}>Key Property</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {t.config.resources.map(r => {
                                      const schema = schemasByName[r.schemaName];
                                      // Show the first required property value as "key"
                                      const keyProp = schema?.properties.find(p => p.required);
                                      const keyVal = keyProp ? String(r.properties[keyProp.name] ?? '') : '';
                                      return (
                                        <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                                          <td style={{ padding: '3px 8px' }}>
                                            <code style={{ fontSize: '11px', background: '#eef', padding: '1px 4px', borderRadius: '3px' }}>
                                              {r.schemaName}
                                            </code>
                                          </td>
                                          <td style={{ padding: '3px 8px' }}>{r.instanceName}</td>
                                          <td style={{ padding: '3px 8px', color: '#555', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {keyVal.length > 50 ? keyVal.slice(0, 47) + '...' : keyVal}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          {/* Load button */}
                          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                            <Tooltip content="Replace current config with this template" relationship="label">
                              <Button
                                size="small"
                                appearance="primary"
                                onClick={(e) => { e.stopPropagation(); handleLoad(t); }}
                              >
                                Load Template
                              </Button>
                            </Tooltip>
                          </div>
                        </div>
                      }
                    />
                  </Card>
                );
              })}
            </div>
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary">Close</Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
