import React, { type FC } from 'react';

interface Props {
  body: string;
  url: string;
  disableHtmlPreviewJs: boolean;
}

const escapeHtmlAttribute = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

export const getResponsePreviewHtml = (body: string, url: string) => body.replace('<head>', `<head><base href="${escapeHtmlAttribute(url)}">`);

export const getResponsePreviewSandbox = (disableHtmlPreviewJs: boolean) =>
  disableHtmlPreviewJs ? '' : 'allow-scripts';

export const ResponseWebView: FC<Props> = ({ body, disableHtmlPreviewJs, url }) => {
  return (
    <iframe
      className="h-full w-full border-0"
      data-testid="ResponseWebView"
      sandbox={getResponsePreviewSandbox(disableHtmlPreviewJs)}
      srcDoc={getResponsePreviewHtml(body, url)}
      title="HTML response preview"
    />
  );
};
