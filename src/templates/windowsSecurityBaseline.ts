import { ConfigurationState } from '../types';
import { v4 as uuidv4 } from 'uuid';

/** Windows Security Baseline (CIS Level 1) - Registry checks */
export const windowsSecurityBaseline: ConfigurationState = {
  configName: 'WindowsSecurityBaseline',
  platform: 'Windows',
  mode: 'Audit',
  version: '1.0.0',
  description: 'CIS-aligned Windows security baseline: TLS hardening, Defender, Firewall, WDigest, audit logging',
  resources: [
    { id: uuidv4(), schemaName: 'Registry', instanceName: 'DisableTLS10', properties: { Key: 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SecurityProviders\\SCHANNEL\\Protocols\\TLS 1.0\\Server', ValueName: 'Enabled', ValueType: 'Dword', ValueData: ['0'], Ensure: 'Present' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'Registry', instanceName: 'EnableTLS12', properties: { Key: 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SecurityProviders\\SCHANNEL\\Protocols\\TLS 1.2\\Server', ValueName: 'Enabled', ValueType: 'Dword', ValueData: ['1'], Ensure: 'Present' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'Registry', instanceName: 'DisableWDigest', properties: { Key: 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SecurityProviders\\WDigest', ValueName: 'UseLogonCredential', ValueType: 'Dword', ValueData: ['0'], Ensure: 'Present' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'Registry', instanceName: 'EnablePUADetection', properties: { Key: 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows Defender', ValueName: 'PUAProtection', ValueType: 'Dword', ValueData: ['1'], Ensure: 'Present' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'Registry', instanceName: 'DontDisableDefender', properties: { Key: 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows Defender', ValueName: 'DisableAntiSpyware', ValueType: 'Dword', ValueData: ['0'], Ensure: 'Present' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'Registry', instanceName: 'EnableRealtimeProtection', properties: { Key: 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows Defender\\Real-Time Protection', ValueName: 'DisableRealtimeMonitoring', ValueType: 'Dword', ValueData: ['0'], Ensure: 'Present' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'Registry', instanceName: 'EnableScriptScanning', properties: { Key: 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows Defender\\Real-Time Protection', ValueName: 'DisableScriptScanning', ValueType: 'Dword', ValueData: ['0'], Ensure: 'Present' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'Registry', instanceName: 'SafeDllSearchMode', properties: { Key: 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager', ValueName: 'SafeDllSearchMode', ValueType: 'Dword', ValueData: ['1'], Ensure: 'Present' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'Registry', instanceName: 'DomainFirewallOn', properties: { Key: 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\WindowsFirewall\\DomainProfile', ValueName: 'EnableFirewall', ValueType: 'Dword', ValueData: ['1'], Ensure: 'Present' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'Registry', instanceName: 'PrivateFirewallOn', properties: { Key: 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\WindowsFirewall\\PrivateProfile', ValueName: 'EnableFirewall', ValueType: 'Dword', ValueData: ['1'], Ensure: 'Present' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'Registry', instanceName: 'PublicFirewallOn', properties: { Key: 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\WindowsFirewall\\PublicProfile', ValueName: 'EnableFirewall', ValueType: 'Dword', ValueData: ['1'], Ensure: 'Present' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'Registry', instanceName: 'WinRMClientNoUnencrypted', properties: { Key: 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WinRM\\Client', ValueName: 'AllowUnencryptedTraffic', ValueType: 'Dword', ValueData: ['0'], Ensure: 'Present' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'Registry', instanceName: 'WinRMServiceNoUnencrypted', properties: { Key: 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WinRM\\Service', ValueName: 'AllowUnencryptedTraffic', ValueType: 'Dword', ValueData: ['0'], Ensure: 'Present' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'Registry', instanceName: 'CmdLineAuditLogging', properties: { Key: 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System\\Audit', ValueName: 'ProcessCreationIncludeCmdLine_Enabled', ValueType: 'Dword', ValueData: ['1'], Ensure: 'Present' }, dependsOn: [] },
  ],
};
