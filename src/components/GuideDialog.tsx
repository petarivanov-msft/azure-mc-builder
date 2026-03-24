import React from 'react';
import {
  Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions,
  DialogTrigger, Button,
} from '@fluentui/react-components';

const code: React.CSSProperties = {
  display: 'block', background: '#f5f5f5', padding: '12px 16px', borderRadius: '6px',
  fontFamily: 'Consolas, "Courier New", monospace', fontSize: '12.5px', lineHeight: 1.5,
  overflowX: 'auto', whiteSpace: 'pre', margin: '8px 0 16px',
  border: '1px solid #e0e0e0',
};

const h2: React.CSSProperties = { fontSize: '16px', fontWeight: 600, margin: '24px 0 8px', color: '#0078d4' };
const p: React.CSSProperties = { fontSize: '13.5px', lineHeight: 1.6, margin: '6px 0', color: '#444' };
const li: React.CSSProperties = { fontSize: '13.5px', lineHeight: 1.7, color: '#444' };
const tip: React.CSSProperties = {
  background: '#f0f7ff', border: '1px solid #b3d7ff', borderRadius: '6px',
  padding: '12px 16px', margin: '8px 0', fontSize: '13px', lineHeight: 1.6,
};

interface Props { open: boolean; onClose: () => void; }

export const GuideDialog: React.FC<Props> = ({ open, onClose }) => (
  <Dialog open={open} onOpenChange={(_, d) => { if (!d.open) onClose(); }}>
    <DialogSurface style={{ maxWidth: '820px' }}>
      <DialogBody>
        <DialogTitle>Getting Started with Azure Machine Configuration</DialogTitle>
        <DialogContent style={{ overflowY: 'auto', maxHeight: '70vh' }}>

          <p style={p}>
            This tool helps you visually build <strong>Azure Machine Configuration</strong> (formerly Guest Configuration) packages —
            the DSC-based compliance engine behind Azure Policy. No PowerShell authoring required.
          </p>

          {/* Step 1 */}
          <h2 style={h2}>Step 1 — Build Your Configuration</h2>
          <ol>
            <li style={li}>Set a <strong>Configuration Name</strong> (e.g. <code>WindowsSecurityBaseline</code>) — no spaces allowed</li>
            <li style={li}>Choose <strong>Platform</strong> — Windows or Linux</li>
            <li style={li}>Choose <strong>Mode</strong>: <em>Audit</em> (report only) or <em>Audit and Enforce</em> (auto-remediate)</li>
            <li style={li}>Click <strong>+ Add Resource</strong> to pick DSC resources</li>
            <li style={li}>Configure each resource's properties in the right panel</li>
            <li style={li}>Preview generated code in the <strong>Output Preview</strong> at the bottom</li>
            <li style={li}>Click <strong>Download ZIP</strong> when ready</li>
          </ol>

          {/* Step 2 */}
          <h2 style={h2}>Step 2 — What's in the ZIP</h2>
          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', margin: '8px 0 16px' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>
                <th style={{ padding: '6px 8px' }}>File</th>
                <th style={{ padding: '6px 8px' }}>Purpose</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['<Name>.mof', 'Compiled configuration — the GC agent reads this'],
                ['<Name>.ps1', 'PowerShell DSC script (human-readable version)'],
                ['policy.json', 'Azure Policy definition template'],
                ['package.ps1', 'Helper script that builds the deployable package'],
                ['metaconfig.json', 'Package metadata (reference copy — package.ps1 embeds this automatically)'],
                ['README.md', 'Full deployment instructions'],
              ].map(([file, desc], i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: '12px' }}>{file}</td>
                  <td style={{ padding: '6px 8px' }}>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Step 3 */}
          <h2 style={h2}>Step 3 — Create the MC Package</h2>
          <p style={p}>You need <strong>PowerShell 7+</strong> on your machine (Windows, Mac, or Linux). Run <code>pwsh</code> (not <code>powershell</code> — that's Windows PowerShell 5.1 and won't work).</p>
          <pre style={code}>{`# Extract the ZIP, then run:
pwsh ./package.ps1`}</pre>
          <p style={p}>The script automatically installs the <code>GuestConfiguration</code> module and all required DSC resource modules (detected from the MOF), bundles them into a deployable <code>.zip</code> via <code>New-GuestConfigurationPackage</code>, and runs a local compliance test.</p>

          {/* Step 4 */}
          <h2 style={h2}>Step 4 — Upload to Azure Blob Storage</h2>
          <p style={p}>The container can stay private — the SAS token grants read access for the MC agent.</p>
          <pre style={code}>{`# Create storage account and container (or use existing)
New-AzStorageAccount -ResourceGroupName 'myRG' -Name 'mcpackages' -Location 'uksouth' -SkuName 'Standard_LRS'
$ctx = (Get-AzStorageAccount -ResourceGroupName 'myRG' -Name 'mcpackages').Context
New-AzStorageContainer -Name 'guestconfig' -Context $ctx

# Upload the package
Set-AzStorageBlobContent -Container 'guestconfig' -File '.\\output\\MyConfig.zip' -Blob 'MyConfig.zip' -Context $ctx

# Get a download URL (SAS token, valid 3 years)
$uri = New-AzStorageBlobSASToken -Container 'guestconfig' -Blob 'MyConfig.zip' \\
  -Permission r -ExpiryTime (Get-Date).AddYears(3) -Context $ctx -FullUri`}</pre>

          {/* Step 5 */}
          <h2 style={h2}>Step 5 — Deploy the Azure Policy</h2>
          <p style={p}>You need the <strong>Az PowerShell module</strong> (<code>Install-Module Az -Scope CurrentUser</code>) and must be signed in (<code>Connect-AzAccount</code>).</p>
          <ol>
            <li style={li}>Open the <code>policy.json</code> from your ZIP</li>
            <li style={li}>Replace <code>{'{{contentUri}}'}</code> with the blob SAS URL from Step 4</li>
            <li style={li}>Replace <code>{'{{contentHash}}'}</code> with the SHA256 hash (printed by <code>package.ps1</code>)</li>
            <li style={li}>Create and assign the policy:</li>
          </ol>
          <pre style={code}>{`# Create the policy definition
New-AzPolicyDefinition -Name 'MyConfig' -Policy './policy.json' -Mode 'Indexed'

# Assign to a resource group (or subscription/management group)
New-AzPolicyAssignment -Name 'MyConfig' \\
  -PolicyDefinition (Get-AzPolicyDefinition -Name 'MyConfig') \\
  -Scope '/subscriptions/<sub-id>/resourceGroups/<rg-name>'`}</pre>

          {/* Step 6 */}
          <h2 style={h2}>Step 6 — VM Prerequisites</h2>
          <p style={p}>Target VMs need the <strong>Guest Configuration extension</strong> and a <strong>system-assigned managed identity</strong>. Assign this built-in initiative at your subscription level:</p>
          <div style={{ background: '#f0f6ff', border: '1px solid #b3d4ff', borderRadius: '6px', padding: '12px 14px', margin: '8px 0 12px', fontSize: '12.5px' }}>
            <strong>Deploy prerequisites to enable Guest Configuration policies on virtual machines</strong><br />
            <code style={{ fontSize: '11px' }}>12794019-7a00-42cf-95c2-882eed337cc8</code>
          </div>
          <p style={{ ...p, fontSize: '12px', color: '#666' }}>This single initiative handles everything — MC extension (Windows &amp; Linux) and system-assigned managed identity. The GC agent starts evaluating within 15 minutes.</p>

          {/* Tips */}
          <h2 style={h2}>Tips</h2>
          <div style={tip}>
            <strong>Test locally first</strong> — Run <code>Test-GuestConfigurationPackage -Path ./output/MyConfig.zip</code> before uploading to Azure.
          </div>
          <div style={tip}>
            <strong>Start with Audit</strong> — Use Audit mode first to see compliance status. Switch to Audit and Enforce only when you're confident the configuration is correct.
          </div>
          <div style={tip}>
            <strong>Templates</strong> — Use the Templates button to start from a pre-built security baseline (CIS-aligned) instead of building from scratch.
          </div>
          <div style={{ ...tip, background: '#fff8f0', borderColor: '#ffd699' }}>
            <strong>pwsh, not powershell</strong> — Run <code>pwsh</code> (PowerShell 7+), not <code>powershell</code> (Windows PowerShell 5.1). The script requires PowerShell 7 features and will fail on 5.1.
          </div>

          {/* FAQ */}
          <h2 style={h2}>FAQ</h2>
          {[
            ['What is Azure Machine Configuration?',
             'It\'s Azure\'s built-in way to audit and enforce OS-level settings on VMs (registry keys, files, services, packages, etc.) using DSC and Azure Policy. Think of it as Group Policy but cloud-native and cross-platform.'],
            ['What\'s the difference between Audit and Audit & Enforce?',
             'Audit only reports whether a VM is compliant. Audit & Enforce will also automatically fix drift — if a setting changes, the GC agent corrects it on the next evaluation cycle (every ~15 min).'],
            ['Do I need PowerShell to use this?',
             'You need PowerShell 7+ to run package.ps1 and create the deployable package. The builder itself generates all the files — you don\'t need to write any PowerShell.'],
            ['Can I use this for both Windows and Linux?',
             'Yes. Pick your platform when building the configuration. Windows uses PSDscResources and community modules. Linux uses nxtools.'],
            ['What DSC modules are included?',
             'PSDscResources (built-in Windows), SecurityPolicyDsc, AuditPolicyDsc, NetworkingDsc, ComputerManagementDsc, and nxtools (Linux). 29 resources total.'],
            ['Can I add my own custom DSC resources?',
             'Not yet — custom resource import is on the roadmap. For now you can manually edit the generated .ps1 file to add resources the builder doesn\'t cover.'],
            ['Do VMs need internet access?',
             'They need outbound HTTPS to Azure endpoints for the GC extension to pull packages and report compliance. No inbound ports required.'],
            ['How long until I see compliance results?',
             'The GC agent evaluates every 15 minutes. After assigning the policy, allow up to 30 minutes for initial results to appear in the Azure portal under Policy → Compliance.'],
          ].map(([q, a], i) => (
            <div key={i} style={{ marginBottom: '12px' }}>
              <p style={{ ...p, fontWeight: 600, margin: '4px 0 2px' }}>{q}</p>
              <p style={{ ...p, margin: '2px 0 0' }}>{a}</p>
            </div>
          ))}

          <p style={{ ...p, marginTop: '20px', fontSize: '12.5px', color: '#888' }}>
            📖 Full documentation: <a href="https://learn.microsoft.com/azure/governance/machine-configuration/overview" target="_blank" rel="noopener noreferrer" style={{ color: '#0078d4' }}>Azure Machine Configuration docs</a>
          </p>

        </DialogContent>
        <DialogActions>
          <DialogTrigger disableButtonEnhancement>
            <Button appearance="primary" onClick={onClose}>Got it</Button>
          </DialogTrigger>
        </DialogActions>
      </DialogBody>
    </DialogSurface>
  </Dialog>
);
