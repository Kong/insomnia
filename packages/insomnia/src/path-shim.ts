export const extname = (p: string | undefined | null) => (p ? p.slice(p.lastIndexOf('.')) : '');
export default { extname };
