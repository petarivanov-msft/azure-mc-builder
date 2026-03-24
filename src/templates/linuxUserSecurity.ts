import { ConfigurationState } from '../types';
import { v4 as uuidv4 } from 'uuid';

/** Linux User Security — user/group hardening with nxScript */
export const linuxUserSecurity: ConfigurationState = {
  configName: 'LinuxUserSecurity',
  platform: 'Linux',
  mode: 'Audit',
  version: '1.0.0',
  description: 'Linux user and group security: verify root group, audit /etc/shadow and /etc/passwd permissions, check login.defs password policy',
  resources: [
    { id: uuidv4(), schemaName: 'nxGroup', instanceName: 'RootGroup',
      properties: { GroupName: 'root', Ensure: 'Present' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'nxFile', instanceName: 'EtcPasswdPerms',
      properties: { DestinationPath: '/etc/passwd', Ensure: 'Present', Type: 'File', Mode: '0644', Owner: 'root' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'nxFile', instanceName: 'EtcShadowPerms',
      properties: { DestinationPath: '/etc/shadow', Ensure: 'Present', Type: 'File', Mode: '0640', Owner: 'root' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'nxFileLine', instanceName: 'PasswordMinDays',
      properties: { FilePath: '/etc/login.defs', ContainsLine: 'PASS_MIN_DAYS 7', DoesNotContainPattern: '^PASS_MIN_DAYS\\s+[0-6]$' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'nxFileLine', instanceName: 'PasswordMaxDays',
      properties: { FilePath: '/etc/login.defs', ContainsLine: 'PASS_MAX_DAYS 365', DoesNotContainPattern: '^PASS_MAX_DAYS\\s+99999' }, dependsOn: [] },
    { id: uuidv4(), schemaName: 'nxScript', instanceName: 'NoUidZeroBesideRoot',
      properties: {
        TestScript: "$users = @(awk -F: '($3 == 0 && $1 != \"root\") {print $1}' /etc/passwd 2>/dev/null); return ($users.Count -eq 0)",
        GetScript: "$users = @(awk -F: '($3 == 0) {print $1}' /etc/passwd 2>/dev/null); if ($users.Count -le 1) { $msg = 'Only root has UID 0' } else { $msg = \"Non-root UID 0 accounts found: $($users -join ', ')\" }; return @{ Reasons = @([Reason]@{ Code = 'LinuxUserSecurity:NoUidZeroBesideRoot:UIDCheck'; Phrase = $msg }) }",
        SetScript: "throw 'Audit only — remove non-root UID 0 accounts manually'",
      },
      dependsOn: [],
    },
  ],
};
