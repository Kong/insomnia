// httpsnippet validates the HAR request before converting it. Its HARError only says
// "Validation Failed"; the offending fields live in `errors`, which cannot cross the IPC boundary.
// Turn them into a message that names what the user has to fix.

interface HarValidationError {
  instancePath?: string;
  message?: string;
  params?: { missingProperty?: string };
}

const FIELD_LABELS: Record<string, string> = {
  url: 'URL',
  method: 'method',
  httpVersion: 'HTTP version',
  headers: 'header',
  cookies: 'cookie',
  queryString: 'query parameter',
  postData: 'request body',
  headersSize: 'headers size',
  bodySize: 'body size',
};

const describeField = (instancePath: string) => {
  const [root, ...nested] = instancePath.replace(/^\//, '').split('/');
  const label = FIELD_LABELS[root] ?? (root || 'request');
  if (nested.length === 0) {
    return label;
  }
  // Array elements are reported as `/headers/2`, at any depth.
  const [first, ...rest] = nested;
  const head = /^\d+$/.test(first) ? `${label} ${Number(first) + 1}` : `${label} > ${first}`;
  const tail = rest.map(part => (/^\d+$/.test(part) ? String(Number(part) + 1) : part)).join(' > ');
  return tail ? `${head} > ${tail}` : head;
};

const describeError = ({ instancePath = '', message = '', params }: HarValidationError) => {
  const [root] = instancePath.replace(/^\//, '').split('/');
  const field = describeField(instancePath);

  if (params?.missingProperty) {
    return `${field} is missing "${params.missingProperty}"`;
  }
  if (root === 'url' && message.includes('format')) {
    return 'URL is not a valid URL — check it is not empty, starts with a scheme such as https://, and has no unencoded spaces or non-ASCII characters';
  }
  return `${field} ${message}`;
};

/** Field-level description of a HAR validation failure, or null when the error carries none. */
export const describeCodeSnippetError = (error: unknown): string | null => {
  const errors = (error as { errors?: HarValidationError[] } | null)?.errors;
  if (!Array.isArray(errors) || errors.length === 0) {
    return null;
  }
  return `Could not generate code: ${errors.map(describeError).join('; ')}.`;
};

/** Errors cross IPC as a bare message, so turn HAR validation details into one the user can act on. */
export const toCodeSnippetError = (error: unknown): unknown => {
  const description = describeCodeSnippetError(error);
  return description ? new Error(description) : error;
};
