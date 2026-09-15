import React from 'react';
import {
  Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, Button,
} from '@fluentui/react-components';

const code: React.CSSProperties = {
  background: '#f5f5f5', padding: '12px 16px', border: '1px solid #e0e0e0', borderRadius: '6px',
  whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', font: '12.5px/1.6 Consolas, monospace',
};
const heading: React.CSSProperties = { fontSize: '16px', color: '#0078d4', marginTop: '24px' };
const note: React.CSSProperties = { background: '#f0f7ff', borderLeft: '3px solid #0078d4', padding: '12px 16px' };
interface Props { open: boolean; onClose: () => void; }

export const GuideDialog: React.FC<Props> = ({ open, onClose }) => (
  <Dialog open={open} onOpenChange={(_, data) => { if (!data.open) onClose(); }}>
    <DialogSurface style={{ maxWidth: '820px' }}>
      <DialogBody>
        <DialogTitle>Build, test and publish a source project</DialogTitle>
        <DialogContent style={{ overflowY: 'auto', maxHeight: '70vh', fontSize: '13.5px', lineHeight: 1.6 }}>
          <p>The browser is the visual editor. Microsoft's PowerShell tools compile the configuration, build the package and generate its Azure Policy definition after download.</p>
          <h2 style={heading}>1. Configure and download</h2>
          <p>Choose Windows or Linux, select Audit or Audit &amp; Remediate, and add resources or load a template. Resolve validation errors, inspect the source tabs, then choose <strong>Download source project</strong>.</p>
          <p>Your saved configuration JSON remains importable. Policy identity is preserved across edits, exports and refreshes.</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ textAlign: 'left' }}>Source file</th><th style={{ textAlign: 'left' }}>Purpose</th></tr></thead>
            <tbody>{[
              ['Configuration.ps1', 'DSC source consumed by the official compiler'],
              ['config.json', 'Editable configuration, dependencies and stable policy identity'],
              ['toolchain.lock.json', 'Pinned tool and resource versions'],
              ['package.ps1 / compile.ps1', 'Build orchestration and compiler entry point'],
              ['test.ps1', 'Explicit package evaluation and optional lab remediation'],
              ['deploy.ps1 / McBuilder.psm1', 'Shared publishing wrapper and runtime'],
              ['README.md', 'Instructions tailored to your platform and mode'],
            ].map(([file, purpose]) => (
              <tr key={file} style={{ borderBottom: '1px solid #e8e8e8' }}>
                <td style={{ padding: '8px', fontFamily: 'Consolas, monospace' }}>{file}</td>
                <td style={{ padding: '8px' }}>{purpose}</td>
              </tr>
            ))}</tbody>
          </table>
          <h2 style={heading}>2. Compile and package</h2>
          <p>Extract the project and use <strong>PowerShell 7.2+</strong> on a qualified Windows or Ubuntu authoring host. Use <code>pwsh</code>, not Windows PowerShell 5.1. Cross-OS compilation and macOS authoring are not promised.</p>
          <pre style={code}>pwsh ./package.ps1 -RestoreTools</pre>
          <p>This explicitly restores locked dependencies into a local cache, compiles the DSC source and calls <code>New-GuestConfigurationPackage</code>. The real MOF, package metadata and ZIP are created here, not in the browser.</p>
          <h2 style={heading}>3. Validate on a trusted test host</h2>
          <p>Review source and modules first. Even Get/Test can execute code. Test on a matching-OS host; Linux evaluation requires an explicitly elevated/root shell.</p>
          <pre style={code}>{`# Audit evaluation
pwsh ./test.ps1 -AcknowledgeExecution

# AuditAndSet: only on a disposable test host
pwsh ./test.ps1 -AcknowledgeExecution -Remediate -DisposableEnvironment`}</pre>
          <div style={{ ...note, background: '#fff8f0', borderColor: '#d18616' }}>
            <strong>Remediation changes the test machine.</strong> Both the Set report and subsequent Get must succeed. Validation is bound to the exact package bytes; editing source or package files requires rebuilding and testing again.
          </div>
          <p>For <code>nxFile</code> creation in AuditAndSet mode, explicitly choose <strong>Mode, Owner and Group</strong>. They are not silently defaulted to root.</p>
          <h2 style={heading}>4. Publish the definition</h2>
          <p>Provision private blob storage and the required permissions first. The publisher needs Storage Blob Data Contributor at storage-account scope and Resource Policy Contributor at subscription scope.</p>
          <pre style={code}>{`pwsh ./deploy.ps1 -RestoreTools -TenantId 'Your-Tenant-ID' -SubscriptionId 'Your-Subscription-ID' -StorageAccountName 'YourStorageAccount'`}</pre>
          <p>The script uploads the validated ZIP, creates a read-only HTTPS user-delegation SAS, calls <code>New-GuestConfigurationPolicy</code>, verifies the hash and upserts the definition. It does not create storage accounts, grant roles, assign policies or start remediation.</p>
          <p>Use <code>-UseAzureCli</code> to explicitly reuse an existing CLI login, or <code>-SkipLogin</code> with the exact Azure PowerShell tenant/subscription already selected. Renew the six-day SAS before expiry by redeploying the same validated package.</p>
          <h2 style={heading}>5. Prepare targets and assign explicitly</h2>
          <p>Azure VMs need the Machine Configuration extension and a system-assigned identity. The built-in prerequisites initiative can provision these:</p>
          <div style={note}><strong>Deploy prerequisites to enable Guest Configuration policies on virtual machines</strong><br /><code>12794019-7a00-42cf-95c2-882eed337cc8</code></div>
          <p>Follow the downloaded README to assign the policy in a reviewed scope. AuditAndSet assignments need their own managed identity, the required role and an explicit initial remediation task for existing machines. Arc inclusion is explicit and may incur charges; VM scale sets are excluded.</p>
          <h2 style={heading}>6. Check guest-level results</h2>
          <p>A successful remediation deployment means the guest assignment was deployed, not that the configuration has become compliant. Check the resource-level report and its reasons. An initial audit may report drift before a later auto-correct cycle.</p>
          <p>Before changing release names, review older corrective assignments to avoid competing configurations. Preserve package bytes and policy snapshots for rollback; no assignments are deleted automatically.</p>
          <p><a href="https://learn.microsoft.com/azure/governance/machine-configuration/how-to/develop-custom-package/1-set-up-authoring-environment" target="_blank" rel="noopener noreferrer">Microsoft's authoring documentation</a></p>
        </DialogContent>
        <DialogActions><Button appearance="primary" onClick={onClose}>Got it</Button></DialogActions>
      </DialogBody>
    </DialogSurface>
  </Dialog>
);
