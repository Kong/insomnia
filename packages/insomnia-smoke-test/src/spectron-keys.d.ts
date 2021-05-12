declare module 'spectron-keys' {
  type WebdriverReadyUnicodeAndKeys = [WebDriverReadyUnicode: string, keys: string];
  export const mapAccelerator: (accelerator: string, platform?: string) => WebdriverReadyUnicodeAndKeys;
}
