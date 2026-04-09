import { isbot } from 'isbot';
import { renderToReadableStream } from 'react-dom/server.browser';
import type { EntryContext } from 'react-router';
import { ServerRouter } from 'react-router';

export const streamTimeout = 5000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  // loadContext: AppLoadContext
  // If you have middleware enabled:
  // loadContext: unstable_RouterContextProvider
) {
  const userAgent = request.headers.get('user-agent');
  const isBotOrSpa = (userAgent && isbot(userAgent)) || routerContext.isSpaMode;

  const abortController = new AbortController();
  setTimeout(() => abortController.abort(), streamTimeout + 1000);

  const stream = await renderToReadableStream(<ServerRouter context={routerContext} url={request.url} />, {
    signal: abortController.signal,
    onError(error: unknown) {
      responseStatusCode = 500;
      console.error(error);
    },
  });

  // Ensure requests from bots and SPA Mode renders wait for all content to load before responding
  // https://react.dev/reference/react-dom/server/renderToReadableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
  if (isBotOrSpa) {
    await stream.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');

  return new Response(stream, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
