export async function createPlugin(pluginName: string, mainJs: string) {
  return window.main.createPlugin({ pluginName, mainJs });
}
