import React from 'react';
import { Input, Select, Label, Textarea, Tooltip } from '@fluentui/react-components';
import { useConfigStore } from '../store/configStore';

export const ConfigHeader: React.FC = () => {
  const { configName, platform, mode, version, description, setConfigName, setPlatform, setMode, setVersion, setDescription } = useConfigStore();

  const [nameError, setNameError] = React.useState('');

  const handleNameChange = (_: unknown, d: { value: string }) => {
    const v = d.value;
    setConfigName(v);
    if (v && !/^[A-Za-z][A-Za-z0-9_]*$/.test(v)) {
      setNameError('Must start with a letter and contain only letters, numbers, and underscores');
    } else {
      setNameError('');
    }
  };

  const infoIcon: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: '14px', height: '14px', borderRadius: '50%', background: '#e8e8e8',
    fontSize: '9px', fontWeight: 700, color: '#666', marginLeft: '4px', cursor: 'help',
    verticalAlign: 'middle',
  };

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '12px',
      padding: '14px 20px',
      background: '#fff',
      borderBottom: '1px solid #e8e8e8',
      alignItems: 'flex-end',
    }}>
      <div style={{ flex: '1 1 220px', minWidth: '160px' }}>
        <Label size="small" style={{ fontWeight: 600, fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Configuration Name
          <Tooltip content="Used as the DSC configuration identifier. No spaces or special characters." relationship="label">
            <span style={infoIcon}>?</span>
          </Tooltip>
        </Label>
        <Input
          value={configName}
          onChange={handleNameChange}
          style={{ width: '100%', borderColor: nameError ? '#c50f1f' : undefined }}
          appearance="underline"
          size="medium"
        />
        {nameError && <div style={{ fontSize: '11px', color: '#c50f1f', marginTop: '2px' }}>{nameError}</div>}
      </div>
      <div style={{ flex: '0 0 140px' }}>
        <Label size="small" style={{ fontWeight: 600, fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Platform
          <Tooltip content="Windows uses PSDscResources and community DSC modules. Linux uses nxtools. Resources change when you switch." relationship="label">
            <span style={infoIcon}>?</span>
          </Tooltip>
        </Label>
        <Select value={platform} onChange={(_, d) => setPlatform(d.value as 'Windows' | 'Linux')} appearance="underline">
          <option value="Windows">🪟 Windows</option>
          <option value="Linux">🐧 Linux</option>
        </Select>
      </div>
      <div style={{ flex: '0 0 170px' }}>
        <Label size="small" style={{ fontWeight: 600, fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Mode
          <Tooltip content="Audit: reports compliance only — no changes made. Audit & Remediate: automatically fixes drift every ~15 minutes." relationship="label">
            <span style={infoIcon}>?</span>
          </Tooltip>
        </Label>
        <Select value={mode} onChange={(_, d) => setMode(d.value as 'Audit' | 'AuditAndSet')} appearance="underline">
          <option value="Audit">🔍 Audit Only</option>
          <option value="AuditAndSet">🔧 Audit & Remediate</option>
        </Select>
      </div>
      <div style={{ flex: '0 0 100px' }}>
        <Label size="small" style={{ fontWeight: 600, fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Version
          <Tooltip content="Semantic version for your package (e.g. 1.0.0). Increment when you update the configuration." relationship="label">
            <span style={infoIcon}>?</span>
          </Tooltip>
        </Label>
        <Input value={version} onChange={(_, d) => setVersion(d.value)} style={{ width: '100%' }} appearance="underline" />
      </div>
      <div style={{ flex: '1 1 100%' }}>
        <Label size="small" style={{ fontWeight: 600, fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Description
        </Label>
        <Textarea
          value={description}
          onChange={(_, d) => setDescription(d.value)}
          style={{ width: '100%' }}
          appearance="outline"
          resize="vertical"
          size="small"
          placeholder="Optional description of this configuration package"
        />
      </div>
    </div>
  );
};
