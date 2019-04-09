// @flow

export function deterministicStringify(value: any): string {
  const t = Object.prototype.toString.call(value);
  if (t === '[object Object]') {
    const pairs = [];
    for (const key of Object.keys(value).sort()) {
      const k = deterministicStringify(key);
      const v = deterministicStringify(value[key]);
      if (v !== '' && k !== '') {
        pairs.push(`${k}:${v}`);
      }
    }
    return `{${pairs.join(',')}}`;
  } else if (t === '[object Array]') {
    const items = [];
    for (const v of value) {
      const vStr = deterministicStringify(v);
      if (vStr !== '') {
        items.push(vStr);
      }
    }
    return `[${items.join(',')}]`;
  }

  const str = JSON.stringify(value);

  // Only return valid stringifyable things
  return str === undefined ? '' : str;
}
