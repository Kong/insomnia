// @flow
import type { RenderedRequest } from '../../common/render';
import type { RequestBody } from '../../models/request';
import * as misc from '../../common/misc';

export function init(
  renderedRequest: RenderedRequest,
  renderedContext: Object,
  readOnly: boolean = false,
): { request: Object } {
  if (!renderedRequest) {
    throw new Error('contexts.request initialized without request');
  }

  const request = ({
    getId(): string {
      return renderedRequest._id;
    },
    getName(): string {
      return renderedRequest.name;
    },
    getUrl(): string {
      return renderedRequest.url;
    },
    getMethod(): string {
      return renderedRequest.method;
    },
    setMethod(method: string): void {
      renderedRequest.method = method;
    },
    setUrl(url: string): void {
      renderedRequest.url = url;
    },
    setCookie(name: string, value: string): void {
      const cookie = renderedRequest.cookies.find(c => c.name === name);
      if (cookie) {
        cookie.value = value;
      } else {
        renderedRequest.cookies.push({ name, value });
      }
    },
    getEnvironmentVariable(name: string): string | number | boolean | Object | Array<any> | null {
      return renderedContext[name];
    },
    getEnvironment(): Object {
      return renderedContext;
    },
    settingSendCookies(enabled: boolean) {
      renderedRequest.settingSendCookies = enabled;
    },
    settingStoreCookies(enabled: boolean) {
      renderedRequest.settingStoreCookies = enabled;
    },
    settingEncodeUrl(enabled: boolean) {
      renderedRequest.settingEncodeUrl = enabled;
    },
    settingDisableRenderRequestBody(enabled: boolean) {
      renderedRequest.settingDisableRenderRequestBody = enabled;
    },
    settingFollowRedirects(enabled: string) {
      renderedRequest.settingFollowRedirects = enabled;
    },
    getHeader(name: string): string | null {
      const headers = misc.filterHeaders(renderedRequest.headers, name);
      if (headers.length) {
        // Use the last header if there are multiple of the same
        const header = headers[headers.length - 1];
        return header.value || '';
      } else {
        return null;
      }
    },
    getHeaders(): Array<{ name: string, value: string }> {
      return renderedRequest.headers.map(h => ({
        name: h.name,
        value: h.value,
      }));
    },
    hasHeader(name: string): boolean {
      return this.getHeader(name) !== null;
    },
    removeHeader(name: string): void {
      const headers = misc.filterHeaders(renderedRequest.headers, name);
      renderedRequest.headers = renderedRequest.headers.filter(h => !headers.includes(h));
    },
    setHeader(name: string, value: string): void {
      const header = misc.filterHeaders(renderedRequest.headers, name)[0];
      if (header) {
        header.value = value;
      } else {
        this.addHeader(name, value);
      }
    },
    addHeader(name: string, value: string): void {
      const header = misc.filterHeaders(renderedRequest.headers, name)[0];
      if (!header) {
        renderedRequest.headers.push({ name, value });
      }
    },
    getParameter(name: string): string | null {
      const parameters = misc.filterParameters(renderedRequest.parameters, name);
      if (parameters.length) {
        // Use the last parameter if there are multiple of the same
        const parameter = parameters[parameters.length - 1];
        return parameter.value || '';
      } else {
        return null;
      }
    },
    getParameters(): Array<{ name: string, value: string }> {
      return renderedRequest.parameters.map(p => ({
        name: p.name,
        value: p.value,
      }));
    },
    hasParameter(name: string): boolean {
      return this.getParameter(name) !== null;
    },
    removeParameter(name: string): void {
      const parameters = misc.filterParameters(renderedRequest.parameters, name);
      renderedRequest.parameters = renderedRequest.parameters.filter(p => !parameters.includes(p));
    },
    setParameter(name: string, value: string): void {
      const parameter = misc.filterParameters(renderedRequest.parameters, name)[0];
      if (parameter) {
        parameter.value = value;
      } else {
        this.addParameter(name, value);
      }
    },
    addParameter(name: string, value: string): void {
      const parameter = misc.filterParameters(renderedRequest.parameters, name)[0];
      if (!parameter) {
        renderedRequest.parameters.push({ name, value });
      }
    },
    setAuthenticationParameter(name: string, value: string): void {
      Object.assign(renderedRequest.authentication, {
        [name]: value,
      });
    },
    getAuthentication(): Object {
      return renderedRequest.authentication;
    },
    getBody(): RequestBody {
      return renderedRequest.body;
    },
    setBody(body: RequestBody): void {
      renderedRequest.body = body;
    },

    // ~~~~~~~~~~~~~~~~~~ //
    // Deprecated Methods //
    // ~~~~~~~~~~~~~~~~~~ //

    /** @deprecated in favor of getting the whole body by getBody */
    getBodyText(): string {
      console.warn('request.getBodyText() is deprecated. Use request.getBody() instead.');
      return renderedRequest.body.text || '';
    },

    /** @deprecated in favor of setting the whole body by setBody */
    setBodyText(text: string): void {
      console.warn('request.setBodyText() is deprecated. Use request.setBody() instead.');
      renderedRequest.body.text = text;
    },

    // NOTE: For these to make sense, we'd need to account for cookies in the jar as well
    // addCookie (name: string, value: string): void {}
    // getCookie (name: string): string | null {}
    // removeCookie (name: string): void {}
  }: Object);

  if (readOnly) {
    delete request.setUrl;
    delete request.setMethod;
    delete request.setBodyText;
    delete request.setCookie;
    delete request.settingSendCookies;
    delete request.settingStoreCookies;
    delete request.settingEncodeUrl;
    delete request.settingDisableRenderRequestBody;
    delete request.settingFollowRedirects;
    delete request.removeHeader;
    delete request.setHeader;
    delete request.addHeader;
    delete request.removeParameter;
    delete request.setParameter;
    delete request.addParameter;
    delete request.addParameter;
    delete request.setAuthenticationParameter;
    delete request.setBody;
  }

  return { request };
}
