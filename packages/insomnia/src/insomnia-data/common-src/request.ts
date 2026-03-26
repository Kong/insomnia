export const CONTENT_TYPE_FORM_URLENCODED = 'application/x-www-form-urlencoded';

export function getContentTypeFromHeaders(headers: any[], defaultValue: string | null = null) {
  if (!Array.isArray(headers)) {
    return null;
  }

  const header = headers.find(({ name }) => name.toLowerCase() === 'content-type');
  return header ? header.value : defaultValue;
}
