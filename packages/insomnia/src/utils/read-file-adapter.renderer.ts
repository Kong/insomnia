export const insecureReadFile = (path: string): Promise<string> => window.main.insecureReadFile({ path });
