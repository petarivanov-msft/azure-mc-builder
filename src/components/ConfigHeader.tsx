import React from 'react';
import { Input, Select, Label, Textarea } from '@fluentui/react-components';
import { useConfigStore } from '../store/configStore';

export const ConfigHeader: React.FC = () => {
  const { configName, platform, mode, version, description, setConfigName, setPlatform, setMode, setVersion, setDescription } = useConfigStore();

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
        </Label>
        <Input
          value={configName}
          onChange={(_, d) => setConfigName(d.value)}
          style={{ width: '100%' }}
          appearance="underline"
          size="medium"
        />
      </div>
      <div style={{ flex: '0 0 140px' }}>
        <Label size="small" style={{ fontWeight: 600, fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Platform
        </Label>
        <Select value={platform} onChange={(_, d) => setPlatform(d.value as 'Windows' | 'Linux')} appearance="underline">
          <option value="Windows">🪟 Windows</option>
          <option value="Linux">🐧 Linux</option>
        </Select>
      </div>
      <div style={{ flex: '0 0 170px' }}>
        <Label size="small" style={{ fontWeight: 600, fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Mode
        </Label>
        <Select value={mode} onChange={(_, d) => setMode(d.value as 'Audit' | 'AuditAndSet')} appearance="underline">
          <option value="Audit">🔍 Audit Only</option>
          <option value="AuditAndSet">🔧 Audit & Remediate</option>
        </Select>
      </div>
      <div style={{ flex: '0 0 100px' }}>
        <Label size="small" style={{ fontWeight: 600, fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Version
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
