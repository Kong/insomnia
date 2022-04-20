import { CodeEditorProps } from './code-editor';

export const shouldIndentWithTabs = ({ mode, indentWithTabs }: Pick<CodeEditorProps, 'mode' | 'indentWithTabs'>) => {
  // YAML is not valid when indented with Tabs
  const isYaml = mode?.includes('yaml') || false;

  // OpenAPI is not valid when indented with Tabs
  // TODO: OpenAPI in yaml is not valid with tabs, but in JSON is. Currently we do not differentiate and disable tabs regardless. INS-1390
  const isOpenAPI = mode === 'openapi';

  const actuallyIndentWithTabs = indentWithTabs && !isYaml && !isOpenAPI;

  return actuallyIndentWithTabs;
};
