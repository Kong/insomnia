import type { Settings } from "../models/settings";
import type { RenderedRequest } from "../templating/types";

export function isFsAccessingAllowed(renderedRequest: RenderedRequest, settings: Settings) {
  const throwError = (fileName: string) => {
    throw `Insomnia cannot access the file ‘${fileName}’. You can adjust this in Preferences → Security.`;
  }
  
  // case1: check request body (set by scripts or request body editor)
  if (renderedRequest.body.fileName !== undefined && renderedRequest.body.fileName !== '') {
    const allowed = settings?.dataFolders.some(folder => folder !== '' && renderedRequest.body.fileName?.startsWith(folder));
    if (!allowed) {
      throwError(renderedRequest.body.fileName);
    }
  }

  // case2: check the body form data - "file" type params
  if (Array.isArray(renderedRequest.body.params)) {
    renderedRequest.body.params.forEach(param => {
      if (param.type === "file" && !param.disabled) {
        const allowed = settings?.dataFolders.some(folder => folder !== '' && param.fileName?.startsWith(folder));
        if (!allowed) {
          throwError(param.fileName || param.value);
        }
      }
    });
  }

  // case3: check "file" template tags, which is checked in tag implementation
}
