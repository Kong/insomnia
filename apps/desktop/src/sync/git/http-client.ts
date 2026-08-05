import type { GitHttpRequest, GitHttpResponse, HttpClient } from 'isomorphic-git';

/**
 * Adopted from https://github.com/isomorphic-git/isomorphic-git/blob/main/src/http/web/index.js
 * Isomophic-Git's node HTTP client doesn't support loading HTTP_PROXY settings or loading Certificates.
 * In order to do so we need to create our own HTTP Client and use electron's net module which does this.
 * https://isomorphic-git.org/docs/en/http#docsNav:~:text=If%20you%20need%20features%20that%20aren%27t%20supported%20currently%2C%20like%20detecting%20and%20handling%20HTTP_PROXY%20environment%20variables%2C%20you%20can%20wrap%20this%20client%20or%20implement%20your%20own%20HTTP%20client.%20(See%20section%20below.)
 */
async function collect(iterable: Iterable<Uint8Array>): Promise<Uint8Array> {
  let size = 0;
  const buffers: Uint8Array[] = [];
  // This will be easier once `for await ... of` loops are available.

  for await (const value of iterable) {
    buffers.push(value);
    size += value.byteLength;
  }

  const result = new Uint8Array(size);
  let nextIndex = 0;
  for (const buffer of buffers) {
    result.set(buffer, nextIndex);
    nextIndex += buffer.byteLength;
  }
  return result;
}

function isAsyncIterable<T>(obj: any): obj is AsyncIterable<T> {
  return obj && typeof obj[Symbol.asyncIterator] === 'function';
}

// Convert a web ReadableStream (not Node stream!) to an Async Iterator
// adapted from https://jakearchibald.com/2017/async-iterators-and-generators/
function fromStream(stream: ReadableStream<Uint8Array>) {
  // Use native async iteration if it's available.
  if (isAsyncIterable(stream)) {
    return stream;
  }

  const reader = stream.getReader();
  return {
    next() {
      return reader.read();
    },
    return() {
      reader.releaseLock();
      return {};
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}

async function request({ url, method = 'GET', headers = {}, body }: GitHttpRequest): Promise<GitHttpResponse> {
  if (body) {
    body = await collect(body);
  }

  const electron = await import('electron');

  const res = await electron.net.fetch(url, { method, headers, body });
  const iter = res.body ? fromStream(res.body) : [new Uint8Array(await res.arrayBuffer())];
  // convert Header object to ordinary JSON
  headers = {};
  for (const [key, value] of res.headers.entries()) {
    headers[key] = value;
  }
  return {
    url: res.url,
    method,
    statusCode: res.status,
    statusMessage: res.statusText,
    body: iter,
    headers: headers,
  };
}

/** This is a client for isomorphic-git {@link https://isomorphic-git.org/docs/en/http} */
export const httpClient: HttpClient = {
  request,
};
