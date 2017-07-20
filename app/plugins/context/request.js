// @flow
import type {Plugin} from '../';
import type {RenderedRequest} from '../../common/render';
import * as misc from '../../common/misc';

export function init (plugin: Plugin, renderedRequest: RenderedRequest): {request: Object} {
  if (!renderedRequest) {
    throw new Error('contexts.request initialized without request');
  }

  return {
    request: {
      getId (): string {
        return renderedRequest._id;
      },
      getName (): string {
        return renderedRequest.name;
      },
      getUrl (): string {
        // TODO: Get full URL, including querystring
        return renderedRequest.url;
      },
      getMethod (): string {
        return renderedRequest.method;
      },
      getHeader (name: string): string | null {
        const headers = misc.filterHeaders(renderedRequest.headers, name);
        if (headers.length) {
          // Use the last header if there are multiple of the same
          const header = headers[headers.length - 1];
          return header.value || '';
        } else {
          return null;
        }
      },
      hasHeader (name: string): boolean {
        return this.getHeader(name) !== null;
      },
      removeHeader (name: string): void {
        const headers = misc.filterHeaders(renderedRequest.headers, name);
        renderedRequest.headers = renderedRequest.headers.filter(
          h => !headers.includes(h)
        );
      },
      setHeader (name: string, value: string): void {
        const header = misc.filterHeaders(renderedRequest.headers, name)[0];
        if (header) {
          header.value = value;
        } else {
          this.addHeader(name, value);
        }
      },
      addHeader (name: string, value: string): void {
        const header = misc.filterHeaders(renderedRequest.headers, name)[0];
        if (!header) {
          renderedRequest.headers.push({name, value});
        }
      },
      setCookie (name: string, value: string): void {
        const cookie = renderedRequest.cookies.find(c => c.name === name);
        if (cookie) {
          cookie.value = value;
        } else {
          renderedRequest.cookies.push({name, value});
        }
      }

      // NOTE: For these to make sense, we'd need to account for cookies in the jar as well
      // addCookie (name: string, value: string): void {}
      // getCookie (name: string): string | null {}
      // removeCookie (name: string): void {}
    }
  };
}
