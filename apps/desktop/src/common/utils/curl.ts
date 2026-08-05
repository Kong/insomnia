// Matches a cURL command, optionally prefixed with a shell prompt (`$ curl ...`).
// Requires whitespace (or end-of-string) after "curl" so URLs like "curl.se/..." aren't
// misdetected - a word boundary (\b) would not be enough, since it also matches before ".".
export const CURL_COMMAND_PATTERN = /^\s*\$?\s*curl(?:\s|$)/i;

export const isCurlCommand = (value: string) => CURL_COMMAND_PATTERN.test(value.trim());
