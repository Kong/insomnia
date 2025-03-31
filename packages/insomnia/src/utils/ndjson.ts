export const serializeNDJSON = (data: any[]) => data.map((item: any) => JSON.stringify(item)).join('\n') + '\n';
export const deserializeNDJSON = (data: string) => data.split('\n').filter(e => e?.trim()).map((line: string) => {
    try {
      return JSON.parse(line);
    } catch (e) {
      console.log('Failed to deserialize line', line, e);
      return undefined;
    }
  }).filter(e => e !== undefined);
