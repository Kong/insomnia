import { type TabItem, Tabs } from '~/basic-components/tabs';
import { CodeEditor } from '~/ui/components/.client/codemirror/code-editor';
import { evalFormData } from '~/ui/components/eval/eval';
import { Pane, PaneHeader } from '~/ui/components/panes/pane';
import { RequestUrlBar } from '~/ui/components/request-url-bar';

export const EvalRequestPane = ({ onSend }: any) => {
  const tabs: TabItem[] = [
    {
      id: 'data-source-config',
      title: 'Data Source Config',
      content: (
        <div className="mb-4 h-full overflow-hidden">
          <CodeEditor
            id="data-source-config-editor"
            defaultValue={evalFormData.data_source_config}
            onChange={value => {
              try {
                const parsedValue = JSON.parse(value);
                window.testai_TEST_DATA = parsedValue;
              } catch (e) {
                console.error('Invalid JSON in Data Source Config:', e);
              }
            }}
            onBlur={() => {}}
            placeholder="enter data source config"
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
            onChange={value => {
              try {
                const parsedValue = JSON.parse(value);
                window.testai_TEST_DATA = parsedValue;
              } catch (e) {
                console.error('Invalid JSON in Test Data:', e);
              }
            }}
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
            onChange={value => {
              try {
                const parsedValue = JSON.parse(value);
                window.testai_PROMPT = parsedValue;
              } catch (e) {
                console.error('Invalid JSON in Prompt:', e);
              }
            }}
            onBlur={() => {}}
            placeholder="enter prompt"
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
            onChange={value => {
              try {
                const parsedValue = JSON.parse(value);
                window.testai_TESTING_CRITERIA = parsedValue;
              } catch (e) {
                console.error('Invalid JSON in Testing Criteria:', e);
              }
            }}
            onBlur={() => {}}
            placeholder="enter testing criteria"
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
          onSend={onSend}
        />
      </PaneHeader>
      <Tabs items={tabs} />
    </Pane>
  );
};
