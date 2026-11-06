import type { Request } from 'insomnia-data';
import { createContext, useContext } from 'react';

export interface ExampleEditorContextValue {
  // The example doc id; editor components treat it as the "requestId" they write to
  exampleId: string;
  // Full Request-shaped doc synthesized from the example's request snapshot
  request: Request;
  // Write-back that patches the example's request snapshot instead of the parent request
  patchRequest: (exampleId: string, patch: Partial<Request>) => void;
}

/**
 * When an editor component (RequestParametersEditor, BodyEditor,
 * RequestHeadersEditor, ContentTypeDropdown) is rendered inside the Example
 * view, this context redirects its data source and write-back from the parent
 * Request route to the Example doc. When absent, every editor keeps its
 * default behavior of reading the request route loader data and patching the
 * parent request.
 */
export const ExampleEditorContext = createContext<ExampleEditorContextValue | null>(null);

export const useExampleEditorContext = () => useContext(ExampleEditorContext);
