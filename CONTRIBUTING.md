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

## Architecture Overview

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a deep dive. The short version:

```
UI (React + FluentUI + Zustand)
  → configStore (state)
  → generators/ (MOF, PS1, Policy JSON, Metaconfig, Bundle)
  → downloadable ZIP
```

### Key Directories

| Path | What |
|------|------|
| `src/components/` | React UI — `AppLayout.tsx` is the main shell |
| `src/generators/` | All code generation: MOF, PS1, policy, metaconfig, bundle, readme |
| `src/schemas/` | Windows (17) & Linux (12) DSC resource schemas |
| `src/templates/` | 9 pre-built configuration templates |
| `src/store/` | Zustand store with undo/redo, validation, localStorage persistence |
| `src/types/` | TypeScript types (`ConfigurationState`, `ResourceInstance`, etc.) |
| `e2e/` | E2E tests — generates configs, builds packages with `pwsh`, validates with DSC engine |
| `docs/` | Architecture, templates, permissions, FAQ |

### How Generators Work

1. **mofGenerator** — converts `ConfigurationState` → MOF document (UTF-8 with BOM)
2. **ps1Generator** — generates the DSC configuration script (`.ps1`)
3. **packageScriptGenerator** — generates `package.ps1` (installs modules, compiles, packages)
4. **policyGenerator** — generates Azure Policy definition JSON (Audit or DINE with Arc support)
5. **metaconfigGenerator** — generates the metaconfig JSON for the GC agent
6. **readmeGenerator** — generates a human-readable deployment guide
7. **bundleGenerator** — zips everything into a downloadable package

### Generator Testing

Every generator has unit tests in `src/generators/__tests__/`. The `allResources.test.ts` file ensures every schema produces valid output through every generator.

E2E tests (`e2e/`) actually compile packages with PowerShell and validate them with the real DSC engine on both Linux and Windows CI runners.

## Adding a New Resource Schema

1. Create `src/schemas/windows/myResource.ts` or `src/schemas/linux/myResource.ts`
2. Follow the `ResourceSchema` interface:
   ```typescript
   export const myResource: ResourceSchema = {
     resourceName: 'MyResource',       // DSC resource name
     friendlyName: 'My Resource',      // UI display name
     description: 'What it checks',
     platform: 'Windows',              // or 'Linux'
     moduleName: 'PSDscResources',     // DSC module that contains it
     moduleVersion: '2.12.0.0',
     mofClassName: 'MSFT_MyResource',  // MOF class (or just 'myResource' for Linux nx*)
     properties: [
       { name: 'Name', type: 'string', required: true, description: '...' },
       // ...
     ],
   };
   ```
3. Export from `src/schemas/index.ts`
4. Run `npm test` — `allResources.test.ts` will automatically validate your schema through all generators

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
