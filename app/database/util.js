
// NOTE: hard-to-distinguish characters have been remove like 0, o, O, etc...
const CHARS = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ'.split('');

export function generateId (prefix) {
  let id = `${prefix}_${Date.now()}_`;
  
  for (let i = 0; i < 13; i++) {
    id += CHARS[Math.floor(Math.random() * CHARS.length)];
  }

  return id;
}
