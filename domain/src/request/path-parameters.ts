const PATH_PARAMETER_REGEX = /\/:[^/?#:]+/g;

/** Path parameters are URL segments that start with a colon, e.g. `/users/:id`. */
export function getPathParametersFromUrl(url: string): string[] {
  const matches = url.match(PATH_PARAMETER_REGEX)?.map(match => match.replace('/:', '')) || [];
  return [...new Set(matches)];
}
