import { ResourceSchema } from '../../types';

export const nxCronJobSchema: ResourceSchema = {
  resourceName: 'nxCronJob',
  moduleName: 'nxtools',
  moduleVersion: '1.6.0',
  mofClassName: 'nxCronJob',
  dscV3TypeName: 'nxtools/nxCronJob',
  platform: 'Linux',
  description: 'Manage cron jobs and scheduled tasks on Linux',
  docUrl: 'https://github.com/Azure/nxtools#readme',
  category: 'System',
  properties: [
    { name: 'Name', description: 'Cron job identifier', type: 'string', required: true, isKey: true, placeholder: 'daily-backup' },
    { name: 'Command', description: 'Command to execute', type: 'string', required: true, isKey: false, placeholder: '/usr/local/bin/backup.sh' },
    { name: 'Schedule', description: 'Cron schedule expression (min hour dom mon dow)', type: 'string', required: true, isKey: false, placeholder: '0 2 * * *' },
    { name: 'User', description: 'User to run the cron job as', type: 'string', required: false, isKey: false, placeholder: 'root' },
    { name: 'Ensure', description: 'Whether the cron job should exist', type: 'string', required: false, isKey: false, enumValues: ['Present', 'Absent'], defaultValue: 'Present' },
  ],
};
