import { ResourceSchema } from '../../types';

export const windowsProcessSchema: ResourceSchema = {
  resourceName: 'WindowsProcess',
  moduleName: 'PSDscResources',
  moduleVersion: '2.12.0.0',
  mofClassName: 'MSFT_WindowsProcess',
  dscV3TypeName: 'PSDscResources/WindowsProcess',
  platform: 'Windows',
  description: 'Ensure a process is running or stopped',
  docUrl: 'https://learn.microsoft.com/powershell/dsc/reference/psdscresources/resources/windowsprocess/windowsprocess',
  category: 'System',
  properties: [
    { name: 'Path', description: 'Full path to the process executable', type: 'string', required: true, isKey: true, placeholder: 'C:\\Program Files\\MyApp\\app.exe' },
    { name: 'Arguments', description: 'Command-line arguments', type: 'string', required: true, isKey: true },
    { name: 'Ensure', description: 'Present (running) or Absent (stopped)', type: 'string', required: false, isKey: false, enumValues: ['Present', 'Absent'], defaultValue: 'Present' },
    { name: 'Credential', description: 'Credential to run the process', type: 'string', required: false, isKey: false },
    { name: 'StandardOutputPath', description: 'Path to redirect stdout', type: 'string', required: false, isKey: false },
    { name: 'StandardErrorPath', description: 'Path to redirect stderr', type: 'string', required: false, isKey: false },
    { name: 'StandardInputPath', description: 'Path to redirect stdin', type: 'string', required: false, isKey: false },
    { name: 'WorkingDirectory', description: 'Working directory', type: 'string', required: false, isKey: false },
  ],
};
