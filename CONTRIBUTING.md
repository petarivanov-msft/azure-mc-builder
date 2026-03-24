# Contributing to Azure Machine Configuration Builder

Thanks for your interest in contributing! This is a personal open-source project, and contributions are welcome.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork locally
3. **Install dependencies**: `npm install`
4. **Run the dev server**: `npm run dev`
5. **Run tests**: `npm test`

## Development

- **Stack**: React 19, TypeScript, Vite, Fluent UI v9
- **State**: Zustand with localStorage persistence
- **Tests**: Vitest (unit) + PowerShell E2E validation scripts

### Project Structure

```
src/
├── components/     # React UI components
├── generators/     # MOF, PS1, policy JSON, bundle generators
├── schemas/        # Windows & Linux DSC resource schemas
├── store/          # Zustand state management
├── templates/      # Predefined configuration templates
└── types/          # TypeScript type definitions
```

## Pull Requests

1. Create a feature branch from `main`
2. Make your changes
3. Ensure all tests pass: `npm test`
4. Ensure linting passes: `npm run lint`
5. Ensure it builds: `npm run build`
6. Submit a PR with a clear description of what changed and why

## Adding a New Resource Schema

1. Create a new file in `src/schemas/windows/` or `src/schemas/linux/`
2. Follow the existing schema pattern (see `src/schemas/windows/registry.ts` as a reference)
3. Export the schema from `src/schemas/index.ts`
4. Add test coverage in `src/generators/__tests__/allResources.test.ts`

## Adding a New Template

1. Create a new file in `src/templates/`
2. Export it from `src/templates/index.ts`
3. Templates should demonstrate realistic configurations

## Reporting Issues

- Use GitHub Issues for bugs and feature requests
- Include steps to reproduce for bugs
- Include the browser and OS you're using

## Code of Conduct

Be respectful and constructive. This is a learning-friendly project.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

## Disclaimer

This is a personal project and is not affiliated with or endorsed by Microsoft. Use at your own risk.
