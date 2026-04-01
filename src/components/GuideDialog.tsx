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
                ['deploy.ps1', 'Deploy script — uploads to blob storage and creates the policy definition'],
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
          <h2 style={h2}>Step 4 — Deploy to Azure</h2>
          <p style={p}>The <code>deploy.ps1</code> script handles everything — uploads the package to Azure Blob Storage and creates the Azure Policy definition. You need the <strong>Az PowerShell module</strong> (<code>Install-Module Az -Scope CurrentUser</code>).</p>
          <pre style={code}>{`# Run the deploy script (authenticates, uploads, creates policy)
pwsh ./deploy.ps1`}</pre>
          <p style={p}>The script will:</p>
          <ol>
            <li style={li}>Connect to your Azure account (if not already signed in)</li>
            <li style={li}>Create or use an existing storage account and container</li>
            <li style={li}>Upload the package ZIP with a SAS token</li>
            <li style={li}>Create the Azure Policy definition with the correct content URI and hash</li>
          </ol>
          <p style={p}>After deployment, assign the policy from the Azure Portal or PowerShell.</p>

          <details style={{ margin: '8px 0 16px', fontSize: '13px' }}>
            <summary style={{ cursor: 'pointer', color: '#0078d4', fontWeight: 600 }}>Manual deployment (alternative)</summary>
            <p style={p}>If you prefer to deploy manually instead of using <code>deploy.ps1</code>:</p>
            <pre style={code}>{`# Upload to blob storage
$ctx = (Get-AzStorageAccount -ResourceGroupName 'myRG' -Name 'mcpackages').Context
Set-AzStorageBlobContent -Container 'guestconfig' -File './output/MyConfig.zip' -Blob 'MyConfig.zip' -Context $ctx

# Generate SAS URL
$uri = New-AzStorageBlobSASToken -Container 'guestconfig' -Blob 'MyConfig.zip' \\
  -Permission r -ExpiryTime (Get-Date).AddYears(3) -Context $ctx -FullUri

# Create policy definition (replace placeholders in policy.json first)
New-AzPolicyDefinition -Name 'MC-MyConfig' -Policy './policy.json' -Mode 'Indexed'`}</pre>
          </details>

          {/* Step 5 */}
          <h2 style={h2}>Step 5 — VM Prerequisites</h2>
          <p style={p}>Target VMs need the <strong>Guest Configuration extension</strong> and a <strong>system-assigned managed identity</strong>. Assign this built-in initiative at your subscription level:</p>
          <div style={{ background: '#f0f6ff', border: '1px solid #b3d4ff', borderRadius: '6px', padding: '12px 14px', margin: '8px 0 12px', fontSize: '12.5px' }}>
            <strong>Deploy prerequisites to enable Guest Configuration policies on virtual machines</strong><br />
            <code style={{ fontSize: '11px' }}>12794019-7a00-42cf-95c2-882eed337cc8</code>
          </div>
          <p style={{ ...p, fontSize: '12px', color: '#666' }}>This single initiative handles everything — MC extension (Windows &amp; Linux) and system-assigned managed identity. The GC agent starts evaluating within 15 minutes.</p>

          {/* Terminology Glossary */}
          <h2 style={h2}>Terminology Glossary</h2>
          <p style={p}>If you come from Group Policy (Windows) or Ansible (Linux), here's how DSC concepts map:</p>
          <table style={{ width: '100%', fontSize: '12.5px', borderCollapse: 'collapse', margin: '8px 0 16px' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e0e0e0', background: '#f9f9f9' }}>
                <th style={{ padding: '6px 8px' }}>DSC / Azure Term</th>
                <th style={{ padding: '6px 8px' }}>Windows Equiv.</th>
                <th style={{ padding: '6px 8px' }}>Linux Equiv.</th>
                <th style={{ padding: '6px 8px' }}>Plain English</th>
              </tr>
            </thead>
            <tbody>
              {([
                ['Resource', 'GPO setting', 'Ansible task/module', 'A single thing to check or configure'],
                ['MOF', '—', '—', 'Compiled config file the agent reads'],
                ['Ensure: Present', 'Feature installed', 'Package installed', 'Make sure it exists'],
                ['Ensure: Absent', 'Feature removed', 'Package removed', 'Make sure it doesn\'t exist'],
                ['nxFile', '—', '/etc/… config files', 'Manage file content, perms, ownership'],
                ['nxService', 'Windows Service', 'systemd unit', 'Control a background service'],
                ['nxPackage', 'MSI / Cab', 'apt / yum / dnf', 'Install or remove software'],
                ['Registry', 'regedit keys', 'sysctl / config files', 'System configuration values'],
                ['Audit', 'Report only', '--check in Ansible', 'Check without changing anything'],
                ['AuditAndSet', 'Auto-remediate', 'Ansible enforce', 'Fix drift automatically'],
              ] as const).map(([term, win, linux, plain], i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '5px 8px', fontWeight: 600 }}>{term}</td>
                  <td style={{ padding: '5px 8px' }}>{win}</td>
                  <td style={{ padding: '5px 8px' }}>{linux}</td>
                  <td style={{ padding: '5px 8px', color: '#555' }}>{plain}</td>
                </tr>
              ))}
            </tbody>
          </table>

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
             'PSDscResources (built-in Windows), SecurityPolicyDsc, AuditPolicyDsc, NetworkingDsc, ComputerManagementDsc, and nxtools (Linux). 23 active resources across 6 modules. 4 additional PSDscResources types (Archive, MsiPackage, WindowsOptionalFeature, WindowsPackageCab) are blocked because they require system access the GC agent sandbox cannot provide.'],
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
