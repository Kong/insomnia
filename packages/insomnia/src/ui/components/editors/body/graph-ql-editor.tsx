import classnames from 'classnames';
import { LintOptions, ShowHintOptions, TextMarker } from 'codemirror';
import { GraphQLInfoOptions } from 'codemirror-graphql/info';
import { ModifiedGraphQLJumpOptions } from 'codemirror-graphql/jump';
import { OpenDialogOptions } from 'electron';
import { readFileSync } from 'fs';
import { DefinitionNode, DocumentNode, GraphQLNonNull, GraphQLSchema, Kind, NonNullTypeNode, OperationDefinitionNode, parse, typeFromAST } from 'graphql';
import { buildClientSchema, getIntrospectionQuery } from 'graphql/utilities';
import { Maybe } from 'graphql-language-service';
import prettier from 'prettier';
import React, { FC, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useSelector } from 'react-redux';
import { useLocalStorage } from 'react-use';

import { CONTENT_TYPE_JSON } from '../../../../common/constants';
import { database as db } from '../../../../common/database';
import { markdownToHTML } from '../../../../common/markdown-to-html';
import { jsonParseOr } from '../../../../common/misc';
import type { ResponsePatch } from '../../../../main/network/libcurl-promise';
import * as models from '../../../../models';
import type { Request } from '../../../../models/request';
import * as network from '../../../../network/network';
import { invariant } from '../../../../utils/invariant';
import { jsonPrettify } from '../../../../utils/prettify/json';
import { selectSettings } from '../../../redux/selectors';
import { Dropdown } from '../../base/dropdown/dropdown';
import { DropdownButton } from '../../base/dropdown/dropdown-button';
import { DropdownDivider } from '../../base/dropdown/dropdown-divider';
import { DropdownItem } from '../../base/dropdown/dropdown-item';
import { CodeEditor, CodeEditorHandle } from '../../codemirror/code-editor';
import { GraphQLExplorer } from '../../graph-ql-explorer/graph-ql-explorer';
import { ActiveReference } from '../../graph-ql-explorer/graph-ql-types';
import { HelpTooltip } from '../../help-tooltip';
import { Toolbar } from '../../key-value-editor/key-value-editor';
import { useDocBodyKeyboardShortcuts } from '../../keydown-binder';
import { TimeFromNow } from '../../time-from-now';

const isOperationDefinition = (def: DefinitionNode): def is OperationDefinitionNode => def.kind === Kind.OPERATION_DEFINITION;

const fetchGraphQLSchemaForRequest = async ({
  requestId,
  environmentId,
  url,
}: {
  requestId: string;
  environmentId: string;
  url: string;
}) => {
  if (!url) {
    return;
  }

  const request = await models.request.getById(requestId);

  if (!request) {
    return;
  }

  try {

    const bodyJson = JSON.stringify({
      query: getIntrospectionQuery(),
      operationName: 'IntrospectionQuery',
    });
    const introspectionRequest = await db.upsert(
      Object.assign({}, request, {
        _id: request._id + '.graphql',
        settingMaxTimelineDataSize: 5000,
        parentId: request._id,
        isPrivate: true,
        // So it doesn't get synced or exported
        body: {
          mimeType: CONTENT_TYPE_JSON,
          text: bodyJson,
        },
      }),
    );
    const response = await network.send(introspectionRequest._id, environmentId);
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
      const { data } = JSON.parse(bodyBuffer.toString());
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
  operationName?: string;
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
  hideSchemaFetchErrors: boolean;
  variablesSyntaxError: string;
  explorerVisible: boolean;
  activeReference: null | ActiveReference;
  documentAST: null | DocumentNode;
  disabledOperationMarkers: (TextMarker | undefined)[];
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
  if (typeof requestBody.variables === 'string') {
    requestBody.variables = jsonParseOr(requestBody.variables, '');
  }
  let documentAST;
  try {
    documentAST = parse(requestBody.query || '');
  } catch (error) {
    documentAST = null;
  }
  const operations = documentAST?.definitions.filter(isOperationDefinition)?.map(def => def.name?.value || '') || [];
  const operationName = requestBody.operationName || operations[0] || '';
  const [state, setState] = useState<State>({
    body: {
      query: requestBody.query || '',
      variables: requestBody.variables,
      operationName,
    },
    operations,
    hideSchemaFetchErrors: false,
    variablesSyntaxError: '',
    activeReference: null,
    explorerVisible: false,
    documentAST,
    disabledOperationMarkers: [],
  });

  const [automaticFetch, setAutoFetch] = useLocalStorage<boolean>(
    'graphql.automaticFetch',
    true
  );
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
  }, [automaticFetch, environmentId, request._id, request.url, workspaceId]);

  const { editorIndentWithTabs, editorIndentSize } = useSelector(selectSettings);
  const beautifyRequestBody = () => {
    const { body } = state;
    const prettyQuery = prettier.format(body.query, {
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
  const changeOperationName = (operationName: string) => {
    onChange(JSON.stringify({ ...state.body, operationName }));
    setState(prevState => ({ ...prevState, body: { ...prevState.body, operationName } }));
  };
  const changeVariables = (variablesInput: string) => {
    try {
      const variables = JSON.parse(variablesInput || '{}');
      onChange(JSON.stringify({ ...state.body, variables }));
      setState(state => ({
        ...state,
        body: { ...state.body, variables },
        variablesSyntaxError: '',
      }));
    } catch (err) {
      setState(state => ({ ...state, variablesSyntaxError: err.message }));
    }
  };
  const changeQuery = (query: string) => {
    try {
      const documentAST = parse(query);
      const operations = documentAST.definitions.filter(isOperationDefinition)?.map(def => def.name?.value || '');
      // default to first operation when none selected
      let operationName = state.body.operationName || operations[0] || '';
      if (operations.length && state.body.operationName) {
        const operationsChanged = state.operations.join() !== operations.join();
        const operationNameWasChanged = !operations.includes(state.body.operationName);
        if (operationsChanged && operationNameWasChanged) {
          // preserve selection during name change or fallback to first operation
          const oldPostion = state.operations.indexOf(state.body.operationName);
          operationName = operations[oldPostion] || operations[0] || '';
        }
      }
      onChange(JSON.stringify({ ...state.body, query, operationName }));

      setState(state => ({
        ...state,
        documentAST,
        body: { ...state.body, query, operationName },
        operations,
      }));
    } catch (error) {
      console.warn('failed to parse', error);
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
      return 'fetching schema...';
    }
    if (schemaLastFetchTime > 0) {
      return (
        <span>
          schema fetched <TimeFromNow timestamp={schemaLastFetchTime} />
        </span>
      );
    }
    return <span>schema not yet fetched</span>;
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
    hideSchemaFetchErrors,
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
    hintOptions: ShowHintOptions;
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
        schema,
        completeSingle: false,
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
  return (
    <div className="graphql-editor">
      <Toolbar>
        <Dropdown>
          <DropdownButton disabled={!state.operations.length} className="btn btn--compact">{state.body.operationName || 'Operations'}</DropdownButton>
          {state.operations.map(operationName => (
            <DropdownItem
              key={operationName}
              onClick={() => changeOperationName(operationName)}
            >{operationName}</DropdownItem>
          ))}
        </Dropdown>
        <Dropdown>
          <DropdownButton className="btn btn--compact">
            schema <i className="fa fa-wrench" />
          </DropdownButton>
          <DropdownItem
            onClick={() => {
              setState(state => ({ ...state, explorerVisible: true }));
            }}
            disabled={!canShowSchema}
          >
            <i className="fa fa-file-code-o" /> Show Documentation
          </DropdownItem>
          <DropdownDivider>Remote GraphQL Schema</DropdownDivider>
          <DropdownItem
            onClick={async () => {
              // First, "forget" preference to hide errors so they always show
              // again after a refresh
              setState(state => ({ ...state, hideSchemaFetchErrors: false }));
              setSchemaIsFetching(true);
              await fetchGraphQLSchemaForRequest({
                requestId: request._id,
                environmentId,
                url: request.url,
              });
              setSchemaIsFetching(false);
            }}
            stayOpenAfterClick
          >
            <i className={classnames('fa', 'fa-refresh', { 'fa-spin': schemaIsFetching })} /> Refresh Schema
          </DropdownItem>
          <DropdownItem
            onClick={() => {
              setAutoFetch(!automaticFetch);
            }}
            stayOpenAfterClick
          >
            <i className={`fa fa-toggle-${automaticFetch ? 'on' : 'off'}`} />{' '}
            Automatic Fetch
            <HelpTooltip>Automatically fetch schema when request URL is modified</HelpTooltip>
          </DropdownItem>
          <DropdownDivider>Local GraphQL Schema</DropdownDivider>
          <DropdownItem
            onClick={() => {
              setState(state => ({ ...state, hideSchemaFetchErrors: false }));
              loadAndSetLocalSchema();
            }}
          >
            <i className="fa fa-file-code-o" /> Load schema from JSON
            <HelpTooltip>
              Run <i>apollo-codegen introspect-schema schema.graphql --output schema.json</i> to
              convert GraphQL DSL to JSON.
            </HelpTooltip>
          </DropdownItem>
        </Dropdown>
      </Toolbar>

      <div className="graphql-editor__query">
        <CodeEditor
          ref={editorRef}
          dynamicHeight
          showPrettifyButton
          uniquenessKey={uniquenessKey ? uniquenessKey + '::query' : undefined}
          defaultValue={requestBody.query || ''}
          className={className}
          onChange={changeQuery}
          mode="graphql"
          placeholder=""
          hintOptions={graphqlOptions?.hintOptions}
          infoOptions={graphqlOptions?.infoOptions}
          jumpOptions={graphqlOptions?.jumpOptions}
          lintOptions={graphqlOptions?.lintOptions}
        />
      </div>
      <div className="graphql-editor__schema-error">
        {!hideSchemaFetchErrors && schemaFetchError && (
          <div className="notice error margin no-margin-top margin-bottom-sm">
            <div className="pull-right">
              <button
                className="icon"
                onClick={() => setState(state => ({ ...state, hideSchemaFetchErrors: true }))}
              >
                <i className="fa fa-times" />
              </button>
            </div>
            {schemaFetchError.message}
            <br />
          </div>
        )}
      </div>
      <div className="graphql-editor__meta">
        {renderSchemaFetchMessage()}
      </div>
      <h2 className="no-margin pad-left-sm pad-top-sm pad-bottom-sm">
        Query Variables
        <HelpTooltip className="space-left">
          Variables to use in GraphQL query <br />
          (JSON format)
        </HelpTooltip>
        {variablesSyntaxError && (
          <span className="text-danger italic pull-right">{variablesSyntaxError}</span>
        )}
      </h2>
      <div className="graphql-editor__variables">
        <CodeEditor
          dynamicHeight
          enableNunjucks
          uniquenessKey={uniquenessKey ? uniquenessKey + '::variables' : undefined}
          showPrettifyButton={false}
          defaultValue={jsonPrettify(JSON.stringify(requestBody.variables))}
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
      <div className="pane__footer">
        <button className="pull-right btn btn--compact" onClick={beautifyRequestBody}>
          Prettify GraphQL
        </button>
      </div>

      {graphQLExplorerPortal}
    </div>
  );
};
