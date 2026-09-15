# Architecture

## One authoring pipeline

The static React application edits configurations and exports source. It does not implement a MOF compiler
or an Azure Policy template generator.

1. The editor stores `ConfigurationState`, resource properties and persistent project identity.
2. `getOfficialProjectFiles` validates the configuration and builds a source-project file map.
3. `generateBundle` packages that map with JSZip.
4. On the user's authoring host, the shared PowerShell runtime invokes the official compiler and packager.
5. Explicit evaluation produces a package-hash-bound validation receipt.
6. Publishing uploads those exact bytes, invokes the official policy generator and upserts a definition.
7. Policy assignment and remediation are separate, authorized actions.

## Browser surfaces

| Module | Responsibility |
|--------|----------------|
| `schemas` | 24 resource schemas across six modules: UI fields, types, defaults and native class metadata |
| `templates` | Nine editable starting configurations |
| `store/configStore.ts` | Persistence, resource editing, coalesced undo/redo and validation |
| `utils/configuration.ts` | JSON migration, defaults, stable identity and conditional requirements |
| `utils/resourceValidation.ts` | Shared identifiers, required values, enum and unsupported-resource validation |
| `generators/ps1Generator.ts` | DSC source, literal escaping, pinned resource imports and DependsOn |
| `generators/officialProjectGenerator.ts` | Source-project validation, shared runtime assets and tailored README |
| `generators/bundleGenerator.ts` | Public alias for the single source-project ZIP generator |
| `components/OutputPreview.tsx` | Source, project, build/test/publish wrapper and README previews |

Project schema version 2 contains a persistent policy GUID and an explicit ARM definition name. Older JSON
without project metadata is migrated once. Existing `MC-<Name>` definition names are retained where valid.
Retired `workflow` fields are accepted during import and discarded; they cannot select another export path.
New configurations/templates get a fresh identity. Editing, undo/redo and exporting preserve it.

Defaults are applied without mutating caller data. `nxFile` creation in AuditAndSet requires explicit Mode,
Owner and Group because nxtools 1.6.0 invokes those setters when the item is absent. Audit and Ensure=Absent
do not gain ownership defaults or additional creation requirements.

## Shared PowerShell runtime

The files under `scripts` are included verbatim in downloaded projects using Vite raw imports.
The repository `deploy.ps1` is only a wrapper over `scripts/deploy.ps1`; it accepts a source project, not
prebuilt legacy artifacts. There is no second implementation of packaging or deployment.

`McBuilder.psm1` owns:

- Locked, project-local tool restoration and process-wide Az imports.
- Serialized access to GuestConfiguration's shared worker directory.
- Fresh-process DSC compilation before calling `New-GuestConfigurationPackage`.
- Package inspection, SHA256 fingerprints and validation receipts.
- Explicit Get/Test evaluation and disposable-host Set verification.
- Official policy generation and hash comparison before publication.
- Tenant/subscription guards, Entra storage access and in-place definition updates.

The pinned GuestConfiguration 4.12.0 non-VMSS compatibility guard is documented in
[OFFICIAL-AUTHORING.md](OFFICIAL-AUTHORING.md). It patches one upstream resource-index access only when
the original/patched source digests match. No custom policy JSON generation or ZIP-layout rewriting remains.

## Trust and lifecycle boundaries

Building does not configure the host. Evaluation executes resource code and requires acknowledgement.
Remediation changes the host and requires explicit disposable-environment consent. Both Set reports and later
Get results are checked; a partially successful Set cannot earn a successful receipt.

Build records fingerprint project metadata, source, compiler wrapper, lock and runtime. Changing any input or
package bytes requires rebuilding/revalidation. Receipts prevent accidental stale deployment, not deliberate tampering.
The browser never handles Azure credentials. Generated policy output contains SAS credentials and is excluded
by the downloaded `.gitignore`.

Package releases have versioned names and immutable, hash-suffixed blob paths. Policy identity remains stable.
Changing a guest assignment release name requires explicit review and `-AllowReleaseUpgrade`; nothing is
deleted automatically. Scope changes, role grants, assignment creation and cleanup remain separate actions.

## Validation

Regular tests cover the full catalog in both modes, template exports, source formatting, malformed input,
saved-project migration, ownership requirements, identity/history and executable runtime contracts.
Windows and Ubuntu native CI compiles the catalog/templates and tests real controlled packages,
Set/Get, idempotence, drift, partial Set failure rejection, policy generation and publishing imports.
This tests the same runtime distributed to users, not a parallel handwritten-MOF implementation.

Live Azure VM verification additionally exercised actual policy publication, assignment/remediation deployment,
repeat publication with preserved IDs, and Windows/Linux guest compliance. Arc live validation and broad
production rollout remain separate qualification scopes.
