// @flow
import type { RenderedRequest } from '../../common/render';
import type { RequestBodyParameter } from '../../models/request';
import * as misc from '../../common/misc';
import { CONTENT_TYPE_FORM_DATA, CONTENT_TYPE_FILE } from '../../common/constants';

export function init(
  renderedRequest: RenderedRequest,
  renderedContext: Object,
  readOnly: boolean = false,
): { request: Object } {
  if (!renderedRequest) {
    throw new Error('contexts.request initialized without request');
  }

  const request = {
    getId(): string {
      return renderedRequest._id;
    },
    getMimeType(): string {
      return renderedRequest.body.mimeType || '';
    },
    setMimeType(mimeType: string): void {
      renderedRequest.body.mimeType = mimeType;
    },
    getBodyText(): string {
      return renderedRequest.body.text || '';
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
    setBodyText(text: string): void {
      renderedRequest.body.text = text;
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
    getUploadFileName(): string {
      return renderedRequest.body.fileName || '';
    },
    setUploadFileName(fileName: string): boolean {
      const canSetFile = renderedRequest.body.mimeType === CONTENT_TYPE_FILE;
      if (canSetFile) {
        renderedRequest.body.fileName = fileName;
      }
      return canSetFile;
    },
    getTextForm(): Array<any> {
      return (renderedRequest.body.params || [])
        .filter(p => !p.type || p.type === 'text')
        .map(({ name, value }) => ({ name, value }));
    },
    getFileForm(): Array<any> {
      return (renderedRequest.body.params || [])
        .filter(p => p.type === 'file')
        .map(({ name, fileName }) => ({ name, fileName }));
    },
    addFormItem(formItem: RequestBodyParameter): boolean {
      if (formItem.type === 'file' && renderedRequest.body.mimeType !== CONTENT_TYPE_FORM_DATA) {
        return false;
      }
      const oldFormItem = misc.filterFormItem(
        renderedRequest.body.params || [],
        '',
        formItem.name,
      )[0];
      if (oldFormItem) {
        return false;
      }
      if (renderedRequest.body.params) {
        renderedRequest.body.params.push(formItem);
      } else {
        renderedRequest.body.params = [formItem];
      }
      return true;
    },
    addTextFormItem(name: string, value: string): boolean {
      return this.addFormItem({ type: 'text', name, value });
    },
    addFileFormItem(name: string, fileName: string): boolean {
      return this.addFormItem({ type: 'file', name, fileName });
    },
    setFormItem(formItem: RequestBodyParameter): boolean {
      if (formItem.type === 'file' && renderedRequest.body.mimeType !== CONTENT_TYPE_FORM_DATA) {
        return false;
      }
      if (this.addFormItem(formItem)) {
        return true;
      }
      const oldFormItem = misc.filterFormItem(
        renderedRequest.body.params || [],
        formItem.type || 'text',
        formItem.name,
      )[0];
      if (formItem.type === 'text') {
        oldFormItem.value = formItem.value;
      } else if (formItem.type === 'file') {
        oldFormItem.fileName = formItem.fileName;
      } else {
        return false;
      }
      return true;
    },
    setTextFormItem(name: string, value: string): boolean {
      return this.setFormItem({ type: 'text', name, value });
    },
    setFileFormItem(name: string, fileName: string): boolean {
      return this.setFormItem({ type: 'file', name, value: fileName, fileName });
    },
    removeFormItem(name: string): void {
      if (!renderedRequest.body.params) {
        return;
      }
      renderedRequest.body.params = renderedRequest.body.params.filter(f => f.name !== name);
    },

    // NOTE: For these to make sense, we'd need to account for cookies in the jar as well
    // addCookie (name: string, value: string): void {}
    // getCookie (name: string): string | null {}
    // removeCookie (name: string): void {}
  };

  if (readOnly) {
    delete request.setUrl;
    delete request.setMethod;
    delete request.setMimeType;
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
    delete request.setUploadFileName;
    delete request.addFormItem;
    delete request.addTextFormItem;
    delete request.addFileFormItem;
    delete request.setFormItem;
    delete request.setTextFormItem;
    delete request.setFileFormItem;
    delete request.removeFormItem;
  }

  return { request };
}
