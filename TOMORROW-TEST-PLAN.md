# Azure MC Builder — Customer Test Plan (2026-04-01)

## Goal
Test the full E2E flow as a customer would: open the website, create configs, download bundles, deploy to Azure, verify compliance.

## Pre-requisites
- [ ] Push codebase fixes and rebuild GitHub Pages (Clawy will handle tonight/morning)
- [ ] AMC-E2E-Testing RG exists and is empty (done)
- [ ] SP credentials still active

## Phase 1: Website / UI Testing (no Azure needed)

### 1.1 — Pick a Windows template
1. Open https://petarivanov-msft.github.io/azure-mc-builder/
2. Pick "Windows Security Baseline" template
3. Review the pre-filled resources — do they make sense?
4. Modify one value (e.g. change `Maximum_Password_Age` to 60)
5. Click "Generate Bundle" / Download ZIP
6. Open the ZIP and verify:
   - [ ] `.mof` file has correct property values
   - [ ] `.metaconfig.json` has `"Type": "Audit"`
   - [ ] `package.ps1` exists and references the correct module
   - [ ] `deploy.ps1` exists
   - [ ] `README.md` is useful

### 1.2 — Pick a Linux template
1. Pick "Linux SSH Hardening" template
2. Review pre-filled resources
3. Download ZIP and verify same checklist as above
4. Check `.mof` uses `nxFileLine` (not `nxFileContentReplace`)

### 1.3 — Build a custom config from scratch
1. Click "New Configuration"
2. Name it "MyTestConfig"
3. Add 3 resources manually:
   - Registry resource (any key/value)
   - User resource (Guest account check)
   - Environment resource
4. Download and verify MOF has all 3 resources

### 1.4 — Try to add a blocked resource
1. Try to add a WindowsFeature resource (if available in UI)
2. **Expected**: error/warning that it's not supported in GC agent
3. Try to add a Group resource
4. **Expected**: warning about PSDscResources bug (single-member crash)

## Phase 2: Azure Deployment (needs Azure)

### 2.1 — Create test VMs
```bash
# Create fresh VMs in AMC-E2E-Testing (uksouth)
# Windows Server 2022 + Ubuntu 24.04
# Enable SystemAssigned identity on both
# Install GC extension on both
```

### 2.2 — Deploy a Windows package
1. Take the ZIP from 1.1
2. Run `package.ps1` on a machine with PowerShell + PSDscResources installed
   - This creates the final GC package with bundled modules
3. Run `deploy.ps1` — uploads to blob storage + creates policy definition
4. Create a GC assignment (manually or via policy)
5. Wait 15 min for evaluation
6. **Verify**: compliance report shows real per-resource details (not DSC errors)

### 2.3 — Deploy a Linux package
1. Same flow with Linux ZIP from 1.2
2. `package.ps1` needs `nxtools` module installed
3. Deploy and verify

### 2.4 — Deploy 3+ configs simultaneously
1. Deploy at least 3 different configs to the same VM
2. Verify all evaluate independently without conflicts
3. Check timing — do they all report within 30 min?

## Phase 3: Edge Cases

### 3.1 — SecurityOption resource (case sensitivity)
1. Create a config with SecurityOption resource
2. Verify the MOF property names match the schema exactly
3. Deploy and confirm it evaluates (not crashes)

### 3.2 — Empty/default values
1. Create a config where some optional properties are left blank
2. Verify MOF doesn't include empty string properties
3. Deploy and verify

### 3.3 — AuditAndSet mode
1. Create a config with mode = AuditAndSet
2. Verify metaconfig has `"Type": "AuditAndSet"`
3. Deploy and verify the assignment type matches

## Codebase Issues to Fix Before Testing

### Must Fix
- [ ] **Group resource warning** — add `MSFT_GroupResource` to blocked/warned list with explanation of single-member bug
- [ ] **Tests**: update 30 failing tests for new validation logic + typeHandlerVersion change
- [ ] **Push unpushed commits** (2 commits: deploy.ps1 fixes)
- [ ] **Commit mofGenerator.ts** validation changes
- [ ] **Rebuild & deploy** GitHub Pages

### Nice to Have
- [ ] Clean up debug scripts (fix-all-broken.ts, etc.) — don't commit these
- [ ] Add SecurityOption case-sensitivity note to docs/FAQ
- [ ] Document the PSDscResources Group bug in README or FAQ

## Success Criteria
- All Phase 1 checks pass in the browser
- At least 1 Windows + 1 Linux config deployed and showing real compliance
- No DSC execution failures
- Blocked resources properly prevented
- deploy.ps1 works end-to-end (upload + policy definition)
