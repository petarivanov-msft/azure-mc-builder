import React, { useState, useMemo } from 'react';
import {
  Button, Badge, Input, Tooltip,
  Dialog, DialogTrigger, DialogSurface, DialogTitle, DialogBody, DialogContent, DialogActions,
  TabList, Tab,
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

const cardStyle: React.CSSProperties = {
  border: '1px solid #e0e0e0',
  borderRadius: '10px',
  padding: '20px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  transition: 'border-color 0.15s, box-shadow 0.2s, transform 0.15s',
  background: '#fff',
};

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
      <DialogSurface style={{ maxWidth: '800px', width: '90vw', maxHeight: '90vh' }}>
        <DialogBody>
          <DialogTitle style={{ fontSize: '20px', fontWeight: 700 }}>Template Gallery</DialogTitle>
          <DialogContent>
            <p style={{ color: '#555', marginBottom: '16px', fontSize: '14px', lineHeight: '1.5' }}>
              Load a pre-built configuration template. This replaces your current configuration.
            </p>

            {/* Filter bar */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '60vh', overflowY: 'auto', padding: '4px 4px 4px 0' }}>
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#999', fontSize: '14px' }}>
                  No templates match your search.
                </div>
              )}
              {filtered.map(t => {
                const isExpanded = expanded === t.name;
                const modules = getModules(t);
                const isWindows = t.platform === 'Windows';
                const platformColor = isWindows ? '#0078d4' : '#16a34a';
                const platformBg = isWindows ? '#e8f4fd' : '#dcfce7';
                const isRemediation = t.config.mode === 'AuditAndSet';

                return (
                  <div
                    key={t.name}
                    style={{
                      ...cardStyle,
                      borderLeft: `4px solid ${platformColor}`,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)';
                      e.currentTarget.style.transform = '';
                    }}
                  >
                    {/* Header: title + badges */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, lineHeight: '1.3', flex: 1 }}>
                        {t.name}
                      </h3>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                        <span style={{
                          fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '12px',
                          background: platformBg, color: platformColor, whiteSpace: 'nowrap',
                        }}>
                          {t.platform}
                        </span>
                        <span style={{
                          fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '12px',
                          background: isRemediation ? '#fff3cd' : '#f0f0f0',
                          color: isRemediation ? '#856404' : '#555',
                          whiteSpace: 'nowrap',
                        }}>
                          {isRemediation ? 'Remediation' : 'Audit'}
                        </span>
                        <span style={{
                          fontSize: '11px', fontWeight: 500, padding: '3px 10px', borderRadius: '12px',
                          background: '#f0f0f0', color: '#555', whiteSpace: 'nowrap',
                        }}>
                          {t.resourceCount} resource{t.resourceCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Description — full text, no clipping */}
                    <p style={{ margin: '0 0 14px 0', fontSize: '14px', color: '#444', lineHeight: '1.55' }}>
                      {t.description}
                    </p>

                    {/* Module badges */}
                    {modules.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                        {modules.map(m => (
                          <Badge key={m} appearance="tint" size="small" color="brand">{m}</Badge>
                        ))}
                      </div>
                    )}

                    {/* Actions row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Button
                        size="small"
                        appearance="subtle"
                        onClick={() => setExpanded(isExpanded ? null : t.name)}
                        style={{ padding: '4px 10px', fontSize: '12px', color: '#0078d4', fontWeight: 500 }}
                      >
                        {isExpanded ? '▾ Hide details' : '▸ Show resources'}
                      </Button>
                      <Tooltip content="Replace current config with this template" relationship="label">
                        <Button
                          size="small"
                          appearance="primary"
                          onClick={() => handleLoad(t)}
                        >
                          Load Template
                        </Button>
                      </Tooltip>
                    </div>

                    {/* Expanded resource table */}
                    {isExpanded && (
                      <div style={{
                        marginTop: '14px', padding: '14px 16px',
                        background: '#fafafa', borderRadius: '8px',
                        fontSize: '13px', border: '1px solid #eee',
                      }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, fontSize: '12px', color: '#333' }}>Resource Type</th>
                              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, fontSize: '12px', color: '#333' }}>Instance Name</th>
                            </tr>
                          </thead>
                          <tbody>
                            {t.config.resources.map(r => (
                              <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '6px 8px' }}>
                                  <code style={{
                                    fontSize: '12px', background: '#e8f0fe',
                                    padding: '2px 8px', borderRadius: '4px', color: '#1a56db',
                                  }}>
                                    {r.schemaName}
                                  </code>
                                </td>
                                <td style={{ padding: '6px 8px' }}>{r.instanceName}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
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
