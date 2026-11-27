import type { ExamplePatch, ExampleResponse, Request } from 'insomnia-data';
import { createContext, useContext } from 'react';

export interface ExampleEditorContextValue {
  // The open document, flattened to what its panes edit, and write-backs bound to
  // it.
  exampleId: string;
  description: string;
  // The snapshot in the shape the shared HTTP editors read.
  request: Request;
  // The canned response.
  response: ExampleResponse;
  patchExample: (patch: ExamplePatch) => void;
  patchRequest: (patch: Partial<Request>) => void;
  patchResponse: (patch: Partial<ExampleResponse>) => void;
}

/**
 * What the example editor's panes and their editors read and write. Keeping it in
 * one place means no editor receives its document through props, so an editor can
 * be pointed at another document type by swapping the provider. When absent, every
 * shared editor keeps its default behavior of reading the request route loader
 * data and patching the parent request.
 */
export const ExampleEditorContext = createContext<ExampleEditorContextValue | null>(null);

export const useExampleEditorContext = () => useContext(ExampleEditorContext);
