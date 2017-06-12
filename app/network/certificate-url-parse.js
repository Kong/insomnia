import {parse as urlParse} from 'url';
const WILDCARD_CHARACTER = '*';

export default function certificateUrlParse (url) {
  if (url.indexOf(WILDCARD_CHARACTER) === -1) {
    return urlParse(url);
  } else {
    const parsed = urlParse(url.replace(/\*/g, ''));

    if (parsed.hostname !== null) {
      const wildcardIndices = findIndices(url, WILDCARD_CHARACTER);
      parsed.hostname = insertAtIndices(parsed.hostname, wildcardIndices, WILDCARD_CHARACTER);
    }

    return parsed;
  }
}

const insertAtIndices = (string, indices, charToInsert) => {
  const result = Array.from(string).reduce((acc, char, index) => {
    if (indices.includes(acc.length)) {
      return `${acc}${charToInsert}${char}`;
    } else {
      return `${acc}${char}`;
    }
  }, '');

  if (indices.includes(result.length)) {
    return `${result}${charToInsert}`;
  } else {
    return result;
  }
};

const findIndices = (url, character) => {
  const hostAndPath = removeProtocolAndAuth(url);
  const indices = [];
  for (let index = 0; index < hostAndPath.length; index++) {
    if (hostAndPath[index] === character) {
      indices.push(index);
    }
  }

  return indices;
};

const removeProtocolAndAuth = (url) => {
  const urlWithoutProtocol = url.split('://')[1] || '';
  const {auth} = urlParse(url);
  return urlWithoutProtocol.replace(`${auth}@`, '');
};
