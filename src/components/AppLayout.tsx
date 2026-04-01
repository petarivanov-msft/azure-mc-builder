import React, { useState, useRef, useMemo } from 'react';
import {
  FluentProvider, webLightTheme,
  Button, Badge, Tooltip,
  MessageBar, MessageBarBody,
} from '@fluentui/react-components';
import { ConfigHeader } from './ConfigHeader';
import { ResourcePicker } from './ResourcePicker';
import { ResourceList } from './ResourceList';
import { PropertyPanel } from './PropertyPanel';
import { OutputPreview } from './OutputPreview';
import { GuideDialog } from './GuideDialog';
import { TemplateGallery } from './TemplateGallery';
import { useConfigStore } from '../store/configStore';
import { generateBundle } from '../generators';

const App: React.FC = () => {
  const store = useConfigStore();
  const { configName, platform, mode, resources, version, validate } = store;
  // validate() uses get() internally — we list fields explicitly for reactivity
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const errors = useMemo(() => validate(), [configName, platform, mode, resources, version, validate]);
  const errorCount = errors.filter(e => e.level === 'error').length;
  const warnCount = errors.filter(e => e.level === 'warning').length;

  const [templateOpen, setTemplateOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [welcomeDismissed, setWelcomeDismissed] = useState(() => localStorage.getItem('mc-builder-welcome-dismissed') === '1');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dismissWelcome = () => {
    setWelcomeDismissed(true);
    localStorage.setItem('mc-builder-welcome-dismissed', '1');
  };

  const handleDownload = async () => {
    if (errorCount > 0) return;
    setDownloading(true);
    try {
      const blob = await generateBundle(store.getSnapshot());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${store.configName}.zip`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      // Small delay before cleanup to ensure download starts
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      console.error('Download failed:', err);
      alert(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleExport = () => {
    const json = store.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${store.configName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        store.importJSON(reader.result as string);
        setImportError(null);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : String(err));
        setTimeout(() => setImportError(null), 8000);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-imported
    e.target.value = '';
  };

  return (
    <FluentProvider theme={webLightTheme}>
      <div style={{ maxWidth: '1440px', margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

        {/* Top bar */}
        <header style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 20px',
          background: '#fff',
          borderBottom: '3px solid #0078d4',
          position: 'sticky', top: 0, zIndex: 100,
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#0078d4"><path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" opacity="0.8"/></svg>
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#242424', margin: 0, lineHeight: 1.2 }}>
                Azure Machine Configuration Builder
              </h1>
              <span style={{ fontSize: '11px', color: '#666' }}>Visual package generator for Azure Policy Guest Configuration</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Tooltip content="Start a new empty configuration" relationship="label">
              <Button size="small" appearance="subtle" onClick={() => { if (store.resources.length === 0 || confirm('Start a new configuration? Current work will be lost unless exported.')) store.resetConfig(); }}>New</Button>
            </Tooltip>
            <Tooltip content="Step-by-step deployment guide" relationship="label">
              <Button size="small" appearance="subtle" onClick={() => setGuideOpen(true)}>Guide</Button>
            </Tooltip>
            <Tooltip content="Load a pre-built template" relationship="label">
              <Button size="small" appearance="subtle" onClick={() => setTemplateOpen(true)}>Templates</Button>
            </Tooltip>
            <Button size="small" appearance="subtle" onClick={handleExport}>Export</Button>
            <Button size="small" appearance="subtle" onClick={() => fileInputRef.current?.click()}>Import</Button>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />

            <div style={{ width: '1px', height: '24px', background: '#e0e0e0', margin: '0 4px' }} />

            <Tooltip content="Undo (Ctrl+Z)" relationship="label">
              <Button size="small" appearance="subtle" onClick={store.undo} disabled={store.past.length === 0}>↩</Button>
            </Tooltip>
            <Tooltip content="Redo (Ctrl+Y)" relationship="label">
              <Button size="small" appearance="subtle" onClick={store.redo} disabled={store.future.length === 0}>↪</Button>
            </Tooltip>

            <div style={{ width: '1px', height: '24px', background: '#e0e0e0', margin: '0 4px' }} />

            <Tooltip content={errorCount > 0 ? `Fix ${errorCount} error(s) before downloading` : 'Download all artifacts as ZIP'} relationship="label">
              <Button
                appearance="primary"
                size="small"
                onClick={handleDownload}
                disabled={errorCount > 0 || store.resources.length === 0 || downloading}
              >
                {downloading ? 'Packaging...' : 'Download ZIP'}
              </Button>
            </Tooltip>
          </div>
        </header>

        {/* Config header */}
        <ConfigHeader />

        {/* Validation bar — only show when resources exist */}
        {store.resources.length > 0 && (
          <div style={{ padding: '6px 20px', background: '#fff', borderBottom: '1px solid #e8e8e8', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge appearance="filled" color="informative">{store.resources.length} resource{store.resources.length !== 1 ? 's' : ''}</Badge>
            {errorCount > 0 && <Badge appearance="filled" color="danger">{errorCount} error{errorCount !== 1 ? 's' : ''}</Badge>}
            {warnCount > 0 && <Badge appearance="filled" color="warning">{warnCount} warning{warnCount !== 1 ? 's' : ''}</Badge>}
            {errors.filter(e => e.level === 'error').slice(0, 3).map((e, i) => (
              <MessageBar key={i} intent="error" style={{ flex: '1 1 auto', minWidth: '200px' }}>
                <MessageBarBody>{e.message}</MessageBarBody>
              </MessageBar>
            ))}
          </div>
        )}

        {/* Import error banner */}
        {importError && (
          <div style={{ padding: '8px 20px', background: '#fff' }}>
            <MessageBar intent="error">
              <MessageBarBody>Import failed: {importError}</MessageBarBody>
            </MessageBar>
          </div>
        )}

        {/* Welcome banner for new users */}
        {!welcomeDismissed && store.resources.length === 0 && (
          <div style={{
            margin: '16px 20px', padding: '20px 24px', background: '#f0f7ff',
            border: '1px solid #b3d7ff', borderRadius: '8px', position: 'relative',
          }}>
            <button onClick={dismissWelcome} style={{
              position: 'absolute', top: '8px', right: '12px', background: 'none',
              border: 'none', fontSize: '18px', cursor: 'pointer', color: '#666', lineHeight: 1,
            }}>✕</button>
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#0078d4' }}>
              Welcome to Azure MC Builder!
            </div>
            <div style={{ fontSize: '14px', color: '#444', lineHeight: 1.6, marginBottom: '14px' }}>
              Start by loading a <strong>Template</strong> for a pre-built baseline, or click <strong>+ Add Resource</strong> to build from scratch.
              Need help? Click <strong>Guide</strong> for step-by-step deployment instructions.
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Button appearance="primary" size="small" onClick={() => setTemplateOpen(true)}>Browse Templates</Button>
              <Button appearance="outline" size="small" onClick={() => setGuideOpen(true)}>Read Guide</Button>
            </div>
          </div>
        )}

        {/* Main content area */}
        <div style={{ display: 'flex', flex: 1, background: '#f5f5f5' }}>
          {/* Left panel: Resource list */}
          <div style={{
            width: '380px', minWidth: '300px',
            background: '#fff',
            borderRight: '1px solid #e8e8e8',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px',
              borderBottom: '1px solid #f0f0f0',
            }}>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>Resources</span>
              <ResourcePicker />
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <ResourceList />
            </div>
          </div>

          {/* Right panel: Property editor */}
          <div style={{ flex: 1, overflow: 'auto', background: '#fff' }}>
            <PropertyPanel />
          </div>
        </div>

        {/* Bottom: Output preview */}
        <OutputPreview />

        {/* Guide dialog */}
        <GuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />

        {/* Template gallery */}
        <TemplateGallery
          open={templateOpen}
          onClose={() => setTemplateOpen(false)}
          onLoad={(config) => store.loadTemplate(config)}
        />
      </div>
    </FluentProvider>
  );
};

export default App;
