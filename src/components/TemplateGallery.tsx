import React, { useState, useMemo } from 'react';
import {
  Button, Badge, Input, Tooltip,
  Dialog, DialogTrigger, DialogSurface, DialogTitle, DialogBody, DialogContent, DialogActions,
  TabList, Tab,
  Card,
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '55vh', overflowY: 'auto', padding: '4px' }}>
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px', color: '#999' }}>
                  No templates match your search.
                </div>
              )}
              {filtered.map(t => {
                const isExpanded = expanded === t.name;
                const modules = getModules(t);
                const platformColor = t.platform === 'Windows' ? '#0078d4' : '#16a34a';
                const platformBg = t.platform === 'Windows' ? '#e8f4fd' : '#dcfce7';
                const modeBg = t.config.mode === 'AuditAndSet' ? '#fff3cd' : '#f0f0f0';
                const modeColor = t.config.mode === 'AuditAndSet' ? '#856404' : '#555';
                return (
                  <Card
                    key={t.name}
                    style={{
                      cursor: 'pointer',
                      border: '1px solid #e0e0e0',
                      borderLeft: `4px solid ${platformColor}`,
                      borderRadius: '8px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
                      padding: '16px',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = platformColor;
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#e0e0e0';
                      e.currentTarget.style.borderLeftColor = platformColor;
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
                      e.currentTarget.style.transform = '';
                    }}
                  >
                    {/* Title row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '15px', lineHeight: '1.4', flex: 1, marginRight: '12px' }}>{t.name}</strong>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                        <span style={{
                          fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '12px',
                          background: platformBg, color: platformColor,
                        }}>
                          {t.platform}
                        </span>
                        <span style={{
                          fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '12px',
                          background: modeBg, color: modeColor,
                        }}>
                          {t.config.mode === 'AuditAndSet' ? 'Remediation' : 'Audit'}
                        </span>
                        <span style={{
                          fontSize: '11px', fontWeight: 500, padding: '3px 10px', borderRadius: '12px',
                          background: '#f0f0f0', color: '#555',
                        }}>
                          {t.resourceCount} resource{t.resourceCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Description */}
                    <div style={{ fontSize: '13.5px', color: '#444', lineHeight: '1.5', marginBottom: '12px' }}>
                      {t.description}
                    </div>

                    {/* Module badges */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                      {modules.map(m => (
                        <Badge key={m} appearance="tint" size="small" color="brand">{m}</Badge>
                      ))}
                    </div>

                    {/* Expandable details + Load button row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Button
                        size="small"
                        appearance="subtle"
                        onClick={(e) => { e.stopPropagation(); setExpanded(isExpanded ? null : t.name); }}
                        style={{ padding: '2px 8px', fontSize: '12px', color: '#0078d4' }}
                      >
                        {isExpanded ? '▾ Hide details' : '▸ Show resources'}
                      </Button>
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

                    {isExpanded && (
                      <div style={{ marginTop: '12px', padding: '12px 14px', background: '#fafafa', borderRadius: '6px', fontSize: '12px', border: '1px solid #eee' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #ddd' }}>
                              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Resource Type</th>
                              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Instance Name</th>
                              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Key Property</th>
                            </tr>
                          </thead>
                          <tbody>
                            {t.config.resources.map(r => {
                              const schema = schemasByName[r.schemaName];
                              const keyProp = schema?.properties.find(p => p.required);
                              const keyVal = keyProp ? String(r.properties[keyProp.name] ?? '') : '';
                              return (
                                <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                                  <td style={{ padding: '5px 8px' }}>
                                    <code style={{ fontSize: '11px', background: '#e8f0fe', padding: '2px 6px', borderRadius: '4px', color: '#1a56db' }}>
                                      {r.schemaName}
                                    </code>
                                  </td>
                                  <td style={{ padding: '5px 8px' }}>{r.instanceName}</td>
                                  <td style={{ padding: '5px 8px', color: '#555', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {keyVal.length > 50 ? keyVal.slice(0, 47) + '...' : keyVal}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
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
