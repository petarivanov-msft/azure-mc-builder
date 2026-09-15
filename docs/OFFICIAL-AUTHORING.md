# Official authoring preview

The website remains static. It exports an authoring project; no PowerShell, resource code or Azure operation
runs in the browser. Legacy export remains available and is the default until live qualification is accepted.

## Pipeline and output

`ConfigurationState -> Configuration.ps1 -> official DSC compiler -> New-GuestConfigurationPackage ->
explicit Get/Test/Set verification -> upload exact ZIP -> New-GuestConfigurationPolicy -> New-AzPolicyDefinition`

The source project includes `config.json`, `Configuration.ps1`, `toolchain.lock.json`, a copy of the shared
`scripts/McBuilder.psm1` runtime, and thin `package.ps1`, `test.ps1`, `deploy.ps1` wrappers.
Compiler output, real package metadata, validation receipts and official policies are created after download.
There is no custom-MOF fallback or ZIP-layout repair in this workflow.

### Pinned upstream compatibility guard

Real native tests exposed a GuestConfiguration 4.12.0 defect: with `IncludeVMSS = $false`, its private
`New-GuestConfigurationPolicySetActionSection` still assigns metadata to `resources[2]`, although the
non-VMSS template has only two resources. Installed 4.5.0, 4.7.0 and 4.11.0 contain the same line.
The runtime applies one declared guard (`if ($IncludeVMSS)`) to that line **only in the isolated cache**.
Both original and patched SHA256 digests are pinned in the toolchain lock; an unexpected module fails closed.
No generated policy JSON is rewritten, and no global module installation is changed. Re-qualify and remove
this guard when a corrected official module is selected.

Evaluation also explicitly rejects `DscConfigurationExecutionFailed` and requires the expected resource IDs.
The worker can return a noncompliant-shaped report after a catastrophic error; that is not valid drift.

Versions are pinned in `scripts/toolchain.lock.json`. Resource versions must match the catalog or export fails.
Run `package.ps1 -RestoreTools` to explicitly restore from PSGallery into `.modules`. `MC_MODULE_CACHE` can
select a reusable cache. Module installations outside that cache are not upgraded.
GuestConfiguration has a shared worker directory: a file lock serializes operations using the same cache.

Only matching-OS compilation/evaluation is promised: Windows and Ubuntu, not macOS. The native CI jobs
qualify every catalog resource and template, rather than testing a hand-authored MOF as a proxy for compilation.

## Verification and safety

`package.ps1` compiles/packages but does not run the configuration. `test.ps1 -AcknowledgeExecution` explicitly
runs package Get/Test code. Even an audit package can contain arbitrary Script resource code; review it first.
Use a trusted matching-OS test host. Test results distinguish expected noncompliance from malformed or failed
resource evaluation, and require a result for every expected resource.
Linux evaluation requires root; the runtime does not silently elevate. The disposable Linux CI job explicitly
uses sudo. Windows resource localization can fail on some non-en-US authoring hosts; treat this as an
evaluation failure and use a qualified disposable host rather than accepting a noncompliant-shaped error.

AuditAndSet publication additionally requires `test.ps1 -AcknowledgeExecution -Remediate -DisposableEnvironment`.
That operation changes the current host and must only run in a disposable lab. It performs two remediation
iterations, each followed by a compliance check. CI also deletes its harmless marker and verifies drift correction.
Do not remediate broad hardening templates in CI or on a developer workstation.

Build records contain SHA256 fingerprints of project metadata, compiler source, lock, compiler wrapper and runtime.
Validation is bound to the exact ZIP, platform and GuestConfiguration version. Changing any build input or package
bytes invalidates publication. These files prevent accidental stale deployment; they are not signed attestations.

No test is counted as native verification when its native-test flag is unset. Normal `npm test` runs mocked
runtime contracts; the **Official Authoring** CI jobs separately enable real compiler/package/evaluation tests.

## Policy and deployment

Official `deploy.ps1` requires TenantId, SubscriptionId and StorageAccountName. It refuses a mismatching Azure
context. The caller must provision storage and roles; the runtime never silently creates an account or grants roles.
It uses Entra ID storage access, an HTTPS-only read SAS valid at most six days, and no Shared Key fallback.

The policy generator receives a persistent GUID, platform, mode, release version and `IncludeVMSS = $false`.
It uses the cmdlet's returned file path and verifies its content hash against the validated package before upsert.
SAS mode does not pass LocalContentPath; a separate programmatic `New-McPolicy -UseSystemAssignedIdentity`
option is available for policy-generation tests/advanced use, but target identity permissions are not provisioned.

An assignment for Arc targets must explicitly include `IncludeArcMachines = 'true'` (and accept applicable charges).
The generated instructions set `EnableAutoRemediation = 'false'` for AuditAndSet: service-side auto-remediation is
a separate opt-in; the initial remediation task remains explicit. Scope assignments to a test resource group first.
Windows/Linux VMs require the Guest Configuration extension and a managed identity.

## Identity, migration and rollback

Project schema version 2 keeps a policy GUID and ARM definition name separately. Old JSON imports get a GUID
once and retain `MC-<ConfigName>` as the definition name. Existing projects retain identity across refresh,
workflow changes and exports. New configurations and templates create a fresh identity.

The native compiler exposed an invalid ScheduledTask property in the legacy catalog:
`DisallowStartIfOnBatteries` migrates to the inverse `AllowStartIfOnBatteries`, preserving intent.
Plain-text ExecuteAsCredential is rejected in official mode because the resource requires a credential object.

Each package release uses an identifier-safe `<ConfigName>_v<Major>_<Minor>_<Patch>` name. Updating a
definition to a new release name requires explicit `-AllowReleaseUpgrade`: review old guest assignments first
so multiple corrective configurations cannot compete on a target. The runtime does not delete definitions,
assignments or old packages. Retain package bytes and policy snapshots for a reviewed rollback.

SAS renewal republishes the same validated bytes; do not rebuild simply to renew access. A failed policy
operation may leave an uploaded blob, which is safe to inspect and clean up explicitly.
Generated policy JSON contains a read credential; downloaded `.gitignore` excludes `.modules` and `output`.

## References

- [Authoring environment](https://learn.microsoft.com/azure/governance/machine-configuration/how-to/develop-custom-package/1-set-up-authoring-environment)
- [Create package](https://learn.microsoft.com/azure/governance/machine-configuration/how-to/develop-custom-package/2-create-package)
- [Test package](https://learn.microsoft.com/azure/governance/machine-configuration/how-to/develop-custom-package/3-test-package)
- [Create policy](https://learn.microsoft.com/azure/governance/machine-configuration/how-to/create-policy-definition)
