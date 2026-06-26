export interface ResponseViewerProps {
  bytes: number;
  contentType: string;
  disableHtmlPreviewJs: boolean;
  disablePreviewLinks: boolean;
  download: (...args: any[]) => any;
  editorFontSize: number;
  filter: string;
  filterHistory: string[];
  bodyBuffer?: Uint8Array;
  getBody?: (...args: any[]) => Promise<Uint8Array | string>;
  previewMode: string;
  responseId: string;
  url: string;
  updateFilter?: (filter: string) => void;
  error?: string | null;
}
