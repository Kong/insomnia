export function getBasicAuthHeader (username, password) {
  const name = 'Authorization';
  const header = `${username || ''}:${password || ''}`;
  const authString = new Buffer(header, 'utf8').toString('base64');
  const value = `Basic ${authString}`;
  return {name, value};
}

export function hasAuthHeader (headers) {
  if (!Array.isArray(headers)) {
    return false;
  }

  const index = headers.findIndex(
    h => h.name.toLowerCase() === 'authorization'
  );

  return index !== -1;
}
