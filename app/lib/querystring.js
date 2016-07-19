
export function getJoiner (url) {
  url = url || '';
  return url.indexOf('?') === -1 ? '?' : '&';
};

export function joinURL (url, qs) {
  if (!qs) { return url; }
  url = url || '';
  return url + getJoiner(url) + qs;
};

export function build (param) {
  // Skip non-name ones
  if (!param.name) { return ''; }

  if (param.value) {
    return encodeURIComponent(param.name) + '=' + encodeURIComponent(param.value);
  } else {
    return encodeURIComponent(param.name);
  }
};

export function buildFromParams (parameters) {
  var items = [];
  for (var i = 0; i < parameters.length; i++) {
    let param = parameters[i];
    items.push(build(param));
  }

  return items.join('&');
};
