import { render } from '@testing-library/react';
import React from 'react';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { globalBeforeEach } from '../../../../__jest__/before-each';
import { reduxStateForTest } from '../../../../__jest__/redux-state-for-test';
import { withReduxStore } from '../../../../__jest__/with-redux-store';
import { RootState } from '../../../redux/modules';
import { ResponseViewer, ResponseViewerProps } from '../response-viewer';

const defaultProps: ResponseViewerProps = {
  bytes: 2,
  contentType: 'application/json',
  disableHtmlPreviewJs: false,
  disablePreviewLinks: false,
  download: jest.fn,
  editorFontSize: 11,
  editorIndentSize: 2,
  editorKeyMap: 'default',
  editorLineWrapping: true,
  filter: '',
  filterHistory: [],
  getBody: () => Buffer.from('{}'),
  previewMode: 'friendly',
  responseId: 'res_<UUID>',
  url: 'http://mockbin.org/echo',
};

/**
 * Unfortunately, without this code, many of the tests in this file will all fail due to an implementation detail of CodeMirror.
 * see: https://github.com/jsdom/jsdom/issues/3002
 */
document.createRange = () => {
  const range = new Range();
  range.getBoundingClientRect = jest.fn();
  range.getClientRects = jest.fn(() => ({
    [Symbol.iterator]: jest.fn(),
    item: () => null,
    length: 0,
  }));
  return range;
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
    }, 'CodeEditor');

    expect(codeEditor).toBeInTheDocument();
    expect(codeEditor).toHaveAttribute('data-mode', 'text/plain');
  });

  it('should use JSON mode for a JSON Content-Type with valid JSON body', async () => {
    const codeEditor = await getResponseViewerChild({
      contentType: 'application/json',
      getBody: () => Buffer.from('{"validJSON":true}'),
    }, 'CodeEditor');

    expect(codeEditor).toBeInTheDocument();
    expect(codeEditor).toHaveAttribute('data-mode', 'application/json');
  });

  it('should use JSON mode for text/plain Content-Type when the body is valid JSON', async () => {
    const codeEditor = await getResponseViewerChild({
      contentType: 'text/plain',
      getBody: () => Buffer.from('{"validJSON":true}'),
    }, 'CodeEditor');
    expect(codeEditor).toBeInTheDocument();
    expect(codeEditor).toHaveAttribute('data-mode', 'application/json');
  });

  it('should use HTML mode for text/plain Content-Type that contains a doctype declaration', async () => {
    const responseWebView = await getResponseViewerChild({
      contentType: 'text/plain',
      getBody: () => Buffer.from('<!DOCTYPE html><html></html>'),
    }, 'ResponseWebView');
    expect(responseWebView).toBeInTheDocument();
  });
});
