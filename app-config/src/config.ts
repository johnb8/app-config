import { join } from 'path';
import { Json, isObject } from './common';
import { ParsedValue } from './parsed-value';
import { defaultAliases, EnvironmentAliases } from './environment';
import { FlexibleFileSource, FileSource, EnvironmentSource } from './config-source';
import { defaultExtensions, ParsingExtension } from './extensions';
import { loadSchema, Options as SchemaOptions } from './schema';
import { NotFoundError, WasNotObject } from './errors';
import { logger } from './logging';

export interface Options {
  directory?: string;
  fileNameBase?: string;
  secretsFileNameBase?: string;
  environmentVariableName?: string;
  environmentOverride?: string;
  environmentAliases?: EnvironmentAliases;
  parsingExtensions?: ParsingExtension[];
  secretsFileExtensions?: ParsingExtension[];
  environmentExtensions?: ParsingExtension[];
}

export interface Configuration {
  /** full configuration plain JSON, with secrets and nonSecrets */
  fullConfig: Json;
  /** parsed configuration value, with metadata (like ConfigSource) still attached */
  parsed: ParsedValue;
  parsedSecrets?: ParsedValue;
  parsedNonSecrets?: ParsedValue;
  /** non-exhaustive list of files that were read (useful for reloading in plugins) */
  filePaths?: string[];
}

export async function loadConfig({
  directory = '.',
  fileNameBase = '.app-config',
  secretsFileNameBase = `${fileNameBase}.secrets`,
  environmentVariableName = 'APP_CONFIG',
  environmentOverride,
  environmentAliases = defaultAliases,
  parsingExtensions = defaultExtensions,
  secretsFileExtensions = parsingExtensions.concat(markAllValuesAsSecret),
  environmentExtensions = [],
}: Options = {}): Promise<Configuration> {
  // before trying to read .app-config files, we check for the APP_CONFIG environment variable
  const env = new EnvironmentSource(environmentVariableName);
  logger.verbose(`Trying to read ${environmentVariableName} for configuration`);

  try {
    const parsed = await env.read(environmentExtensions);
    return { parsed, fullConfig: parsed.toJSON() };
  } catch (error) {
    // having no APP_CONFIG environment variable is normal, and should fall through to reading files
    if (!(error instanceof NotFoundError)) throw error;
  }

  logger.verbose(`Trying to read files for configuration`);

  const [nonSecrets, secrets] = await Promise.all([
    new FlexibleFileSource(
      join(directory, fileNameBase),
      environmentOverride,
      environmentAliases,
    ).read(parsingExtensions),

    new FlexibleFileSource(
      join(directory, secretsFileNameBase),
      environmentOverride,
      environmentAliases,
    )
      .read(secretsFileExtensions)
      .catch((error) => {
        // NOTE: secrets are optional, so not finding them is normal
        if (error instanceof NotFoundError) {
          logger.verbose('Did not find secrets file');
          return undefined;
        }

        throw error;
      }),
  ]);

  const parsed = secrets ? ParsedValue.merge(nonSecrets, secrets) : nonSecrets;
  const filePaths = [];

  if (nonSecrets.source instanceof FileSource) {
    filePaths.push(nonSecrets.source.filePath);
  }

  if (secrets && secrets.source instanceof FileSource) {
    filePaths.push(secrets.source.filePath);
  }

  return {
    parsed,
    parsedSecrets: secrets,
    parsedNonSecrets: nonSecrets,
    fullConfig: parsed.toJSON(),
    filePaths,
  };
}

export async function loadValidatedConfig(
  options?: Options,
  schemaOptions?: SchemaOptions,
): Promise<Configuration> {
  const [{ validate }, { fullConfig, parsed, ...rest }] = await Promise.all([
    loadSchema({
      directory: options?.directory,
      environmentOverride: options?.environmentOverride,
      environmentAliases: options?.environmentAliases,
      ...schemaOptions,
    }),
    loadConfig(options),
  ]);

  if (!isObject(fullConfig)) {
    throw new WasNotObject('Configuration was not an object');
  }

  logger.verbose('Config was loaded, validating now');
  validate(fullConfig, parsed);

  return { fullConfig, parsed, ...rest };
}

const markAllValuesAsSecret: ParsingExtension = (_, value) => () => [
  value,
  { metadata: { fromSecrets: true } },
];