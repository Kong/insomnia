const CHARS = '023456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ'.split('');

export function generateId (prefix) {
  let id = `${prefix}_${Date.now()}-`;
  
  for (let i = 0; i < 10; i++) {
    id += CHARS[Math.floor(Math.random() * CHARS.length)];
  }

  return id;
}
