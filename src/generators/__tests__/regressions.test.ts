import { describe, expect, it } from 'vitest';
import { generatePs1 } from '../ps1Generator';
import { getOfficialProjectFiles } from '../officialProjectGenerator';
import { schemaConfig } from './fixtures';

describe('source boundaries, defaults and escaping', () => {
  const generators = [generatePs1, getOfficialProjectFiles];
  it.each(['bad"name', 'bad\nname', '../escape', "bad'name", '123name', ''])('rejects invalid identifier %j', configName => {
    for (const generate of generators) expect(() => generate({ ...schemaConfig('Service'), configName })).toThrow('valid identifier');
  });
  it.each(['bad', "1.0.0';bad", '', '1.0'])('rejects invalid version %j', version => {
    for (const generate of generators) expect(() => generate({ ...schemaConfig('Service'), version })).toThrow('Version');
  });
  it('rejects invalid instance names and unknown resource types', () => {
    const config = schemaConfig('Service');
    config.resources[0].instanceName = 'bad";';
    for (const generate of generators) expect(() => generate(config)).toThrow('Invalid instance name');
    config.resources[0].instanceName = 'Valid';
    config.resources[0].schemaName = 'Group';
    for (const generate of generators) expect(() => generate(config)).toThrow('Unknown schema');
  });
  it.each(['TimeZone', 'PowerPlan'])('materializes %s defaults without mutating the input', name => {
    const config = schemaConfig(name);
    delete config.resources[0].properties.IsSingleInstance;
    expect(generatePs1(config)).toContain("IsSingleInstance = 'Yes'");
    expect(getOfficialProjectFiles(config)['Configuration.ps1']).toContain("IsSingleInstance = 'Yes'");
    expect(config.resources[0].properties).not.toHaveProperty('IsSingleInstance');
  });
  it.each([null, ''])('does not hide an invalid required value %j with a default', value => {
    const config = schemaConfig('TimeZone');
    config.resources[0].properties.IsSingleInstance = value;
    for (const generate of generators) expect(() => generate(config)).toThrow('Required property');
  });
  it('preserves empty Registry default-value names', () => {
    const config = schemaConfig('Registry');
    config.resources[0].properties.ValueName = '';
    expect(generatePs1(config)).toContain("ValueName = ''");
  });
  it('preserves underscore identifiers and skips unset optional source properties', () => {
    const config = schemaConfig('Registry');
    config.configName = 'My_Config_Name';
    config.resources[0].properties.ValueData = [];
    const source = generatePs1(config);
    expect(source).toContain('Configuration My_Config_Name');
    expect(source).not.toContain('ValueData =');
  });
  it('escapes single quotes but preserves paths, dollar signs, double quotes, Unicode and multiline text', () => {
    const config = schemaConfig('Registry');
    config.resources[0].properties.ValueData = ['C:\\Program Files\\test', 'résumé "café"', "O'Brien", '$env:PATH', 'first\nsecond'];
    const source = generatePs1(config);
    expect(source).toContain("'C:\\Program Files\\test'");
    expect(source).toContain("'résumé \"café\"'");
    expect(source).toContain("'O''Brien'");
    expect(source).toContain("'$env:PATH'");
    expect(source).toContain("'first\nsecond'");
  });
  it('strips null bytes from source strings and rejects malformed enum combinations', () => {
    const config = schemaConfig('Service');
    config.resources[0].properties.Name = 'test\0service';
    expect(generatePs1(config)).toContain("'testservice'");
    config.resources[0].properties.State = 'Running,Stopped';
    expect(() => getOfficialProjectFiles(config)).toThrow('Invalid value');
  });
  it.each([NaN, Infinity, 1.5, -1, '3'])('rejects an invalid integer %j at the source-project boundary', value => {
    const config = schemaConfig('ScheduledTask');
    config.resources[0].properties.Priority = value;
    expect(() => getOfficialProjectFiles(config)).toThrow('Invalid integer');
  });
});
