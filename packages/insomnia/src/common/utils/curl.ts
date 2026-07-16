// Matches a cURL command, optionally prefixed with a shell prompt (`$ curl ...`).
// Requires a word boundary after "curl" so URLs like "curl.se/..." aren't misdetected.
export const CURL_COMMAND_PATTERN = /^\s*\$?\s*curl(?:\s|$)/i;

export const isCurlCommand = (value: string) => CURL_COMMAND_PATTERN.test(value.trim());
