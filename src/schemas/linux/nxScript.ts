import { ResourceSchema } from '../../types';

export const nxScriptSchema: ResourceSchema = {
  resourceName: 'nxScript',
  moduleName: 'nxtools',
  moduleVersion: '1.6.0',
  mofClassName: 'nxScript',
  dscV3TypeName: 'nxtools/nxScript',
  platform: 'Linux',
  description: 'Run custom PowerShell scripts for compliance checking. TestScript returns [bool], GetScript returns @{Reasons=@([Reason]@{Code=...; Phrase=...})}',
  docUrl: 'https://github.com/Azure/nxtools#readme',
  category: 'Custom',
  properties: [
    { name: 'TestScript', description: 'Script that tests compliance — must return [bool] ($true=compliant, $false=non-compliant)', type: 'string', required: true, isKey: true, placeholder: "$val = (sysctl -n net.ipv4.ip_forward 2>/dev/null).Trim(); return ($val -eq '0')" },
    { name: 'GetScript', description: "Script that returns current state — must return @{ Reasons = @([Reason]@{ Code='ConfigName:ResourceName:Category'; Phrase='description' }) }", type: 'string', required: false, isKey: false, placeholder: "$msg = 'Compliant'; return @{ Reasons = @([Reason]@{ Code = 'MyConfig:MyResource:Check'; Phrase = $msg }) }" },
    { name: 'SetScript', description: "Script that applies the desired state (use \"throw 'Audit only'\" for audit-only configs)", type: 'string', required: false, isKey: false, defaultValue: "throw 'Audit only'" },
  ],
};
