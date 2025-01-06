import type { LintOptions, ShowHintOptions, TextMarker } from 'codemirror';
import type { GraphQLHintOptions } from 'codemirror-graphql/hint';
import type { GraphQLInfoOptions } from 'codemirror-graphql/info';
import type { ModifiedGraphQLJumpOptions } from 'codemirror-graphql/jump';
import type { OpenDialogOptions } from 'electron';
import { readFileSync } from 'fs';
import { buildClientSchema, type DefinitionNode, type DocumentNode, getIntrospectionQuery, GraphQLNonNull, GraphQLSchema, Kind, type NonNullTypeNode, type OperationDefinitionNode, OperationTypeNode, parse, typeFromAST } from 'graphql';
import type { Maybe } from 'graphql-language-service';
import React, { type FC, useCallback, useEffect, useRef, useState } from 'react';
import { Button, Group, Heading, Toolbar, Tooltip, TooltipTrigger } from 'react-aria-components';
import ReactDOM from 'react-dom';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useLocalStorage } from 'react-use';

import { CONTENT_TYPE_JSON } from '../../../../common/constants';
import { database as db } from '../../../../common/database';
import { markdownToHTML } from '../../../../common/markdown-to-html';
import type { ResponsePatch } from '../../../../main/network/libcurl-promise';
import * as models from '../../../../models';
import type { Request } from '../../../../models/request';
import { fetchRequestData, responseTransform, sendCurlAndWriteTimeline, tryToInterpolateRequest, tryToTransformRequestWithPlugins } from '../../../../network/network';
import { invariant } from '../../../../utils/invariant';
import { jsonPrettify } from '../../../../utils/prettify/json';
import { useRootLoaderData } from '../../../routes/root';
import { Dropdown, DropdownItem, DropdownSection, ItemContent } from '../../base/dropdown';
import { CodeEditor, type CodeEditorHandle } from '../../codemirror/code-editor';
import { GraphQLExplorer } from '../../graph-ql-explorer/graph-ql-explorer';
import type { ActiveReference } from '../../graph-ql-explorer/graph-ql-types';
import { HelpTooltip } from '../../help-tooltip';
import { Icon } from '../../icon';
import { useDocBodyKeyboardShortcuts } from '../../keydown-binder';
import { TimeFromNow } from '../../time-from-now';

// Type guard to ensure loc is non-nullable
const hasLocation = (def: OperationDefinitionNode): def is OperationDefinitionNode & { loc: NonNullable<OperationDefinitionNode['loc']> } => {
  return def.loc !== null && def.loc !== undefined;
};
/** note that `null` is a valid operation name.  For example, `null` is the operation name of an anonymous `query` operation. */
const matchesOperation = (operationName: string | null | undefined) => ({ name }: OperationDefinitionNode) => {
  // For matching an anonymous function, `operationName` will be `null` and `operation.name` will be `undefined`
  if (!operationName && !name) {
    return true;
  }
  return name?.value === operationName;
};

function getGraphQLContent(body: GraphQLBody, query?: string, operationName?: string, variables?: string): string {
  // the body object is one dimensional, so we don't need to worry about shallow copying.
  const { query: originalQuery, ...optionalProps } = body;
  const content: GraphQLBody = { query: originalQuery };

  if (optionalProps.operationName) {
    content.operationName = optionalProps.operationName;
  }

  if (optionalProps.variables) {
    content.variables = optionalProps.variables;
  }

  if (isString(query)) {
    content.query = query;
  }

  // The below items are optional; should be set to undefined if present and empty
  if (isString(operationName)) {
    content.operationName = operationName.length ? operationName : undefined;
  }

  if (isString(variables)) {
    content.variables = variables.length ? variables : undefined;
  }

  // Set empty content after user has deleted the query and variables - INS-132
  if (!content.query && !content.variables) {
    return '';
  }

  return JSON.stringify(content);
}

const isString = (value?: string): value is string => typeof value === 'string' || (value as unknown) instanceof String;
const isOperationDefinition = (def: DefinitionNode): def is OperationDefinitionNode => def.kind === Kind.OPERATION_DEFINITION;

const fetchGraphQLSchemaForRequest = async ({
  requestId,
  url,
  inputValueDeprecation = false,
}: {
  requestId: string;
  environmentId: string;
  url: string;
    inputValueDeprecation: boolean;
}) => {
  if (!url) {
    return;
  }

  const req = await models.request.getById(requestId);

  if (!req) {
    return;
  }

  try {
    const bodyJson = JSON.stringify({
      query: getIntrospectionQuery({ inputValueDeprecation }),
      operationName: 'IntrospectionQuery',
    });

    const introspectionRequest = await db.upsert(
      Object.assign({}, req, {
        _id: req._id + '.graphql',
        settingMaxTimelineDataSize: 5000,
        parentId: req._id,
        isPrivate: true,
        // So it doesn't get synced or exported
        body: {
          mimeType: CONTENT_TYPE_JSON,
          text: bodyJson,
        },
      }),
    );

    const { request,
      environment,
      settings,
      clientCertificates,
      caCert,
      activeEnvironmentId,
      timelinePath,
      responseId,
    } = await fetchRequestData(introspectionRequest._id);

    const renderResult = await tryToInterpolateRequest({ request, environment: environment._id, purpose: 'send' });
    const renderedRequest = await tryToTransformRequestWithPlugins(renderResult);
    const res = await sendCurlAndWriteTimeline(
      renderedRequest,
      clientCertificates,
      caCert,
      settings,
      timelinePath,
      responseId,
    );
    const response = await responseTransform(res, activeEnvironmentId, renderedRequest, renderResult.context);
    const statusCode = response.statusCode || 0;
    if (!response) {
      return {
        schemaFetchError: {
          message: 'No response body received when fetching schema',
        },
      };
    }
    if (statusCode < 200 || statusCode >= 300) {
      const renderedURL = response.url || request.url;
      return {
        schemaFetchError: {
          message: `Got status ${statusCode} fetching schema from "${renderedURL}"`,
        },
      };
    }
    const bodyBuffer = models.response.getBodyBuffer(response);
    if (bodyBuffer) {
      const { data, errors } = JSON.parse(bodyBuffer.toString());
      if (errors?.length) {
        return { schemaFetchError: errors[0] };
      }
      return { schema: buildClientSchema(data) };
    }
    return {
      schemaFetchError: {
        message: 'Something went wrong, no data was received from introspection query',
      },
    };
  } catch (err) {
    console.error('[graphql] Failed to fetch schema', err);
    return { schemaFetchError: { message: err.message } };
  }
};

interface GraphQLBody {
  query: string;
  variables?: string;
  operationName?: string | null;
}

interface Props {
  onChange: (value: string) => void;
  request: Request;
  environmentId: string;
  className?: string;
  uniquenessKey?: string;
  workspaceId: string;
}

interface State {
  body: GraphQLBody;
  operations: string[];
  variablesSyntaxError: string;
  explorerVisible: boolean;
  activeReference: null | ActiveReference;
  documentAST: null | DocumentNode;
  operationType?: OperationTypeNode;
}

export const GraphQLEditor: FC<Props> = ({
  request,
  environmentId,
  onChange,
  className,
  uniquenessKey,
  workspaceId,
}) => {
  let requestBody: GraphQLBody;
  try {
    requestBody = JSON.parse(request.body.text || '');
  } catch (err) {
    requestBody = { query: '' };
  }

  requestBody.variables = requestBody.variables || '';

  let documentAST;
  try {
    documentAST = parse(requestBody.query || '');
  } catch (error) {
    documentAST = null;
  }
  const operations = documentAST?.definitions.filter(isOperationDefinition)?.map(def => def.name?.value || '').filter(Boolean) || [];
  const operationName = requestBody.operationName || operations[0] || '';
  const disabledOperationMarkers = useRef<TextMarker[]>([]);
  const [state, setState] = useState<State>({
    body: {
      query: requestBody.query || '',
      variables: requestBody.variables,
      operationName,
    },
    operations,
    variablesSyntaxError: '',
    activeReference: null,
    explorerVisible: false,
    documentAST,
  });

  const [automaticFetch, setAutoFetch] = useLocalStorage<boolean>(
    'graphql.automaticFetch',
    true
  );
  const [includeInputValueDeprecation, setIncludeInputValueDeprecation] = useState(false);
  const [schema, setSchema] = useState<GraphQLSchema | null>(null);
  const [schemaFetchError, setSchemaFetchError] = useState<{
    message: string;
    response?: ResponsePatch | null;
  } | undefined>();
  const [schemaIsFetching, setSchemaIsFetching] = useState<boolean | null>(null);
  const [schemaLastFetchTime, setSchemaLastFetchTime] = useState<number>(0);
  const editorRef = useRef<CodeEditorHandle>(null);

  useEffect(() => {
    if (!automaticFetch) {
      return;
    }
    let isMounted = true;
    const init = async () => {
      setSchemaIsFetching(true);
      const newState = await fetchGraphQLSchemaForRequest({
        requestId: request._id,
        environmentId,
        url: request.url,
        inputValueDeprecation: includeInputValueDeprecation,
      });
      isMounted && setSchemaFetchError(newState?.schemaFetchError);
      isMounted && newState?.schema && setSchema(newState.schema);
      isMounted && newState?.schema && setSchemaLastFetchTime(Date.now());
      isMounted && setSchemaIsFetching(false);
    };
    init();
    return () => {
      isMounted = false;
    };
  }, [automaticFetch, environmentId, includeInputValueDeprecation, request._id, request.url, workspaceId]);
  const {
    settings,
  } = useRootLoaderData();
  const { editorIndentWithTabs, editorIndentSize } = settings;
  const beautifyRequestBody = async () => {
    const { body } = state;
    const prettyQuery = await (await import('prettier')).format(body.query, {
      parser: 'graphql',
      useTabs: editorIndentWithTabs,
      tabWidth: editorIndentSize,
    });
    changeQuery(prettyQuery);
    // Update editor contents
    if (editorRef.current) {
      editorRef.current?.setValue(prettyQuery);
    }
  };

  useDocBodyKeyboardShortcuts({
    beautifyRequestBody,
  });
  const changeOperationName = useCallback((operationName: string) => {
    const content = getGraphQLContent(state.body, undefined, operationName);
    onChange(content);
    setState(prevState => ({ ...prevState, body: { ...prevState.body, operationName } }));
  }, [onChange, state.body]);

  const changeVariables = (variablesInput: string) => {
    try {
      const content = getGraphQLContent(state.body, undefined, operationName, variablesInput);
      onChange(content);

      setState(state => ({
        ...state,
        // If variables are empty, remove them from the body
        body: { ...state.body, variables: variablesInput.length ? variablesInput : undefined },
        variablesSyntaxError: '',
      }));
    } catch (err) {
      setState(state => ({ ...state, variablesSyntaxError: err.message }));
    }
  };
  const changeQuery = (query: string) => {
    try {
      const documentAST = parse(query);
      const operations = documentAST.definitions.filter(isOperationDefinition)?.map(def => def.name?.value || '').filter(Boolean) || [];

      // default to first operation when none selected
      let operationName = operations[0] || '';
      if (operations.length && state.body.operationName) {
        const operationsChanged = state.operations.join() !== operations.join();
        const operationNameWasChanged = !operations.includes(state.body.operationName);
        if (operationsChanged && operationNameWasChanged) {
          // preserve selection during name change or fallback to first operation
          const oldPosition = state.operations.indexOf(state.body.operationName);
          operationName = operations[oldPosition] || operations[0] || '';
        }
      }

      if (!operationName) {
        delete state.body.operationName;
      }

      const content = getGraphQLContent(state.body, query, operationName);
      onChange(content);

      setState(state => ({
        ...state,
        documentAST,
        body: { ...state.body, query, operationName },
        operations,
      }));
    } catch (error) {
      console.warn('failed to parse', error);
      if (isString(query) && query.trim() === '') {
        // update request body when query is empty
        onChange(getGraphQLContent(state.body, query, ''));
      };
      setState(state => ({
        ...state,
        documentAST: null,
        body: { ...state.body, query, operationName: query ? state.body.operationName : 'Operations' },
        operations: query ? state.operations : [],
      }));
    }
  };

  const renderSchemaFetchMessage = () => {
    if (!request.url) {
      return '';
    }
    if (schemaIsFetching) {
      return 'Fetching schema...';
    }
    if (schemaLastFetchTime > 0) {
      return (
        <span>
          Schema fetched <TimeFromNow timestamp={schemaLastFetchTime} />
        </span>
      );
    }
    return <span>Schema not fetched yet</span>;
  };

  const loadAndSetLocalSchema = async () => {
    const options: OpenDialogOptions = {
      title: 'Import GraphQL introspection schema',
      buttonLabel: 'Import',
      properties: ['openFile'],
      filters: [
        // @ts-expect-error https://github.com/electron/electron/pull/29322
        {
          extensions: ['', 'json'],
        },
      ],
    };
    const { canceled, filePaths } = await window.dialog.showOpenDialog(options);
    if (canceled) {
      return;
    }
    try {
      const filePath = filePaths[0]; // showOpenDialog is single select
      const file = readFileSync(filePath);
      const content = JSON.parse(file.toString());
      if (!content.data) {
        throw new Error('JSON file should have a data field with the introspection results');
      }
      setSchema(buildClientSchema(content.data));
      setSchemaLastFetchTime(Date.now());
      setSchemaFetchError(undefined);
      setSchemaIsFetching(false);
    } catch (err) {
      console.log('[graphql] ERROR: Failed to fetch schema', err);
      setSchemaFetchError({
        message: `Failed to fetch schema: ${err.message}`,
        response: null,
      });
      setSchemaIsFetching(false);
    }
  };

  const {
    variablesSyntaxError,
    activeReference,
    explorerVisible,
  } = state;

  const variableTypes: Record<string, GraphQLNonNull<any>> = {};
  if (schema) {
    const operationDefinitions = state.documentAST?.definitions.filter(isOperationDefinition);
    operationDefinitions?.forEach(({ variableDefinitions }) => {
      variableDefinitions?.forEach(({ variable, type }) => {
        const inputType = typeFromAST(schema, type as NonNullTypeNode);
        if (inputType) {
          variableTypes[variable.name.value] = inputType;
        }
      }
      );
    });
  }

  // Create portal for GraphQL Explorer
  let graphQLExplorerPortal: React.ReactPortal | null = null;
  const explorerContainer = document.querySelector('#graphql-explorer-container');
  invariant(explorerContainer, 'Failed to find #graphql-explorer-container');
  if (explorerContainer) {
    graphQLExplorerPortal = ReactDOM.createPortal(
      <GraphQLExplorer
        schema={schema}
        key={schemaLastFetchTime}
        visible={explorerVisible}
        reference={activeReference}
        handleClose={() => setState(state => ({ ...state, explorerVisible: false }))}
      />,
      explorerContainer
    );
  }

  let graphqlOptions: {
    hintOptions: GraphQLHintOptions & ShowHintOptions;
    infoOptions: GraphQLInfoOptions;
    jumpOptions: ModifiedGraphQLJumpOptions;
    lintOptions: LintOptions;
  } | undefined;
  const handleClickReference = (reference: Maybe<ActiveReference>, event: MouseEvent) => {
    event.preventDefault();
    if (reference) {
      setState(state => ({
        ...state,
        explorerVisible: true,
        activeReference: reference,
      }));
    }
  };
  if (schema) {
    graphqlOptions = {
      hintOptions: {
        completeSingle: false,
        schema,
      },
      infoOptions: {
        schema,
        renderDescription: text => `<div class="markdown-preview__content">${markdownToHTML(text)}</div>`,
        onClick: handleClickReference,
      },
      jumpOptions: {
        schema,
        onClick: handleClickReference,
      },
      lintOptions: {
        schema,
      },
    };
  }
  const canShowSchema = schema && !schemaIsFetching && !schemaFetchError && schemaLastFetchTime > 0;

  const highlightOperation = useCallback((operationName?: string | null) => {

    if (!state.documentAST || !editorRef.current) {
      return;
    }

    // Remove current query highlighting
    for (const textMarker of disabledOperationMarkers?.current) {
      textMarker.clear();
    }

    disabledOperationMarkers.current = state.documentAST?.definitions
      .filter(isOperationDefinition)
      .filter(name => {
        const fn = matchesOperation(operationName);
        return !fn(name);
      })
      .filter(hasLocation)
      .map(({ loc: { startToken, endToken } }) => {
        const from = {
          line: startToken.line - 1,
          ch: startToken.column - 1,
        };
        const to = {
          line: endToken.line,
          ch: endToken.column - 1,
        };

        return editorRef.current?.getDoc()?.markText(from, to, {
          className: 'opacity-70',
        }) as TextMarker;
      });
  }, [state.documentAST]);

  const getCurrentOperation = useCallback(() => {

    if (!editorRef.current || !editorRef.current.hasFocus()) {
      return state.body.operationName || null;
    }

    const operationDefinitions = state.documentAST?.definitions.filter(isOperationDefinition) || [];

    const cursor = editorRef.current.getCursor();

    const cursorIndex = editorRef.current.indexFromPos(cursor);

    let operationName: string | null = null;
    const allOperationNames: (string | null)[] = [];

    // Loop through all operationDefinitions to see if one contains the cursor.
    for (let i = 0; i < operationDefinitions.length; i++) {
      const operation = operationDefinitions[i];

      if (!operation.name) {
        continue;
      }

      allOperationNames.push(operation.name.value);
      const { start = 0, end = 0 } = operation.loc || {};

      if (start <= cursorIndex && end >= cursorIndex) {
        operationName = operation.name.value;
      }
    }

    if (!operationName && operations.length > 0) {
      operationName = state.body.operationName || null;
    }

    if (!allOperationNames.includes(operationName)) {
      return null;
    }

    return operationName;
  }, [operations.length, state.body.operationName, state.documentAST?.definitions]);

  const handleQueryUserActivity = useCallback(() => {
    const newOperationName = getCurrentOperation();

    if (newOperationName !== state.body.operationName) {
      changeOperationName(newOperationName || '');
    }
  }, [changeOperationName, getCurrentOperation, state.body.operationName]);

  useEffect(() => {
    highlightOperation(state.body.operationName);
  }, [highlightOperation, state.body.operationName]);

  return (
    <>
      <Toolbar aria-label='GraphQL toolbar' className="w-full flex-shrink-0 h-[--line-height-sm] border-b border-solid border-[--hl-md] flex items-center px-2">
        <Dropdown
          aria-label='Operations Dropdown'
          isDisabled={!state.operations.length}
          triggerButton={
            <Button className="btn btn--compact text-[--hl] p-[--padding-xs] bg-transparent h-full">
              {state.body.operationName || 'Operations'}
            </Button>
          }
        >
          {state.operations.map(operationName => (
            <DropdownItem
              key={operationName}
              aria-label={`Operation ${operationName}`}
            >
              <ItemContent
                label={operationName}
                onClick={() => changeOperationName(operationName)}
              />
            </DropdownItem>
          ))}
        </Dropdown>
        <Dropdown
          aria-label='Schema Dropdown'
          triggerButton={
            <Button
              className="btn btn--compact text-[--hl] p-[--padding-xs] bg-transparent h-full"
            >
              <span>schema <i className="fa fa-wrench" /></span>
            </Button>
          }
        >
          <DropdownItem aria-label='Show Documentation'>
            <ItemContent
              isDisabled={!canShowSchema}
              icon="file-code-o"
              label="Show Documentation"
              onClick={() => {
                setState(state => ({ ...state, explorerVisible: true }));
              }}
            />
          </DropdownItem>
          <DropdownSection
            aria-label='Remote GraphQL Schema Section'
            title="Remote GraphQL Schema"
          >
            <DropdownItem aria-label='Refresh Schema'>
              <ItemContent
                stayOpenAfterClick
                icon={`refresh ${schemaIsFetching ? 'fa-spin' : ''}`}
                label="Refresh Schema"
                onClick={async () => {
                  setSchemaIsFetching(true);
                  const newState = await fetchGraphQLSchemaForRequest({
                    requestId: request._id,
                    environmentId,
                    url: request.url,
                    inputValueDeprecation: includeInputValueDeprecation,
                  });
                  setSchemaFetchError(newState?.schemaFetchError);
                  newState?.schema && setSchema(newState.schema);
                  newState?.schema && setSchemaLastFetchTime(Date.now());
                  setSchemaIsFetching(false);
                }}
              />
            </DropdownItem>
            <DropdownItem aria-label='Automatic Fetch'>
              <ItemContent
                stayOpenAfterClick
                icon={`toggle-${automaticFetch ? 'on' : 'off'}`}
                label={
                  <>
                    <span style={{ marginRight: '10px' }}>Automatic Fetch</span>
                    <HelpTooltip>Automatically fetch schema when request URL is modified</HelpTooltip>
                  </>
                }
                onClick={() => {
                  setAutoFetch(!automaticFetch);
                }}
              />
            </DropdownItem>
            <DropdownItem aria-label='Fetch deprecation values'>
              <ItemContent
                stayOpenAfterClick
                icon={`toggle-${includeInputValueDeprecation ? 'on' : 'off'}`}
                label={
                  <>
                    <span style={{ marginRight: '10px' }}>Include input value deprecation</span>
                    <HelpTooltip>When fetching the schema include input value deprecation reasons</HelpTooltip>
                  </>
                }
                onClick={() => {
                  setIncludeInputValueDeprecation(!includeInputValueDeprecation);
                }}
              />
            </DropdownItem>
          </DropdownSection>

          <DropdownSection
            aria-label="Local GraphQL Schema Section"
            title="Local GraphQL Schema"
          >
            <DropdownItem aria-label='Load schema from JSON'>
              <ItemContent
                icon="file-code-o"
                label={
                  <>
                    <span style={{ marginRight: '10px' }}>Load schema from JSON</span>
                    <HelpTooltip>
                      Run <i>apollo-codegen introspect-schema schema.graphql --output schema.json</i> to
                      convert GraphQL DSL to JSON.
                    </HelpTooltip>
                  </>
                }
                onClick={() => {
                  loadAndSetLocalSchema();
                }}
              />
            </DropdownItem>
          </DropdownSection>
        </Dropdown>
      </Toolbar>
      <PanelGroup direction={'vertical'} autoSaveId='graphql-variables'>
        <Panel id="GraphQL Editor" minSize={20} defaultSize={60}>
          <CodeEditor
            id="graphql-editor"
            ref={editorRef}
            dynamicHeight
            showPrettifyButton
            uniquenessKey={uniquenessKey ? uniquenessKey + '::query' : undefined}
            defaultValue={requestBody.query || ''}
            className={className}
            onChange={changeQuery}
            onCursorActivity={handleQueryUserActivity}
            onFocus={handleQueryUserActivity}
            mode="graphql"
            placeholder=""
            hintOptions={graphqlOptions?.hintOptions}
            infoOptions={graphqlOptions?.infoOptions}
            jumpOptions={graphqlOptions?.jumpOptions}
            lintOptions={graphqlOptions?.lintOptions}
          />
        </Panel>
        <PanelResizeHandle className={'w-full h-[1px] bg-[--hl-md]'} />
        <Panel id="GraphQL Variables editor" className='flex flex-col' minSize={20}>
          <Heading className="w-full px-2 text-[--hl] select-none flex-shrink-0 h-[--line-height-sm] border-b border-solid border-[--hl-md] flex items-center">
            Query Variables
            <HelpTooltip className="space-left">
              Variables to use in GraphQL query <br />
              (JSON format)
            </HelpTooltip>
            {variablesSyntaxError && (
              <span className="text-danger italic pull-right">{variablesSyntaxError}</span>
            )}
          </Heading>
          <div className='flex-1 overflow-hidden'>
            <CodeEditor
              id="graphql-editor-variables"
              dynamicHeight
              enableNunjucks
              uniquenessKey={uniquenessKey ? uniquenessKey + '::variables' : undefined}
              showPrettifyButton={false}
              defaultValue={jsonPrettify(requestBody.variables)}
              className={className}
              getAutocompleteConstants={() => Object.keys(variableTypes)}
              lintOptions={{
                variableToType: variableTypes,
              }}
              noLint={!variableTypes}
              onChange={changeVariables}
              mode="graphql-variables"
              placeholder=""
            />
          </div>
        </Panel>
      </PanelGroup>
      <Toolbar className="w-full overflow-y-auto  select-none flex-shrink-0 h-[--line-height-sm] border-t border-solid border-[--hl-md] flex items-center">
        <Button className="px-4 py-1 h-full flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-font] text-sm hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all" onPress={beautifyRequestBody}>
          Prettify GraphQL
        </Button>
        <span className='flex-1' />
        {!schemaFetchError && <div className="flex flex-shrink-0 items-center gap-2 text-sm px-2">
          <Icon icon="info-circle" />
          {renderSchemaFetchMessage()}
        </div>}
        {schemaFetchError && (
          <Group className="flex items-center h-full">
            <TooltipTrigger>
              <Button className="px-4 py-1 h-full flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-font] text-sm hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all">
                <Icon icon="exclamation-triangle" className='text-[--color-warning]' />
                <span>Error fetching Schema</span>
              </Button>
              <Tooltip
                offset={8}
                className="border select-none text-sm max-w-xs border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
              >
                {schemaFetchError.message}
              </Tooltip>
            </TooltipTrigger>
          </Group>
        )}
      </Toolbar>
      {graphQLExplorerPortal}
    </>
  );
};
