import React from 'react';

interface Props {
  body: Buffer;
}

export const ResponsePDFViewer = (props: Props) => {
  const url = (`data:application/pdf;base64,${props.body.toString('base64')}`);

  return (
    <webview
      data-testid="ResponsePDFView"
      src={url}
    />
  );
};
