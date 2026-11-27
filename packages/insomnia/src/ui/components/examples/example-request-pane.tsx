import type { RequestParameter, Settings } from 'insomnia-data';
import { models } from 'insomnia-data';
import { deconstructQueryStringToParams } from 'insomnia-data/common';
import { Fragment } from 'react';
import { Button, Tab, TabList, TabPanel, Tabs } from 'react-aria-components';

import { extractQueryStringFromUrl } from '~/common/utils/url/querystring';
import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { OneLineEditor } from '~/ui/components/.client/codemirror/one-line-editor';
import { MethodSelector } from '~/ui/components/dropdowns/method-selector';
import { BodyEditor } from '~/ui/components/editors/body/body-editor';
import { RequestHeadersEditor } from '~/ui/components/editors/request-headers-editor';
import { RequestParametersEditor } from '~/ui/components/editors/request-parameters-editor';
import { MarkdownEditor } from '~/ui/components/markdown-editor';
import { Pane, PaneHeader } from '~/ui/components/panes/pane';
import { RenderedQueryString } from '~/ui/components/rendered-query-string';
import { useExampleEditorContext } from '~/ui/context/example-editor-context';
import { useDebouncedCallback } from '~/ui/hooks/use-debounced-callback';
import { useSettingsPatcher } from '~/ui/hooks/use-request';
import { useRootLoaderData } from '~/ui/hooks/use-root-loader-data';

const { getCombinedPathParametersFromUrl } = models.request;

export const ExampleRequestPane = () => {
  const { exampleId, description, request, patchExample, patchRequest } = useExampleEditorContext()!;
  const { settings } = useRootLoaderData()! as { settings: Settings };
  const environmentId = useWorkspaceLoaderData()!.activeEnvironment?._id ?? '';
  const patchSettings = useSettingsPatcher();

  const pathParameters = getCombinedPathParametersFromUrl(request.url, request.pathParameters || []);
  const parametersCount = pathParameters.length + request.parameters.filter(p => !p.disabled).length;
  const headersCount = request.headers.filter(h => !h.disabled).length;
  const urlHasQueryParameters = request.url.includes('?');
  const isBodyEmpty = Boolean(typeof request.body.mimeType !== 'string' && !request.body.text);

  // The description is free text; persist it once the typing pauses instead of
  // rewriting the whole example document on every keystroke.
  const writeDescription = useDebouncedCallback((description: string) => patchExample({ description }));

  const handleImportQueryFromUrl = () => {
    let query;

    try {
      query = extractQueryStringFromUrl(request.url);
    } catch {
      console.warn('Failed to parse url to import querystring');
      return;
    }

    // Remove the search string (?foo=bar&...) from the Url
    const url = request.url.replace(`?${query}`, '');
    const parameters = [...request.parameters, ...deconstructQueryStringToParams(query)];

    // Only update if url changed
    if (url !== request.url) {
      patchRequest({ url, parameters });
    }
  };

  const onPathParameterChange = (pathParameters: RequestParameter[]) => {
    patchRequest({ pathParameters });
  };

  return (
    <Pane type="request">
      <PaneHeader>
        <div className="flex w-full items-stretch justify-between self-stretch">
          <div className="flex items-stretch p-1">
            <MethodSelector
              className="self-stretch"
              onChange={method => patchRequest({ method })}
              method={request.method}
              placement="bottom start"
            />
          </div>
          <div className="flex flex-1 items-center p-1">
            <OneLineEditor
              id="example-url-bar"
              historyKey={`example-url-bar::${exampleId}`}
              type="text"
              placeholder="https://api.myproduct.com/v1/users"
              defaultValue={request.url}
              onChange={url => patchRequest({ url })}
            />
          </div>
        </div>
      </PaneHeader>
      <Tabs aria-label="Example request pane tabs" className="flex h-full w-full flex-1 flex-col">
        <TabList
          className="scrollbar-thin flex h-(--line-height-sm) w-full shrink-0 items-center overflow-x-auto border-b border-solid border-b-(--hl-md) bg-(--color-bg)"
          aria-label="Example request pane tabs"
        >
          <Tab
            className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
            id="params"
          >
            <span>Params</span>
            {parametersCount > 0 && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-lg border border-solid border-(--hl) p-1 text-xs">
                {parametersCount}
              </span>
            )}
          </Tab>
          <Tab
            className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
            id="content-type"
          >
            <span>Body</span>
            {!isBodyEmpty && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-lg border border-solid border-(--hl) p-1 text-xs">
                <span className="h-2 w-2 rounded-full bg-green-500" />
              </span>
            )}
          </Tab>
          <Tab
            className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
            id="headers"
          >
            <span>Headers</span>
            {headersCount > 0 && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-lg border border-solid border-(--hl) p-1 text-xs">
                {headersCount}
              </span>
            )}
          </Tab>
          <Tab
            className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
            id="docs"
          >
            <span>Docs</span>
            {description && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-lg border border-solid border-(--hl) p-1 text-xs">
                <span className="h-2 w-2 rounded-full bg-green-500" />
              </span>
            )}
          </Tab>
        </TabList>
        <TabPanel className="flex h-full w-full flex-1 flex-col overflow-y-auto" id="params">
          <div className="shrink-0 p-4">
            <div className="flex max-h-32 min-h-[2em] flex-col overflow-y-auto border border-solid border-(--hl-sm) bg-(--hl-xs) px-2 py-1 text-xs">
              <label className="label--small no-pad-top">Url Preview</label>
              <RenderedQueryString request={request} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <RequestParametersEditor bulk={settings.useBulkParametersEditor} />
            {pathParameters.length > 0 && (
              <div className="w-full overflow-y-auto p-4">
                <div className="grid w-full shrink-0 grid-cols-2 gap-x-[20.8px] overflow-hidden rounded-xs">
                  {pathParameters.map(pathParameter => (
                    <Fragment key={pathParameter.name}>
                      <span className="flex items-center justify-end truncate rounded-xs border-b border-solid border-(--hl-md) p-2 select-none">
                        {pathParameter.name}
                      </span>
                      <div className="flex h-full items-center border-b border-solid border-(--hl-md) px-2">
                        <OneLineEditor
                          id={'key-value-editor__name' + pathParameter.name}
                          historyKey={`example-path-param::${exampleId}::${pathParameter.name}`}
                          placeholder="Parameter value"
                          defaultValue={pathParameter.value || ''}
                          onChange={value =>
                            onPathParameterChange(
                              pathParameters.map(p => (p.name === pathParameter.name ? { ...p, value } : p)),
                            )
                          }
                        />
                      </div>
                    </Fragment>
                  ))}
                </div>
              </div>
            )}
            {urlHasQueryParameters && (
              <div className="p-4">
                <Button
                  isDisabled={!urlHasQueryParameters}
                  onPress={handleImportQueryFromUrl}
                  className="flex h-full min-w-[14ch] shrink-0 items-center justify-start gap-2 rounded-xs px-2 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-colors hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:ring-(--hl-md) focus:ring-inset"
                >
                  Import from URL
                </Button>
              </div>
            )}
          </div>
        </TabPanel>
        <TabPanel className="flex w-full flex-1 flex-col" id="content-type">
          <BodyEditor request={request} environmentId={environmentId} />
        </TabPanel>
        <TabPanel className="relative flex w-full flex-1 flex-col overflow-hidden" id="headers">
          <div className="flex-1 shrink-0 overflow-y-auto">
            <RequestHeadersEditor
              bulk={settings.useBulkHeaderEditor}
              headers={request.headers}
              requestType="Request"
              disableUserAgentHeader={request.disableUserAgentHeader}
            />
          </div>
          <div className="box-border flex h-(--line-height-sm) flex-row border-t border-solid border-(--hl-md) text-(--font-size-sm)">
            <Button
              className="flex h-full items-center justify-center gap-2 px-4 py-1 text-xs text-(--color-font) ring-1 ring-transparent transition-colors hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
              onPress={() => patchSettings({ useBulkHeaderEditor: !settings.useBulkHeaderEditor })}
            >
              {settings.useBulkHeaderEditor ? 'Regular Edit' : 'Bulk Edit'}
            </Button>
          </div>
        </TabPanel>
        <TabPanel className="w-full flex-1 overflow-y-auto" id="docs">
          <MarkdownEditor
            historyKey={`example-description::${exampleId}`}
            placeholder="Write a description"
            defaultValue={description}
            onChange={writeDescription}
          />
        </TabPanel>
      </Tabs>
    </Pane>
  );
};
