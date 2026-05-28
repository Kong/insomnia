import { useEffect, useState } from 'react';

interface Props {
  body: Buffer;
}

export const ResponsePDFViewer = ({ body }: Props) => {
  const [url, setUrl] = useState<string>('');

  useEffect(() => {
    const blob = new Blob([body], { type: 'application/pdf' });
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [body]);

  if (!url) {
    return null;
  }

  return (
    <iframe
      data-testid="ResponsePDFView"
      src={url}
      title="PDF response preview"
      style={{ width: '100%', height: '100%', border: 0, backgroundColor: '#fff' }}
    />
  );
};
