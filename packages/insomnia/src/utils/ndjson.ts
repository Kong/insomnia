export const serializeNDJSON = (data: any[]): string => {
  return data.map((item: any) => JSON.stringify(item) + '\n').join('');
};
export const deserializeNDJSON = (data: string): any[] => {
  if (data?.trim() === '') {
    return [];
  }
  // Legacy content - a single JSON array
  if (data.startsWith('[')) {
    try {
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }
  return data
    .split('\n')
    .filter(e => e?.trim())
    .map((line: string) => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return undefined;
      }
    })
    .filter(e => e !== undefined);
};
