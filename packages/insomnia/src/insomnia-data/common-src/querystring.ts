export interface IQueryStringOptions {
  // Option to distinguish between parameters with(&foo=) and without(&foo) equal signs. Both are converted to empty string by default.
  strictNullHandling?: boolean;
  // Option to encode parameters, default to true, necessary to disable for request.settingEncodeUrl = false
  encodeParams?: boolean;
}

type SearchParamsValueType = string;
export type StrictNullSearchParamsValueType = string | null;
interface ISearchParams {
  name: string;
  value: SearchParamsValueType;
}
interface IStrictNullSearchParams extends Omit<ISearchParams, 'value'> {
  value: StrictNullSearchParamsValueType;
}

// helper function to process deconstructQueryStringToParams return type base on options parameter
type ProcessDeconstructFuncReturnType<T> = T extends { strictNullHandling: true }
  ? IStrictNullSearchParams[]
  : ISearchParams[];
/**
 * Deconstruct a querystring to name/value pairs
 * @param [qs] {string}
 * @param [strict=true] {boolean} - allow empty names and values
 * @param [options] {IQueryStringOptions} - deconstruct options like strict null handling
 * @returns {{name: string, value: string | null}[]}
 */
export const deconstructQueryStringToParams = <T extends IQueryStringOptions>(
  qs?: string,

  /** allow empty names and values */
  strict?: boolean,
  /** extra deconstruct options like strict handle null value */
  options?: T,
): ProcessDeconstructFuncReturnType<T> => {
  strict = strict === undefined ? true : strict;
  const { strictNullHandling = false } = options || {};
  const pairs: ProcessDeconstructFuncReturnType<T> = [];
  type ValueType = (typeof pairs)[number]['value'];

  if (!qs) {
    return pairs;
  }

  const stringPairs = qs.split('&');

  for (const stringPair of stringPairs) {
    // NOTE: This only splits on first equals sign. '1=2=3' --> ['1', '2=3']
    const [encodedName, ...encodedValues] = stringPair.split('=');
    // Use null as value when strictNullHandling is enabled and no equal sign in string pair
    const encodedValue: ValueType = encodedValues.length === 0 && strictNullHandling ? null : encodedValues.join('=');

    let name = '';
    try {
      name = decodeURIComponent(encodedName || '');
    } catch {
      // Just leave it
      name = encodedName;
    }

    let value: ValueType = '';
    try {
      value = strictNullHandling && encodedValue === null ? null : decodeURIComponent(encodedValue || '');
    } catch {
      // Just leave it
      value = encodedValue;
    }

    if (strict && !name) {
      continue;
    }
    // @ts-expect-error value type is converted from pairs type automatically
    pairs.push({ name, value });
  }

  return pairs;
};
