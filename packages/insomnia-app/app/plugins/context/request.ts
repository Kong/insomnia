import type { RenderedRequest } from '../../common/render';
import type { RequestBody } from '../../models/request';
import * as misc from '../../common/misc';
export function init(
  renderedRequest: RenderedRequest,
  renderedContext: Record<string, any>,
  readOnly = false,
): {
  request: Record<string, any>;
} {
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

    settingFollowRedirects(enabled: string) {
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
      const parameters = misc.filterParameters(renderedRequest.parameters, name);

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
      const parameters = misc.filterParameters(renderedRequest.parameters, name);
      renderedRequest.parameters = renderedRequest.parameters.filter(p => !parameters.includes(p));
    },

    setParameter(name: string, value: string) {
      const parameter = misc.filterParameters(renderedRequest.parameters, name)[0];

      if (parameter) {
        parameter.value = value;
      } else {
        this.addParameter(name, value);
      }
    },

    addParameter(name: string, value: string) {
      const parameter = misc.filterParameters(renderedRequest.parameters, name)[0];

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

  if (readOnly) {
    // @ts-expect-error -- needs a proper request type
    delete request.setUrl;
    // @ts-expect-error -- needs a proper request type
    delete request.setMethod;
    // @ts-expect-error -- needs a proper request type
    delete request.setBodyText;
    // @ts-expect-error -- needs a proper request type
    delete request.setCookie;
    // @ts-expect-error -- needs a proper request type
    delete request.settingSendCookies;
    // @ts-expect-error -- needs a proper request type
    delete request.settingStoreCookies;
    // @ts-expect-error -- needs a proper request type
    delete request.settingEncodeUrl;
    // @ts-expect-error -- needs a proper request type
    delete request.settingDisableRenderRequestBody;
    // @ts-expect-error -- needs a proper request type
    delete request.settingFollowRedirects;
    // @ts-expect-error -- needs a proper request type
    delete request.removeHeader;
    // @ts-expect-error -- needs a proper request type
    delete request.setHeader;
    // @ts-expect-error -- needs a proper request type
    delete request.addHeader;
    // @ts-expect-error -- needs a proper request type
    delete request.removeParameter;
    // @ts-expect-error -- needs a proper request type
    delete request.setParameter;
    // @ts-expect-error -- needs a proper request type
    delete request.addParameter;
    // @ts-expect-error -- needs a proper request type
    delete request.addParameter;
    // @ts-expect-error -- needs a proper request type
    delete request.setAuthenticationParameter;
    // @ts-expect-error -- needs a proper request type
    delete request.setBody;
  }

  return {
    request,
  };
}
