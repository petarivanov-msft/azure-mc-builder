import { ConfigurationState } from '../types';
import { v4 as uuidv4 } from 'uuid';

/** Linux File Permissions Audit */
export const linuxFilePermissions: ConfigurationState = {
  configName: 'LinuxFilePermissions',
  platform: 'Linux',
  mode: 'Audit',
  version: '1.0.0',
  description: 'Audit critical system file permissions: /etc/passwd, /etc/shadow, /etc/group, /etc/gshadow',
  resources: [
    {
      id: uuidv4(), schemaName: 'nxFile', instanceName: 'EtcPasswd',
      properties: { DestinationPath: '/etc/passwd', Ensure: 'Present', Type: 'File', Mode: '0644', Owner: 'root', Group: 'root' },
      dependsOn: [],
    },
    {
      id: uuidv4(), schemaName: 'nxFile', instanceName: 'EtcShadow',
      properties: { DestinationPath: '/etc/shadow', Ensure: 'Present', Type: 'File', Mode: '0640', Owner: 'root', Group: 'root' },
      dependsOn: [],
    },
    {
      id: uuidv4(), schemaName: 'nxFile', instanceName: 'EtcGroup',
      properties: { DestinationPath: '/etc/group', Ensure: 'Present', Type: 'File', Mode: '0644', Owner: 'root', Group: 'root' },
      dependsOn: [],
    },
    {
      id: uuidv4(), schemaName: 'nxFile', instanceName: 'EtcGshadow',
      properties: { DestinationPath: '/etc/gshadow', Ensure: 'Present', Type: 'File', Mode: '0640', Owner: 'root', Group: 'root' },
      dependsOn: [],
    },
  ],
};
