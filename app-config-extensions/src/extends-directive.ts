import type { ParsingExtension } from '@app-config/core';
import {
  named,
  forKey,
  validateOptions,
  validationFunction,
  ValidationFunction,
} from '@app-config/extension-utils';
import {
  ParsedValue,
  ParsedValueMetadata,
  AppConfigError,
  NotFoundError,
  FailedToSelectSubObject,
} from '@app-config/core';
import { resolveFilepath, FileSource } from '@app-config/node';
import { logger } from '@app-config/logging';

// common logic for $extends and $override
function fileReferenceDirective(keyName: string, meta: ParsedValueMetadata): ParsingExtension {
  return forKey(
    keyName,
    validateOptions(
      (SchemaBuilder) => {
        const reference = SchemaBuilder.oneOf(
          SchemaBuilder.stringSchema(),
          SchemaBuilder.emptySchema()
            .addString('path')
            .addBoolean('optional', {}, false)
            .addString('select', {}, false),
        );

        return SchemaBuilder.oneOf(reference, SchemaBuilder.arraySchema(reference));
      },
      (value) => async (_, __, source, extensions) => {
        const retrieveFile = async (filepath: string, subselector?: string, isOptional = false) => {
          const resolvedPath = resolveFilepath(source, filepath);

          logger.verbose(`Loading file for ${keyName}: ${resolvedPath}`);

          const resolvedSource = new FileSource(resolvedPath);

          const parsed = await resolvedSource.read(extensions).catch((error) => {
            if (error instanceof NotFoundError && isOptional) {
              return ParsedValue.literal({});
            }

            throw error;
          });

          if (subselector) {
            const found = parsed.property(subselector.split('.'));

            if (!found) {
              throw new FailedToSelectSubObject(
                `Failed to select ${subselector} in ${resolvedPath}`,
              );
            }

            return found;
          }

          return parsed;
        };

        let parsed: ParsedValue;

        if (typeof value === 'string') {
          parsed = await retrieveFile(value);
        } else if (Array.isArray(value)) {
          parsed = ParsedValue.literal({});

          for (const ext of value) {
            if (typeof ext === 'string') {
              parsed = ParsedValue.merge(parsed, await retrieveFile(ext));
            } else {
              const { path, optional, select } = ext;

              parsed = ParsedValue.merge(parsed, await retrieveFile(path, select, optional));
            }
          }
        } else {
          const { path, optional, select } = value;

          parsed = await retrieveFile(path, select, optional);
        }

        return parsed.assignMeta(meta);
      },
    ),
  );
}

/** Uses another file as overriding values, layering them on top of current file */
export function overrideDirective(): ParsingExtension {
  return named('$override', fileReferenceDirective('$override', { shouldOverride: true }));
}

/** Uses another file as a "base", and extends on top of it */
export function extendsDirective(): ParsingExtension {
  return named('$extends', fileReferenceDirective('$extends', { shouldMerge: true }));
}

/** Lookup a property in the same file, and "copy" it */
export function extendsSelfDirective(): ParsingExtension {
  const validate: ValidationFunction<string> = validationFunction(({ stringSchema }) =>
    stringSchema(),
  );

  return named(
    '$extendsSelf',
    forKey('$extendsSelf', (input, key, ctx) => async (parse, _, __, ___, root) => {
      const value = (await parse(input)).toJSON();
      validate(value, [...ctx, key]);

      // we temporarily use a ParsedValue literal so that we get the same property lookup semantics
      const selected = ParsedValue.literal(root).property(value.split('.'));

      if (selected === undefined) {
        throw new AppConfigError(`$extendsSelf selector was not found (${value})`);
      }

      if (selected.asObject() !== undefined) {
        return parse(selected.toJSON(), { shouldMerge: true });
      }

      return parse(selected.toJSON(), { shouldFlatten: true });
    }),
  );
}
