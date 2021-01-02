import { join, resolve } from 'path';
import { pathExists } from 'fs-extra';
import { extendsDirective, overrideDirective } from './extensions';
import { ParsingExtension } from './parsed-value';
import { FlexibleFileSource, FileSource, FallbackSource, FileType } from './config-source';
import { EncryptedSymmetricKey } from './encryption';
import { JsonObject } from './common';
import { NotFoundError, AppConfigError } from './errors';
import { GenerateFile } from './generate';
import { logger } from './logging';

export interface Options {
  directory?: string;
  fileNameBase?: string;
  lookForWorkspace?: string | false;
}

export interface TeamMember {
  userId: string;
  keyName?: string | null;
  publicKey: string;
}

export interface ParsingExtensionWithOptions {
  name: string;
  options?: JsonObject;
}

export interface MetaProperties {
  teamMembers?: TeamMember[];
  encryptionKeys?: EncryptedSymmetricKey[];
  generate?: GenerateFile[];
  parsingExtensions?: (ParsingExtensionWithOptions | string)[];
}

export interface MetaConfiguration {
  filePath?: string;
  fileType?: FileType;
  value: MetaProperties;
}

export async function loadMetaConfig({
  directory = '.',
  fileNameBase = '.app-config.meta',
  lookForWorkspace = '.git',
}: Options = {}): Promise<MetaConfiguration> {
  let workspaceRoot: string | undefined = resolve(directory);

  // look upwards until a .git (workspace root) folder is found
  while (lookForWorkspace) {
    const parentDir = resolve(join(workspaceRoot, '..'));

    // we didn't find a .git root
    if (parentDir === workspaceRoot) {
      workspaceRoot = undefined;
      break;
    }

    workspaceRoot = parentDir;

    if (await pathExists(join(workspaceRoot, lookForWorkspace))) {
      break;
    }
  }

  // we try to find meta find in our CWD, but fallback to the workspace (git repo) root
  const sources = [new FlexibleFileSource(join(directory, fileNameBase))];

  if (workspaceRoot) {
    sources.push(new FlexibleFileSource(join(workspaceRoot, fileNameBase)));
  }

  const source = new FallbackSource(sources);

  try {
    const parsed = await source.read([extendsDirective(), overrideDirective()]);
    const value = parsed.toJSON() as MetaProperties;

    const fileSources = parsed.sources.filter((s) => s instanceof FileSource) as FileSource[];
    const [{ filePath, fileType }] = fileSources.filter((s) => s.filePath.includes(fileNameBase));

    logger.verbose(`Meta file was loaded from ${filePath}`);

    return {
      filePath,
      fileType,
      value,
    };
  } catch (error) {
    if (error instanceof NotFoundError) {
      logger.verbose(
        `Meta file was not found in ${directory} or workspace root (${workspaceRoot ?? 'none'})`,
      );

      return { value: {} };
    }

    throw error;
  }
}

let metaConfig: Promise<MetaConfiguration> | undefined;

export async function loadMetaConfigLazy(options?: Options): Promise<MetaConfiguration> {
  if (!metaConfig) {
    metaConfig = loadMetaConfig(options);
  }

  return metaConfig;
}

export async function loadExtraParsingExtensions(options?: Options): Promise<ParsingExtension[]> {
  return loadMetaConfig(options).then(({ value }) => {
    if (value.parsingExtensions) {
      return Promise.all(
        value.parsingExtensions.map(async (extensionConfig) => {
          if (typeof extensionConfig === 'string') {
            extensionConfig = { name: extensionConfig };
          }

          logger.verbose(`Loading parsing extension: ${extensionConfig.name}`);

          type CreateExtension = (options?: JsonObject) => ParsingExtension;

          type LoadedExtensionModule = CreateExtension | {
            default: (options?: JsonObject) => ParsingExtension;
          };

          const loaded = (await import(extensionConfig.name)) as LoadedExtensionModule;

          if (typeof loaded === 'function') {
            return loaded(extensionConfig.options);
          } else if ('default' in loaded) {
            return loaded.default(extensionConfig.options);
          } else {
            throw new AppConfigError(`Loaded parsing config module was invalid: ${extensionConfig.name}`);
          }
        }),
      );
    }

    return Promise.resolve([]);
  });
}
