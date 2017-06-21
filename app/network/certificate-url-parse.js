import {parse as urlParse} from 'url';
const WILDCARD_CHARACTER = '*';
const WILDCARD_SUBSTITUTION = Math.random().toString().split('.')[1];
const WILDCARD_SUBSTITUTION_PATTERN = new RegExp(`${WILDCARD_SUBSTITUTION}`, 'g');

export default function certificateUrlParse (url) {
  if (url.indexOf(WILDCARD_CHARACTER) === -1) {
    return urlParse(url);
  } else {
    const parsed = urlParse(url.replace(/\*/g, WILDCARD_SUBSTITUTION));
    parsed.hostname = reinstateWildcards(parsed.hostname);
    parsed.host = reinstateWildcards(parsed.host);
    parsed.href = reinstateWildcards(parsed.href);

    return parsed;
  }
}

const reinstateWildcards = (string) => {
  if (string) {
    return string.replace(WILDCARD_SUBSTITUTION_PATTERN, WILDCARD_CHARACTER);
  } else {
    return string;
  }
};
