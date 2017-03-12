export function getKeys (obj, prefix = '') {
  let allKeys = [];

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      allKeys = [...allKeys, ...getKeys(obj[i], `${prefix}[${i}]`)];
    }
  } else if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      allKeys = [...allKeys, ...getKeys(obj[key], newPrefix)];
    }
  } else if (typeof obj === 'function') {
    // Skip functions
  } else if (prefix) {
    allKeys.push({name: prefix, value: obj});
  }

  return allKeys;
}
