import { ConfigurationState } from '../types';
import { v4 as uuidv4 } from 'uuid';

/** Windows Service Monitoring - Ensure critical services are running */
export const windowsServiceMonitoring: ConfigurationState = {
  configName: 'WindowsServiceMonitoring',
  platform: 'Windows',
  mode: 'Audit',
  version: '1.0.0',
  description: 'Ensure critical Windows services are running: W32Time, Windows Defender, Windows Firewall',
  resources: [
    {
      id: uuidv4(), schemaName: 'Service', instanceName: 'W32Time',
      properties: { Name: 'W32Time', State: 'Running', StartupType: 'Automatic', Ensure: 'Present' },
      dependsOn: [],
    },
    {
      id: uuidv4(), schemaName: 'Service', instanceName: 'WinDefend',
      properties: { Name: 'WinDefend', State: 'Running', StartupType: 'Automatic', Ensure: 'Present' },
      dependsOn: [],
    },
    {
      id: uuidv4(), schemaName: 'Service', instanceName: 'MpsSvc',
      properties: { Name: 'MpsSvc', State: 'Running', StartupType: 'Automatic', Ensure: 'Present' },
      dependsOn: [],
    },
  ],
};
