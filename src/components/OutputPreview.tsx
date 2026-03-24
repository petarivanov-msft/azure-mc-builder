import React, { useState, useMemo } from 'react';
import { Tab, TabList, Button, Tooltip, Badge } from '@fluentui/react-components';
import { useConfigStore } from '../store/configStore';
import { getGeneratedOutputs } from '../generators';

type OutputTab = 'mof' | 'metaconfig' | 'ps1' | 'policyJson' | 'packageScript' | 'readme';

const TAB_LABELS: Record<OutputTab, string> = {
  mof: 'MOF',
  metaconfig: 'Metaconfig',
  ps1: 'PowerShell',
  policyJson: 'Policy JSON',
  packageScript: 'Package Script',
  readme: 'README',
};

export const OutputPreview: React.FC = () => {
  const [activeTab, setActiveTab] = useState<OutputTab>('mof');
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const configName = useConfigStore(s => s.configName);
  const platform = useConfigStore(s => s.platform);
  const mode = useConfigStore(s => s.mode);
  const version = useConfigStore(s => s.version);
  const description = useConfigStore(s => s.description);
  const resources = useConfigStore(s => s.resources);

  const config = useMemo(() => ({
    configName, platform, mode, version, description, resources,
  }), [configName, platform, mode, version, description, resources]);

  const outputs = useMemo(() => {
    if (config.resources.length === 0) return null;
    try {
      return getGeneratedOutputs(config);
    } catch {
      return null;
    }
  }, [config]);

  const tabContent = outputs ? outputs[activeTab] : '';

  const copyToClipboard = async () => {
    if (tabContent) {
      await navigator.clipboard.writeText(tabContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{ background: '#fff', borderTop: '1px solid #e0e0e0' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 20px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>{collapsed ? '▶' : '▼'} Output Preview</span>
          {outputs && <Badge appearance="outline" size="small">Live</Badge>}
        </div>
        {!collapsed && outputs && (
          <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
            <Tooltip content={copied ? 'Copied!' : 'Copy to clipboard'} relationship="label">
              <Button appearance="subtle" size="small" onClick={copyToClipboard}>
                {copied ? '✓ Copied' : 'Copy'}
              </Button>
            </Tooltip>
          </div>
        )}
      </div>

      {!collapsed && (
        <>
          <div style={{ padding: '0 20px', borderBottom: '1px solid #e8e8e8' }}>
            <TabList selectedValue={activeTab} onTabSelect={(_, d) => setActiveTab(d.value as OutputTab)} size="small">
              {(Object.keys(TAB_LABELS) as OutputTab[]).map(key => (
                <Tab key={key} value={key}>{TAB_LABELS[key]}</Tab>
              ))}
            </TabList>
          </div>
          <pre style={{
            margin: 0,
            padding: '16px 20px',
            backgroundColor: '#1b1b1f',
            color: '#d4d4d4',
            overflow: 'auto',
            maxHeight: '60vh',
            minHeight: '200px',
            fontSize: '12px',
            lineHeight: '1.5',
            fontFamily: 'Consolas, "Cascadia Code", monospace',
          }}>
            {outputs ? tabContent : (
              <span style={{ color: '#666' }}>Add resources to see generated output here</span>
            )}
          </pre>
        </>
      )}
    </div>
  );
};
