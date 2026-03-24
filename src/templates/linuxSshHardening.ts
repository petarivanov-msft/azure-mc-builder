import { ConfigurationState } from '../types';
import { v4 as uuidv4 } from 'uuid';

/** Linux SSH Hardening */
export const linuxSshHardening: ConfigurationState = {
  configName: 'LinuxSSHHardening',
  platform: 'Linux',
  mode: 'Audit',
  version: '1.0.0',
  description: 'SSH hardening: disable root login, disable password auth, limit auth tries, secure permissions, ensure sshd running',
  resources: [
    {
      id: uuidv4(), schemaName: 'nxFile', instanceName: 'SSHConfigPerms',
      properties: { DestinationPath: '/etc/ssh/sshd_config', Ensure: 'Present', Type: 'File', Mode: '0600', Owner: 'root', Group: 'root' },
      dependsOn: [],
    },
    {
      id: uuidv4(), schemaName: 'nxFileLine', instanceName: 'DisableRootLogin',
      properties: { FilePath: '/etc/ssh/sshd_config', ContainsLine: 'PermitRootLogin no', DoesNotContainPattern: '^PermitRootLogin\\s+yes' },
      dependsOn: [],
    },
    {
      id: uuidv4(), schemaName: 'nxFileLine', instanceName: 'DisablePasswordAuth',
      properties: { FilePath: '/etc/ssh/sshd_config', ContainsLine: 'PasswordAuthentication no', DoesNotContainPattern: '^PasswordAuthentication\\s+yes' },
      dependsOn: [],
    },
    {
      id: uuidv4(), schemaName: 'nxFileLine', instanceName: 'LimitAuthTries',
      properties: { FilePath: '/etc/ssh/sshd_config', ContainsLine: 'MaxAuthTries 4', DoesNotContainPattern: '^MaxAuthTries\\s+[5-9]' },
      dependsOn: [],
    },
    {
      id: uuidv4(), schemaName: 'nxService', instanceName: 'SSHD',
      properties: { Name: 'sshd', State: 'Running', Enabled: true },
      dependsOn: [],
    },
  ],
};
