export const extname = (p: string) => {
  const idx = p.lastIndexOf('.');
  return idx === -1 || idx === 0 ? '' : p.slice(idx);
};
export default { extname };
