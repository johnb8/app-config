import { named, forKey, validationFunction, ValidationFunction } from '@app-config/extension-utils';
import { ParsingExtension, AppConfigError, InObject } from '@app-config/core';
import { currentEnvironment, defaultAliases, EnvironmentAliases } from '@app-config/node';
import { logger } from '@app-config/logging';

/** Substitues environment variables found in strings (similar to bash variable substitution) */
export function substituteDirective(
  aliases: EnvironmentAliases = defaultAliases,
  environmentOverride?: string,
  environmentSourceNames?: string[] | string,
): ParsingExtension {
  const envType = environmentOverride ?? currentEnvironment(aliases, environmentSourceNames);

  return named(
    '$substitute',
    forKey(['$substitute', '$subs'], (value, key, ctx) => async (parse) => {
      if (typeof value === 'string') {
        return parse(performAllSubstitutions(value, envType), { shouldFlatten: true });
      }

      validateObject(value, [...ctx, key]);
      if (Array.isArray(value)) throw new AppConfigError('$substitute was given an array');

      const name = (await parse(selectDefined(value.name, value.$name))).toJSON();

      validateString(name, [...ctx, key, [InObject, 'name']]);

      const parseValue = async (strValue: string | null) => {
        const parseBool = (await parse(selectDefined(value.parseBool, value.$parseBool))).toJSON();

        if (parseBool) {
          const parsed =
            strValue !== null && (strValue.toLowerCase() === 'true' || strValue === '1');

          return parse(parsed, { shouldFlatten: true });
        }

        if (strValue === null) {
          return parse(null, { shouldFlatten: true });
        }

        const parseInt = (await parse(selectDefined(value.parseInt, value.$parseInt))).toJSON();

        if (parseInt) {
          const parsed = Number.parseInt(strValue, 10);

          if (Number.isNaN(parsed)) {
            throw new AppConfigError(`Failed to parseInt(${strValue})`);
          }

          return parse(parsed, { shouldFlatten: true });
        }

        const parseFloat = (
          await parse(selectDefined(value.parseFloat, value.$parseFloat))
        ).toJSON();

        if (parseFloat) {
          const parsed = Number.parseFloat(strValue);

          if (Number.isNaN(parsed)) {
            throw new AppConfigError(`Failed to parseFloat(${strValue})`);
          }

          return parse(parsed, { shouldFlatten: true });
        }

        return parse(strValue, { shouldFlatten: true });
      };

      let resolvedValue = process.env[name];

      if (!resolvedValue && name === 'APP_CONFIG_ENV') {
        resolvedValue = envType;
      }

      if (resolvedValue) {
        return parseValue(resolvedValue);
      }

      if (value.fallback !== undefined || value.$fallback !== undefined) {
        const fallback = (await parse(selectDefined(value.fallback, value.$fallback))).toJSON();
        const allowNull = (await parse(selectDefined(value.allowNull, value.$allowNull))).toJSON();

        if (allowNull) {
          validateStringOrNull(fallback, [...ctx, key, [InObject, 'fallback']]);
        } else {
          validateString(fallback, [...ctx, key, [InObject, 'fallback']]);
        }

        return parseValue(fallback);
      }

      throw new AppConfigError(`$substitute could not find ${name} environment variable`);
    }),
  );
}

function performAllSubstitutions(text: string, envType?: string): string {
  let output = text;

  /* eslint-disable-next-line no-constant-condition */
  while (true) {
    // this regex matches:
    //   $FOO
    //   ${FOO}
    //   ${FOO:-fallback}
    //   ${FOO:-${FALLBACK}}
    //
    // var name is group 1 || 2
    // fallback value is group 3
    // https://regex101.com/r/6ZMmx7/3
    const match = /\$(?:([a-zA-Z_]\w+)|(?:{([a-zA-Z_]\w+)(?::- *(.*?) *)?}))/g.exec(output);

    if (!match) break;

    const fullMatch = match[0];
    const varName = match[1] || match[2];
    const fallback = match[3];

    if (varName) {
      const env = process.env[varName];

      if (env !== undefined) {
        output = output.replace(fullMatch, env);
      } else if (fallback !== undefined) {
        // we'll recurse again, so that ${FOO:-${FALLBACK}} -> ${FALLBACK} -> value
        output = performAllSubstitutions(output.replace(fullMatch, fallback), envType);
      } else if (varName === 'APP_CONFIG_ENV') {
        if (!envType) {
          throw new AppConfigError(`Could not find environment variable ${varName}`);
        }

        // there's a special case for APP_CONFIG_ENV, which is always the envType
        output = output.replace(fullMatch, envType);
      } else {
        throw new AppConfigError(`Could not find environment variable ${varName}`);
      }
    }
  }

  logger.verbose(`Performed $substitute for "${text}" -> "${output}"`);

  return output;
}

function selectDefined<T>(...args: (T | null | undefined)[]): T | null {
  for (const a of args) {
    if (a !== undefined) return a;
  }

  return (undefined as any) as T;
}

const validateObject: ValidationFunction<
  Record<string, any>
> = validationFunction(({ emptySchema }) => emptySchema().addAdditionalProperties());

const validateString: ValidationFunction<string> = validationFunction(({ stringSchema }) =>
  stringSchema(),
);

const validateStringOrNull: ValidationFunction<
  string | null
> = validationFunction(({ fromJsonSchema }) =>
  fromJsonSchema({ type: ['null', 'string'] } as const),
);