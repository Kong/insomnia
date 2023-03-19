import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react';
import iconv from 'iconv-lite';
import React from 'react';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { globalBeforeEach } from '../../../../__jest__/before-each';
import { MockComponent, MockComponentTestId, mockRenderWithProps } from '../../../../__jest__/mock-component';
import { reduxStateForTest } from '../../../../__jest__/redux-state-for-test';
import { withReduxStore } from '../../../../__jest__/with-redux-store';
import { RootState } from '../../../redux/modules';
import { ResponseViewer, ResponseViewerProps } from '../response-viewer';

jest.mock('../../keydown-binder');
jest.mock('../../codemirror/code-editor', () => ({
  CodeEditor: MockComponent,
}));

const defaultProps: ResponseViewerProps = {
  bytes: 2,
  contentType: 'application/json',
  disableHtmlPreviewJs: false,
  disablePreviewLinks: false,
  download: jest.fn,
  editorFontSize: 11,
  filter: '',
  filterHistory: [],
  getBody: () => Buffer.from('{}'),
  previewMode: 'friendly',
  responseId: 'res_<UUID>',
  url: 'http://mockbin.org/echo',
};

const middlewares = [thunk];
const mockStore = configureMockStore<RootState>(middlewares);

const getResponseViewerChild = async (overrideProps:  Partial<ResponseViewerProps>, selector: string) => {
  const store = mockStore(await reduxStateForTest());
  const responseViewer = <ResponseViewer {...defaultProps} {...overrideProps} />;
  const { getByTestId } = render(responseViewer, { wrapper: withReduxStore(store) });
  return getByTestId(selector);
};

describe('<ResponseViewer />', () => {
  beforeEach(globalBeforeEach);

  it('should use plain text mode for a text/plain Content-Type with plain text body', async () => {
    const codeEditor = await getResponseViewerChild({
      contentType: 'text/plain',
      getBody: () => Buffer.from('plain text'),
    }, MockComponentTestId);

    expect(codeEditor).toBeInTheDocument();
    expect(mockRenderWithProps).toHaveBeenCalledWith(expect.objectContaining({ mode: 'text/plain' }));
  });

  it('should use JSON mode for a JSON Content-Type with valid JSON body', async () => {
    const codeEditor = await getResponseViewerChild({
      contentType: 'application/json',
      getBody: () => Buffer.from('{"validJSON":true}'),
    }, MockComponentTestId);

    expect(codeEditor).toBeInTheDocument();
    expect(mockRenderWithProps).toHaveBeenCalledWith(expect.objectContaining({ mode: 'application/json' }));
  });

  it('should use JSON mode for text/plain Content-Type when the body is valid JSON', async () => {
    const codeEditor = await getResponseViewerChild({
      contentType: 'text/plain',
      getBody: () => Buffer.from('{"validJSON":true}'),
    }, MockComponentTestId);

    expect(codeEditor).toBeInTheDocument();
    expect(mockRenderWithProps).toHaveBeenCalledWith(expect.objectContaining({ mode: 'application/json' }));
  });

  it('should use HTML mode for text/plain Content-Type that contains a doctype declaration', async () => {
    const responseWebView = await getResponseViewerChild({
      contentType: 'text/plain',
      getBody: () => Buffer.from('<!DOCTYPE html><html></html>'),
    }, 'ResponseWebView');

    expect(responseWebView).toBeInTheDocument();
    expect(mockRenderWithProps).not.toHaveBeenCalledWith();
  });

  it('should decode ISO-8859-1 HTML content and render encoded in UTF-8', async () => {
    const TEST_STRING = 'Viel Glück';
    const responseWebView = await getResponseViewerChild({
      contentType: 'text/html; charset=iso-8859-1',
      getBody: () => Buffer.from(iconv.encode(TEST_STRING, 'iso-8859-1')),
    }, 'ResponseWebView');

    Object.assign(responseWebView, { loadURL: (url: string) => {
      expect(url).toEqual(`data:text/html; charset=utf-8,${encodeURIComponent(TEST_STRING)}`);
    } });

    responseWebView.dispatchEvent(new Event('dom-ready'));
  });
});
