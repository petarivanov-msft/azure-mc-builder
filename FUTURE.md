# Future Roadmap

Ideas and features for future development, collected from UX testing feedback (March 2026).

## CLI Mode
`mc-builder export --config config.json --output ./dist` for CI/CD pipeline integration.
Allow headless generation of MOF/PS1/ZIP from a JSON configuration file, enabling automation-first workflows without requiring the GUI.

## Git Integration
Push configurations directly to a repository. Version-control templates. Enable GitOps workflows where configs are reviewed via PRs before deployment.

## Custom Resource Import
Bring your own DSC resource modules — upload or reference a PowerShell module and the builder auto-discovers its resources and properties.

## Environment Validation
Test configurations against actual Azure environments before deploying. Compare expected state with current VM state to preview what would change.

## Collaboration
Shared configurations with team review. Role-based access, comments, approval workflows for enterprise teams.

## Policy Assignment Preview
Visualize the impact of a configuration across Azure subscriptions — show which VMs would be affected, current compliance gaps, and estimated remediation scope.
