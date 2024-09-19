export const serializeNDJSON = (data: any[]) => {
  return data.map((item: any) => JSON.stringify(item)).join('\n');
};
export const deserializeNDJSON = (data: string) => {
  return data.split('\n').filter(e => e?.trim()).map((line: string) => JSON.parse(line));
};
