import { ResourceSchema } from '../../types';

export const nxFileSchema: ResourceSchema = {
  resourceName: 'nxFile',
  moduleName: 'nxtools',
  moduleVersion: '1.6.0',
  mofClassName: 'nxFile',
  dscV3TypeName: 'nxtools/nxFile',
  platform: 'Linux',
  description: 'Manage files, directories, and symlinks on Linux',
  docUrl: 'https://github.com/Azure/nxtools#readme',
  category: 'File System',
  properties: [
    { name: 'DestinationPath', description: 'Full path to the file or directory', type: 'string', required: true, isKey: true, placeholder: '/etc/myapp/config.conf' },
    { name: 'Ensure', description: 'Whether the resource should exist', type: 'string', required: false, isKey: false, enumValues: ['Present', 'Absent'], defaultValue: 'Present' },
    { name: 'SourcePath', description: 'Source path to copy from', type: 'string', required: false, isKey: false },
    { name: 'Type', description: 'File, Directory, or Link', type: 'string', required: false, isKey: false, enumValues: ['File', 'Directory', 'Link'], defaultValue: 'File' },
    { name: 'Contents', description: 'File contents to ensure', type: 'string', required: false, isKey: false },
    { name: 'Checksum', description: 'Comparison method: ctime, mtime, or md5', type: 'string', required: false, isKey: false, enumValues: ['ctime', 'mtime', 'md5'] },
    { name: 'Mode', description: 'Permissions in octal (e.g., 0644)', type: 'string', required: false, isKey: false, placeholder: '0644' },
    { name: 'Force', description: 'Force the operation', type: 'boolean', required: false, isKey: false, defaultValue: false },
    { name: 'Recurse', description: 'Apply recursively to directories', type: 'boolean', required: false, isKey: false, defaultValue: false },
    { name: 'Owner', description: 'File owner', type: 'string', required: false, isKey: false, placeholder: 'root' },
    { name: 'Group', description: 'File group', type: 'string', required: false, isKey: false, placeholder: 'root' },
  ],
};
