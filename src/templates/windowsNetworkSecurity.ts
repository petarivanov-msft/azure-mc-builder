import { ConfigurationState } from '../types';
import { v4 as uuidv4 } from 'uuid';

/** Windows Network Security — firewall rules and network hardening */
export const windowsNetworkSecurity: ConfigurationState = {
  configName: 'WindowsNetworkSecurity',
  platform: 'Windows',
  mode: 'Audit',
  version: '1.0.0',
  description: 'Firewall rules and network hardening for Windows Server — block management ports, allow HTTPS, ensure firewall service running',
  resources: [
    { id: uuidv4(), schemaName: 'Firewall', instanceName: 'AllowHTTPS',
      properties: { Name: 'AllowHTTPS', Direction: 'Inbound', Action: 'Allow', LocalPort: ['443'], Protocol: 'TCP', Profile: ['Domain', 'Private', 'Public'], Ensure: 'Present', Enabled: 'True', DisplayName: 'Allow HTTPS Inbound' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'Firewall', instanceName: 'BlockRDPPublic',
      properties: { Name: 'BlockRDPPublic', Direction: 'Inbound', Action: 'Block', LocalPort: ['3389'], Protocol: 'TCP', Profile: ['Public'], Ensure: 'Present', Enabled: 'True', DisplayName: 'Block RDP on Public Profile' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'Firewall', instanceName: 'BlockSMB',
      properties: { Name: 'BlockSMBInbound', Direction: 'Inbound', Action: 'Block', LocalPort: ['445'], Protocol: 'TCP', Profile: ['Public'], Ensure: 'Present', Enabled: 'True', DisplayName: 'Block SMB on Public Profile' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'Firewall', instanceName: 'BlockWinRM',
      properties: { Name: 'BlockWinRMPublic', Direction: 'Inbound', Action: 'Block', LocalPort: ['5985', '5986'], Protocol: 'TCP', Profile: ['Public'], Ensure: 'Present', Enabled: 'True', DisplayName: 'Block WinRM on Public Profile' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'Service', instanceName: 'FirewallService',
      properties: { Name: 'MpsSvc', State: 'Running', StartupType: 'Automatic', Ensure: 'Present' }, dependsOn: [] },
  ],
};
