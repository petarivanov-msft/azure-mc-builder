import JSZip from 'jszip';
import { ConfigurationState } from '../types';
import { generateMofFile, generateMofContent } from './mofGenerator';
import { generateMetaconfigString, getMetaconfigFilename } from './metaconfigGenerator';
import { generatePs1 } from './ps1Generator';
import { generatePolicyJsonString } from './policyGenerator';
import { generatePackageScript } from './packageScriptGenerator';
import { generateDeployScript } from './deployScriptGenerator';
import { generateReadme } from './readmeGenerator';

/** Generate a ZIP bundle with all artifacts at the root level */
export async function generateBundle(config: ConfigurationState): Promise<Blob> {
  const zip = new JSZip();

  // MOF file (with BOM)
  const mofBytes = generateMofFile(config);
  zip.file(`${config.configName}.mof`, mofBytes);

  // metaconfig.json
  zip.file(getMetaconfigFilename(config.configName), generateMetaconfigString(config));

  // PowerShell DSC script
  zip.file(`${config.configName}.ps1`, generatePs1(config));

  // Azure Policy JSON
  zip.file('policy.json', generatePolicyJsonString(config));

  // Package helper script
  zip.file('package.ps1', generatePackageScript(config));

  // Deploy script (upload to storage + create policy definition)
  zip.file('deploy.ps1', generateDeployScript(config));

  // README
  zip.file('README.md', generateReadme(config));

  return zip.generateAsync({ type: 'blob' });
}

/** Compute SHA256 hash of a blob (for contentHash) */
export async function computeContentHash(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** Get all generated outputs as an object (for preview tabs) */
export function getGeneratedOutputs(config: ConfigurationState) {
  return {
    mof: generateMofContent(config),
    metaconfig: generateMetaconfigString(config),
    ps1: generatePs1(config),
    policyJson: generatePolicyJsonString(config),
    packageScript: generatePackageScript(config),
    readme: generateReadme(config),
  };
}
