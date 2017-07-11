import * as misc from '../../common/misc';

export function init (plugin, renderedRequest) {
  if (!renderedRequest) {
    throw new Error('contexts.request initialized without request');
  }

  return {
    request: {
      getId () {
        return renderedRequest._id;
      },
      getName () {
        return renderedRequest.name;
      },
      getUrl () {
        // TODO: Get full URL, including querystring
        return renderedRequest.url;
      },
      getMethod () {
        return renderedRequest.method;
      },
      getHeader (name) {
        const headers = misc.filterHeaders(renderedRequest.headers, name);
        if (headers.length) {
          // Use the last header if there are multiple of the same
          const header = headers[headers.length - 1];
          return header.value || '';
        } else {
          return null;
        }
      },
      hasHeader (name) {
        return this.getHeader(name) !== null;
      },
      removeHeader (name) {
        const headers = misc.filterHeaders(renderedRequest.headers, name);
        renderedRequest.headers = renderedRequest.headers.filter(
          h => !headers.includes(h)
        );
      },
      setHeader (name, value) {
        const header = misc.filterHeaders(renderedRequest.headers, name)[0];
        if (header) {
          header.value = value;
        } else {
          this.addHeader(name, value);
        }
      },
      addHeader (name, value) {
        const header = misc.filterHeaders(renderedRequest.headers, name)[0];
        if (!header) {
          renderedRequest.headers.push({name, value});
        }
      },
      setCookie (name, value) {
        renderedRequest.cookies.push({name, value});
      }
    }
  };
}
