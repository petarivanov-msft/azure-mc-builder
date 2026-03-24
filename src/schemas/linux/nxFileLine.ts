import { ResourceSchema } from '../../types';

export const nxFileLineSchema: ResourceSchema = {
  resourceName: 'nxFileLine',
  moduleName: 'nxtools',
  moduleVersion: '1.6.0',
  mofClassName: 'nxFileLine',
  dscV3TypeName: 'nxtools/nxFileLine',
  platform: 'Linux',
  description: 'Ensure a specific line exists or is absent in a file',
  docUrl: 'https://github.com/Azure/nxtools#readme',
  category: 'File System',
  properties: [
    { name: 'FilePath', description: 'Full path to the file to manage lines in', type: 'string', required: true, isKey: true, placeholder: '/etc/ssh/sshd_config' },
    { name: 'ContainsLine', description: 'A line to ensure exists in the file (appended if missing)', type: 'string', required: true, isKey: true, placeholder: 'PermitRootLogin no' },
    { name: 'DoesNotContainPattern', description: 'Regex for lines that should NOT exist (matching lines are removed)', type: 'string', required: false, isKey: false },
    { name: 'CaseSensitive', description: 'Whether line matching is case-sensitive', type: 'boolean', required: false, isKey: false, defaultValue: false },
    { name: 'AddLineMode', description: 'Where to add the line: Append, AfterLinePatternMatch, or BeforeLinePatternMatch', type: 'string', required: false, isKey: false, enumValues: ['Append', 'AfterLinePatternMatch', 'BeforeLinePatternMatch'], defaultValue: 'Append' },
    { name: 'LinePattern', description: 'Regex pattern for positioning the line (used with AfterLinePatternMatch/BeforeLinePatternMatch)', type: 'string', required: false, isKey: false },
  ],
};
