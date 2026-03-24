import { ResourceSchema } from '../../types';

export const nxFileContentReplaceSchema: ResourceSchema = {
  resourceName: 'nxFileContentReplace',
  moduleName: 'nxtools',
  moduleVersion: '1.6.0',
  mofClassName: 'nxFileContentReplace',
  dscV3TypeName: 'nxtools/nxFileContentReplace',
  platform: 'Linux',
  description: 'Search and replace content in files using regex patterns',
  docUrl: 'https://github.com/Azure/nxtools#readme',
  category: 'File System',
  properties: [
    { name: 'FilePath', description: 'Full path to the file', type: 'string', required: true, isKey: true, placeholder: '/etc/ssh/sshd_config' },
    { name: 'EnsureExpectedPattern', description: 'Regex pattern that should exist in the file after replacement', type: 'string', required: true, isKey: true, placeholder: '^PermitRootLogin\\s+no$' },
    { name: 'Ensure', description: 'Whether the pattern should exist', type: 'string', required: false, isKey: false, enumValues: ['Present', 'Absent'], defaultValue: 'Present' },
    { name: 'SearchPattern', description: 'Regex pattern to find and replace', type: 'string', required: false, isKey: false },
    { name: 'ReplacementString', description: 'String to replace the matched pattern with', type: 'string', required: false, isKey: false },
    { name: 'Multiline', description: 'Read whole file as single string for multi-line matching', type: 'boolean', required: false, isKey: false, defaultValue: false },
    { name: 'SimpleMatch', description: 'Use literal string matching instead of regex', type: 'boolean', required: false, isKey: false, defaultValue: false },
    { name: 'CaseSensitive', description: 'Whether matching is case-sensitive', type: 'boolean', required: false, isKey: false, defaultValue: false },
  ],
};
