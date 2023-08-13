import * as misc from '../../common/misc';
import type { RenderedRequest } from '../../common/render';
import type { RequestBody } from '../../models/request';
export function filterParameters<T extends { name: string; value: string }>(
  parameters: T[],
  name: string,
): T[] {
  if (!Array.isArray(parameters) || !name) {
    return [];
  }

  return parameters.filter(h => (!h || !h.name ? false : h.name === name));
}
export function init(
  renderedRequest: RenderedRequest | null,
  renderedContext: Record<string, any>,
  readOnly = false,
) {
  if (!renderedRequest) {
    throw new Error('contexts.request initialized without request');
  }

  const request = {
    getId() {
      return renderedRequest._id;
    },

    getName() {
      return renderedRequest.name;
    },

    getUrl() {
      return renderedRequest.url;
    },

    getMethod() {
      return renderedRequest.method;
    },

    setMethod(method: string) {
      renderedRequest.method = method;
    },

    setUrl(url: string) {
      renderedRequest.url = url;
    },

    setCookie(name: string, value: string) {
      const cookie = renderedRequest.cookies.find(c => c.name === name);

      if (cookie) {
        cookie.value = value;
      } else {
        renderedRequest.cookies.push({
          name,
          value,
        });
      }
    },

    getEnvironmentVariable(
      name: string,
    ): string | number | boolean | Record<string, any> | any[] | null {
      return renderedContext[name];
    },

    getEnvironment() {
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

    settingFollowRedirects(enabled: 'global' | 'on' | 'off') {
      renderedRequest.settingFollowRedirects = enabled;
    },

    getHeader(name: string) {
      const headers = misc.filterHeaders(renderedRequest.headers, name);

      if (headers.length) {
        // Use the last header if there are multiple of the same
        const header = headers[headers.length - 1];
        return header.value || '';
      } else {
        return null;
      }
    },

    getHeaders() {
      return renderedRequest.headers.map(h => ({
        name: h.name,
        value: h.value,
      }));
    },

    hasHeader(name: string) {
      return this.getHeader(name) !== null;
    },

    removeHeader(name: string) {
      const headers = misc.filterHeaders(renderedRequest.headers, name);
      renderedRequest.headers = renderedRequest.headers.filter(h => !headers.includes(h));
    },

    setHeader(name: string, value: string) {
      const header = misc.filterHeaders(renderedRequest.headers, name)[0];

      if (header) {
        header.value = value;
      } else {
        this.addHeader(name, value);
      }
    },

    addHeader(name: string, value: string) {
      const header = misc.filterHeaders(renderedRequest.headers, name)[0];

      if (!header) {
        renderedRequest.headers.push({
          name,
          value,
        });
      }
    },

    getParameter(name: string) {
      const parameters = filterParameters(renderedRequest.parameters, name);

      if (parameters.length) {
        // Use the last parameter if there are multiple of the same
        const parameter = parameters[parameters.length - 1];
        return parameter.value || '';
      } else {
        return null;
      }
    },

    getParameters() {
      return renderedRequest.parameters.map(p => ({
        name: p.name,
        value: p.value,
      }));
    },

    hasParameter(name: string) {
      return this.getParameter(name) !== null;
    },

    removeParameter(name: string) {
      const parameters = filterParameters(renderedRequest.parameters, name);
      renderedRequest.parameters = renderedRequest.parameters.filter(p => !parameters.includes(p));
    },

    setParameter(name: string, value: string) {
      const parameter = filterParameters(renderedRequest.parameters, name)[0];

      if (parameter) {
        parameter.value = value;
      } else {
        this.addParameter(name, value);
      }
    },

    addParameter(name: string, value: string) {
      const parameter = filterParameters(renderedRequest.parameters, name)[0];

      if (!parameter) {
        renderedRequest.parameters.push({
          name,
          value,
        });
      }
    },

    setAuthenticationParameter(name: string, value: string) {
      Object.assign(renderedRequest.authentication, {
        [name]: value,
      });
    },

    getAuthentication() {
      return renderedRequest.authentication;
    },

    getBody() {
      return renderedRequest.body;
    },

    setBody(body: RequestBody) {
      renderedRequest.body = body;
    },

    // ~~~~~~~~~~~~~~~~~~ //
    // Deprecated Methods //
    // ~~~~~~~~~~~~~~~~~~ //

    /** @deprecated in favor of getting the whole body by getBody */
    getBodyText() {
      console.warn('request.getBodyText() is deprecated. Use request.getBody() instead.');
      return renderedRequest.body.text || '';
    },

    /** @deprecated in favor of setting the whole body by setBody */
    setBodyText(text: string) {
      console.warn('request.setBodyText() is deprecated. Use request.setBody() instead.');
      renderedRequest.body.text = text;
    },

    // NOTE: For these to make sense, we'd need to account for cookies in the jar as well
    // addCookie (name: string, value: string) {}
    // getCookie (name: string): string | null {}
    // removeCookie (name: string) {}
  };

  /* eslint-disable @typescript-eslint/ban-ts-comment */
  if (readOnly) {
    // @ts-ignore -- TSCONVERSION something is wrong here, the build doesn't error here but vscode does
    delete request.setUrl;
    // @ts-ignore -- TSCONVERSION something is wrong here, the build doesn't error here but vscode does
    delete request.setMethod;
    // @ts-ignore -- TSCONVERSION something is wrong here, the build doesn't error here but vscode does
    delete request.setBodyText;
    // @ts-ignore -- TSCONVERSION something is wrong here, the build doesn't error here but vscode does
    delete request.setCookie;
    // @ts-ignore -- TSCONVERSION something is wrong here, the build doesn't error here but vscode does
    delete request.settingSendCookies;
    // @ts-ignore -- TSCONVERSION something is wrong here, the build doesn't error here but vscode does
    delete request.settingStoreCookies;
    // @ts-ignore -- TSCONVERSION something is wrong here, the build doesn't error here but vscode does
    delete request.settingEncodeUrl;
    // @ts-ignore -- TSCONVERSION something is wrong here, the build doesn't error here but vscode does
    delete request.settingDisableRenderRequestBody;
    // @ts-ignore -- TSCONVERSION something is wrong here, the build doesn't error here but vscode does
    delete request.settingFollowRedirects;
    // @ts-ignore -- TSCONVERSION something is wrong here, the build doesn't error here but vscode does
    delete request.removeHeader;
    // @ts-ignore -- TSCONVERSION something is wrong here, the build doesn't error here but vscode does
    delete request.setHeader;
    // @ts-ignore -- TSCONVERSION something is wrong here, the build doesn't error here but vscode does
    delete request.addHeader;
    // @ts-ignore -- TSCONVERSION something is wrong here, the build doesn't error here but vscode does
    delete request.removeParameter;
    // @ts-ignore -- TSCONVERSION something is wrong here, the build doesn't error here but vscode does
    delete request.setParameter;
    // @ts-ignore -- TSCONVERSION something is wrong here, the build doesn't error here but vscode does
    delete request.addParameter;
    // @ts-ignore -- TSCONVERSION something is wrong here, the build doesn't error here but vscode does
    delete request.addParameter;
    // @ts-ignore -- TSCONVERSION something is wrong here, the build doesn't error here but vscode does
    delete request.setAuthenticationParameter;
    // @ts-ignore -- TSCONVERSION something is wrong here, the build doesn't error here but vscode does
    delete request.setBody;
  }
  /* eslint-enable @typescript-eslint/ban-ts-comment */

  return {
    request,
  };
}
