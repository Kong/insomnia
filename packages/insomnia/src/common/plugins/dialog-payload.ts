/**
 * `context.app.dialog(title, body, options)` is called from the hidden plugin window but rendered by
 * the main window's WrapperModal, so everything in the request has to survive Electron IPC. A live
 * DOM node, and an `onHide` callback, cannot be structured-cloned: `ipcRenderer.send` throws
 * "An object could not be cloned" inside the hidden window, where nobody can see it, and the dialog
 * never opens. Build the request here instead, with the body serialized to HTML.
 */

export interface DialogRequest {
  title: string;
  body?: string;
  tall?: boolean;
  skinny?: boolean;
  wide?: boolean;
}

const LAYOUT_OPTIONS = ['tall', 'skinny', 'wide'] as const;

// Plugins usually hand `dialog()` a detached container they filled with React 18's
// `createRoot().render()`, which schedules the first render instead of painting synchronously. Wait
// briefly for that render so the modal opens with content instead of an empty body.
export const DIALOG_BODY_RENDER_WAIT_MS = 1000;

const isHtmlElement = (value: unknown): value is HTMLElement =>
  typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;

export const serializeDialogBody = async (body?: unknown): Promise<string | undefined> => {
  if (typeof body === 'string') {
    return body;
  }
  if (!isHtmlElement(body)) {
    return;
  }
  if (body.childNodes.length > 0) {
    return body.outerHTML;
  }
  return new Promise<string>(resolve => {
    const finish = () => {
      clearTimeout(timer);
      observer.disconnect();
      resolve(body.outerHTML);
    };
    const observer = new MutationObserver(() => {
      if (body.childNodes.length > 0) {
        finish();
      }
    });
    observer.observe(body, { childList: true, subtree: true });
    const timer = setTimeout(finish, DIALOG_BODY_RENDER_WAIT_MS);
  });
};

export const buildDialogRequest = async (options?: Record<string, unknown>): Promise<DialogRequest> => {
  const request: DialogRequest = { title: typeof options?.title === 'string' ? options.title : '' };
  const body = await serializeDialogBody(options?.body);
  if (body !== undefined) {
    request.body = body;
  }
  for (const key of LAYOUT_OPTIONS) {
    if (typeof options?.[key] === 'boolean') {
      request[key] = options[key];
    }
  }
  return request;
};
