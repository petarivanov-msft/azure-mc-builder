import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Tab, TabList, Tooltip } from '@fluentui/react-components';
import { useConfigStore } from '../store/configStore';
import { getOfficialProjectFiles } from '../generators';

const TAB_LABELS = {
  'Configuration.ps1': 'DSC source',
  'config.json': 'Project',
  'package.ps1': 'Build',
  'test.ps1': 'Test',
  'deploy.ps1': 'Publish',
  'README.md': 'README',
};
type OutputTab = keyof typeof TAB_LABELS;

export const OutputPreview: React.FC = () => {
  const [activeTab, setActiveTab] = useState<OutputTab>('Configuration.ps1');
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const { configName, platform, mode, version, description, resources, project } = useConfigStore();
  const output = useMemo(() => {
    if (resources.length === 0) return { files: null, error: '' };
    try {
      return { files: getOfficialProjectFiles({ configName, platform, mode, version, description, resources, project }), error: '' };
    } catch (error) {
      return { files: null, error: error instanceof Error ? error.message : String(error) };
    }
  }, [configName, platform, mode, version, description, resources, project]);
  const content = output.files?.[activeTab] ?? '';

  const copy = async () => {
    setCopyError('');
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      setCopyError(`Could not copy source: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <section aria-label="Source project preview" style={{ background: '#fff', borderTop: '1px solid #e0e0e0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button appearance="subtle" aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? 'Show source project' : 'Hide source project'}
          </Button>
          {output.files && <Badge appearance="outline" size="small">Live preview</Badge>}
        </div>
        {!collapsed && content && (
          <Tooltip content={copied ? 'Copied!' : 'Copy selected source file'} relationship="label">
            <Button appearance="subtle" size="small" onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
          </Tooltip>
        )}
      </div>
      {!collapsed && (
        <>
          <p style={{ padding: '0 20px', color: '#555', fontSize: '13px' }}>
            The official tools create the MOF, package metadata and policy JSON after download.
            These tabs show the source project, not simulated deployment artifacts.
          </p>
          <TabList selectedValue={activeTab} size="small" style={{ padding: '0 20px' }}
            onTabSelect={(_, data) => {
              if (typeof data.value === 'string' && Object.hasOwn(TAB_LABELS, data.value)) {
                setActiveTab(data.value as OutputTab);
                setCopied(false);
                setCopyError('');
              }
            }}>
            {Object.entries(TAB_LABELS).map(([file, label]) => <Tab key={file} value={file}>{label}</Tab>)}
          </TabList>
          {(output.error || copyError) && <p role="alert" style={{ padding: '0 20px', color: '#a4262c' }}>{output.error || copyError}</p>}
          <pre style={{ margin: 0, padding: '16px 20px', background: '#1b1b1f', color: '#d4d4d4',
            whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', overflow: 'auto', maxHeight: '60vh',
            minHeight: '200px', font: '12px/1.5 Consolas, monospace' }}>
            {content || (output.error ? 'Resolve the validation errors to preview this project.' : 'Add resources to preview the source project.')}
          </pre>
        </>
      )}
    </section>
  );
};
