import { type TabItem, Tabs } from '~/basic-components/tabs';
import { CodeEditor } from '~/ui/components/.client/codemirror/code-editor';
import { evalFormData } from '~/ui/components/eval/eval';
import { Pane, PaneHeader } from '~/ui/components/panes/pane';
import { RequestUrlBar } from '~/ui/components/request-url-bar';

export const EvalRequestPane = () => {
  const tabs: TabItem[] = [
    {
      id: 'data-source-config',
      title: 'Data Source Config',
      content: (
        <div className="mb-4 h-full overflow-hidden">
          <CodeEditor
            id="data-source-config-editor"
            defaultValue={evalFormData.data_source_config}
            onChange={() => {}}
            onBlur={() => {}}
            placeholder="enter data source config"
          />
        </div>
      ),
    },
    {
      id: 'testing-criteria',
      title: 'Testing Criteria',
      content: (
        <div className="mb-4 h-full overflow-hidden">
          <CodeEditor
            id="testing-criteria-editor"
            defaultValue={evalFormData.testing_criteria}
            onChange={() => {}}
            onBlur={() => {}}
            placeholder="enter testing criteria"
          />
        </div>
      ),
    },
    {
      id: 'test-data',
      title: 'Test Data',
      content: (
        <div className="mb-4 h-full overflow-hidden">
          <CodeEditor
            id="test-data-editor"
            defaultValue={evalFormData.test_data}
            onChange={() => {}}
            onBlur={() => {}}
            placeholder="enter test data"
          />
        </div>
      ),
    },
    {
      id: 'prompt',
      title: 'Prompt',
      content: (
        <div className="mb-4 h-full overflow-hidden">
          <CodeEditor
            id="prompt-editor"
            defaultValue={evalFormData.prompt}
            onChange={() => {}}
            onBlur={() => {}}
            placeholder="enter prompt"
          />
        </div>
      ),
    },
  ];
  return (
    <Pane type="request">
      <PaneHeader>
        <RequestUrlBar
          key={''}
          uniquenessKey={''}
          nunjucksPowerUserMode={true}
          onPaste={() => {}}
          handleAutocompleteUrls={() => Promise.resolve([])}
        />
      </PaneHeader>
      <Tabs items={tabs} />
    </Pane>
  );
};
