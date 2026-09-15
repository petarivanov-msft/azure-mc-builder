# Contributing to Azure Machine Configuration Builder

Thanks for your interest in contributing! This is a personal open-source project, and contributions are welcome.

## Quick Start

```bash
git clone https://github.com/petarivanov-msft/azure-mc-builder.git
cd azure-mc-builder
npm install
npm run dev      # → http://localhost:5173
npm test         # Vitest unit tests
npm run lint     # ESLint
npm run build    # Production build
```

PowerShell 7.2+ (`pwsh`) is required for `npm test`. Runtime contract tests use isolated mocks and never contact
Azure or install modules. Native Windows/Ubuntu CI separately exercises real compilation and controlled packages.

## Architecture Overview

Official authoring has separate native tests. On a disposable Windows/Ubuntu worker:

```powershell
./scripts/restore.ps1 -CachePath ./modules.local
$env:MC_NATIVE_TESTS = '1'
$env:MC_NATIVE_RUNTIME = '1'
$env:MC_NATIVE_REMEDIATE = '1' # Only on a disposable host: modifies a dedicated marker
npx vitest run src/generators/__tests__/nativeCompiler.test.ts src/generators/__tests__/nativeRuntime.test.ts --no-file-parallelism
```

These tests compile every matching-OS catalog resource/template and use the same runtime shipped in the browser
download. Mock contracts run in the normal suite. See [official authoring](docs/OFFICIAL-AUTHORING.md).

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a deep dive. The short version:

The editor exports a source-project ZIP. The shared PowerShell runtime compiles, packages, tests and publishes it.
Do not add a browser MOF compiler, handwritten policy templates, or a second packaging implementation.

### Key Directories

| Path | What |
|------|------|
| `src/components/` | React UI — `AppLayout.tsx` is the main shell |
| `src/generators/` | DSC source and source-project file/ZIP generation |
| `src/schemas/` | Windows (16) & Linux (8) DSC resource schemas |
| `src/templates/` | 9 pre-built configuration templates |
| `src/store/` | Zustand store with undo/redo, validation, localStorage persistence |
| `src/types/` | TypeScript types (`ConfigurationState`, `ResourceInstance`, etc.) |
| `scripts/` | Shared official compiler/package/test/publish runtime and toolchain lock |
| `e2e/` | Executable PowerShell runtime contract tests |
| `docs/` | Architecture, templates, permissions, FAQ |

### How Generators Work

1. **ps1Generator** emits DSC source with safe literals and pinned imports.
2. **officialProjectGenerator** validates the project, includes the shared scripts and creates its README.
3. **bundleGenerator** exposes the single source-project ZIP export.
4. **scripts/McBuilder.psm1** delegates final artifact generation to Microsoft's tools after download.

### Generator Testing

Tests cover all schemas in both modes, template round-trips, safe source formatting, validation, persistence and
runtime contracts. Native compiler/runtime tests in the same test directory are enabled explicitly on disposable
Windows/Ubuntu CI runners. They validate actual Set reports as well as subsequent Get results and reject partial failures.

## Adding a New Resource Schema

1. Create `src/schemas/windows/myResource.ts` or `src/schemas/linux/myResource.ts`
2. Follow the `ResourceSchema` interface:
   ```typescript
   export const myResource: ResourceSchema = {
     resourceName: 'MyResource',       // DSC resource name
     description: 'What it checks',
     platform: 'Windows',              // or 'Linux'
     moduleName: 'PSDscResources',     // DSC module that contains it
     moduleVersion: '2.12.0.0',
     mofClassName: 'MSFT_MyResource',  // MOF class (or just 'myResource' for Linux nx*)
     dscV3TypeName: 'MyModule/MyResource',
     category: 'System',
     properties: [
       { name: 'Name', type: 'string', required: true, isKey: true, description: '...' },
       // ...
     ],
   };
   ```
3. Export from `src/schemas/index.ts`
4. Update the verified native class allowlist and `scripts/toolchain.lock.json` when adding a module/version.
5. Run regular and native tests. Do not infer execution support from successful source generation alone.

## Adding a New Template

1. Create `src/templates/myTemplate.ts`
2. Export a `TemplateInfo` object:
   ```typescript
   export const myTemplate: TemplateInfo = {
     name: 'My Template',
     description: 'What this template configures',
     platform: 'Windows',
     resourceCount: 3,
     config: { /* full ConfigurationState */ },
   };
   ```
3. Add to the `templates` array in `src/templates/index.ts`
4. Add to `docs/TEMPLATES.md`

## Pull Request Checklist

- [ ] All tests pass: `npm test`
- [ ] Lint passes: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] New schemas have test coverage (automatic via `allResources.test.ts`)
- [ ] New templates are documented in `docs/TEMPLATES.md`
- [ ] PR description explains what changed and why

CI will automatically run unit tests, lint, build, and E2E validation on both Linux and Windows. A summary comment will be posted on your PR.

## Code Style

- TypeScript strict mode
- No `any` in production code (tests may use it for deeply nested JSON assertions)
- Prefer `const` over `let`
- Generator functions are pure — they take `ConfigurationState` and return strings/buffers

## Reporting Issues

- Use GitHub Issues for bugs and feature requests
- For bugs: include browser, OS, and steps to reproduce
- For schema requests: include the DSC resource name, module, and a sample MOF snippet if possible

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

## Disclaimer

This is a personal project and is not affiliated with or endorsed by Microsoft.
