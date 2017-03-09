export function getKeys (obj, prefix = '') {
  let allKeys = [];

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      getKeys(obj[i], `${prefix}[${i}]`).map(k => allKeys.push(k));
    }
  } else if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      allKeys = allKeys.concat(getKeys(obj[key], newPrefix));
    }
  }

  if (prefix) {
    allKeys.push(prefix);
  }

  return allKeys;
}
