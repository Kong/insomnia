export const serializeNDJSON = (data: any[]): string => {
  return data.map((item: any) => JSON.stringify(item)).join('\n') + '\n';
};
export const deserializeNDJSON = (data: string): any[] => {
  return data.split('\n').filter(e => e?.trim()).map((line: string) => {
    try {
      return JSON.parse(line);
    } catch (e) {
      console.log('Failed to deserialize line', line, e);
      return undefined;
    }
  }).filter(e => e !== undefined);
};
