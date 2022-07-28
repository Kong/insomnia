import classnames from 'classnames';
import { LintOptions, ShowHintOptions, TextMarker } from 'codemirror';
import { GraphQLInfoOptions } from 'codemirror-graphql/info';
import { ModifiedGraphQLJumpOptions } from 'codemirror-graphql/jump';
import { OpenDialogOptions } from 'electron';
import { readFileSync } from 'fs';
import { DefinitionNode, DocumentNode, GraphQLNonNull, GraphQLSchema, NonNullTypeNode, OperationDefinitionNode, parse, typeFromAST } from 'graphql';
import { buildClientSchema, getIntrospectionQuery } from 'graphql/utilities';
import { Maybe } from 'graphql-language-service';
import { json as jsonPrettify } from 'insomnia-prettify';
import prettier from 'prettier';
import { complement } from 'ramda';
import React, { FC, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { SetRequired } from 'type-fest';

import { CONTENT_TYPE_JSON } from '../../../../common/constants';
import { database as db } from '../../../../common/database';
import { hotKeyRefs } from '../../../../common/hotkeys';
import { executeHotKey } from '../../../../common/hotkeys-listener';
import { markdownToHTML } from '../../../../common/markdown-to-html';
import { jsonParseOr } from '../../../../common/misc';
import type { ResponsePatch } from '../../../../main/network/libcurl-promise';
import * as models from '../../../../models/index';
import type { Request } from '../../../../models/request';
import { newBodyRaw } from '../../../../models/request';
import type { Settings } from '../../../../models/settings';
import type { Workspace } from '../../../../models/workspace';
import * as network from '../../../../network/network';
import { Dropdown } from '../../base/dropdown/dropdown';
import { DropdownButton } from '../../base/dropdown/dropdown-button';
import { DropdownDivider } from '../../base/dropdown/dropdown-divider';
import { DropdownItem } from '../../base/dropdown/dropdown-item';
import { CodeEditor, UnconnectedCodeEditor } from '../../codemirror/code-editor';
import { GraphQLExplorer } from '../../graph-ql-explorer/graph-ql-explorer';
import { ActiveReference } from '../../graph-ql-explorer/graph-ql-types';
import { HelpTooltip } from '../../help-tooltip';
import { KeydownBinder } from '../../keydown-binder';
import { showModal } from '../../modals';
import { ResponseDebugModal } from '../../modals/response-debug-modal';
import { TimeFromNow } from '../../time-from-now';
import { Tooltip } from '../../tooltip';
const explorerContainer = document.querySelector('#graphql-explorer-container');

if (!explorerContainer) {
  throw new Error('Failed to find #graphql-explorer-container');
}

function isOperationDefinition(def: DefinitionNode): def is OperationDefinitionNode {
  return def.kind === 'OperationDefinition';
}

type HasLocation = SetRequired<OperationDefinitionNode, 'loc'>;
const hasLocation = (def: OperationDefinitionNode): def is HasLocation => Boolean(def.loc);

/** note that `null` is a valid operation name.  For example, `null` is the operation name of an anonymous `query` operation. */
const matchesOperation = (operationName: string | null | undefined) => ({ name }: OperationDefinitionNode) => {
  // For matching an anonymous function, `operationName` will be `null` and `operation.name` will be `undefined`
  if (operationName === null && name === undefined) {
    return true;
  }
  return name?.value === operationName;
};

interface GraphQLBody {
  query: string;
  variables?: Record<string, any>;
  operationName?: string;
}

interface Props {
  onChange: Function;
  content: string;
  request: Request;
  workspace: Workspace;
  settings: Settings;
  environmentId: string;
  className?: string;
  uniquenessKey?: string;
}

interface State {
  body: GraphQLBody;
  schema: GraphQLSchema | null;
  schemaFetchError: {
    message: string;
    response: ResponsePatch | null;
  } | null;
  schemaLastFetchTime: number;
  schemaIsFetching: boolean;
  hideSchemaFetchErrors: boolean;
  variablesSyntaxError: string;
  automaticFetch: boolean;
  explorerVisible: boolean;
  activeReference: null | ActiveReference;
  documentAST: null | DocumentNode;
  disabledOperationMarkers: TextMarker[];
}
const GraphQLEditorFC: FC<Props> = async props => {
  let obj: GraphQLBody;
  try {
    obj = JSON.parse(props.content);
  } catch (err) {
    obj = { query: '' };
  }
  if (typeof obj.variables === 'string') {
    obj.variables = jsonParseOr(obj.variables, '');
  }
  const body: GraphQLBody = {
    query: obj.query || '',
    variables: obj.variables || undefined,
    operationName: obj.operationName || undefined,
  };
  let documentAST;
  try {
    documentAST = parse(body.query);
  } catch (error) {
    documentAST = null;
  }

  let automaticFetch = true;

  try {
    const automaticFetchStringified = window.localStorage.getItem('graphql.automaticFetch');
    if (automaticFetchStringified) {
      automaticFetch = JSON.parse(automaticFetchStringified);
    }
  } catch (err) {
    if (err instanceof Error) {
      console.warn('Could not parse value of graphql.automaticFetch from localStorage:', err.message);
    }
  }
  const [state, setState] = useState<State>({
    body,
    schema: null,
    schemaFetchError: null,
    schemaLastFetchTime: 0,
    schemaIsFetching: false,
    hideSchemaFetchErrors: false,
    variablesSyntaxError: '',
    activeReference: null,
    explorerVisible: false,
    automaticFetch,
    documentAST,
    disabledOperationMarkers: [],
  });
  const editorRef = useRef<UnconnectedCodeEditor>(null);
  const _getCurrentOperation = () => {
    if (!editorRef.current) {
      return state.body.operationName || null;
    }
    // Ignore cursor position when editor isn't focused
    if (!editorRef.current.hasFocus()) {
      return state.body.operationName || null;
    }
    const operations = state.documentAST ? state.documentAST.definitions.filter(def => def.kind === 'OperationDefinition') : [];
    const cursor = editorRef.current.getCursor();
    const cursorIndex = editorRef.current.indexFromPos(cursor);
    let operationName: string | null = null;
    const allOperationNames: (string | null)[] = [];
    // Loop through all operations to see if one contains the cursor.
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      if (!operation.name) {
        continue;
      }
      allOperationNames.push(operation.name.value);
      const { start, end } = operation.loc;
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
  };

  const _highlightOperation = (operationName: string | null) => {
    const { documentAST, disabledOperationMarkers } = state;
    if (!documentAST || !editorRef.current) {
      return;
    }
    // Remove current query highlighting
    for (const textMarker of disabledOperationMarkers) {
      textMarker.clear();
    }
    const markers = documentAST.definitions
      .filter(isOperationDefinition)
      .filter(complement(matchesOperation(operationName)))
      .filter(hasLocation)
      .map(({ loc: { startToken, endToken } }) =>
        editorRef.current.getDoc().markText({
          line: startToken.line - 1,
          ch: startToken.column - 1,
        }, {
          line: endToken.line,
          ch: endToken.column - 1,
        }, {
          className: 'cm-gql-disabled',
        }));
    setState({ ...state, disabledOperationMarkers: markers });
  };
  const _handlePrettify = () => {
    const { body } = state;
    const { variables, query } = body;
    const prettyQuery = prettier.format(query, {
      parser: 'graphql',
      useTabs: props.settings.editorIndentWithTabs,
      tabWidth: props.settings.editorIndentSize,
    });
    const prettyVariables = variables && JSON.parse(jsonPrettify(JSON.stringify(variables)));

    _handleBodyChange(prettyQuery, prettyVariables, state.body.operationName);

    // Update editor contents
    if (editorRef.current) {
      editorRef.current.setValue(prettyQuery);
    }
  };
  const _handleClickReference = (reference: Maybe<ActiveReference>, event: MouseEvent) => {
    event.preventDefault();
    if (reference) {
      setState({
        ...state,
        explorerVisible: true,
        activeReference: reference,
      });
    }
  };
  const _handleQueryUserActivity = () => {
    const newOperationName = _getCurrentOperation();
    const { query, variables, operationName } = state.body;
    if (newOperationName !== operationName) {
      _handleBodyChange(query, variables, newOperationName);
    }
  };

  const _buildVariableTypes = (schema: GraphQLSchema | null): Record<string, GraphQLNonNull<any>> | null => {
    if (!schema) {
      return null;
    }
    const definitions = state.documentAST ? state.documentAST.definitions : [];
    const variableToType: Record<string, GraphQLNonNull<any>> = {};
    for (const definition of definitions) {
      if (!isOperationDefinition(definition)) {
        continue;
      }
      if (!definition.variableDefinitions) {
        continue;
      }
      for (const { variable, type } of definition.variableDefinitions) {
        const inputType = typeFromAST(schema, type as NonNullTypeNode);
        if (!inputType) {
          continue;
        }
        variableToType[variable.name.value] = inputType;
      }
    }
    return variableToType;
  };

  const _handleRefreshSchema = () => {
    // First, "forget" preference to hide errors so they always show
    // again after a refresh
    setState({ ...state, hideSchemaFetchErrors: false });
    _fetchAndSetSchema(props.request);
  };

  const _handleVariablesChange = (variables: string) => {
    try {
      const variablesObj = JSON.parse(variables || 'null');

      _handleBodyChange(state.body.query, variablesObj, state.body.operationName);
    } catch (err) {
      setState({ ...state, variablesSyntaxError: err.message });
    }
  };

  const _handleBodyChange = (query: string, variables?: Record<string, any> | null, operationName?: string | null,) => {
    let documentAST;
    try {
      documentAST = parse(query);
    } catch (error) {
      documentAST = null;
    }
    setState({ documentAST });

    const body: GraphQLBody = {
      query,
    };

    if (variables) {
      body.variables = variables;
    }

    if (operationName) {
      body.operationName = operationName;
    }

    // Find op if there isn't one yet
    if (!body.operationName) {
      const newOperationName = _getCurrentOperation();

      if (newOperationName) {
        body.operationName = newOperationName;
      }
    }

    const newContent = JSON.stringify(body);

    setState({
      variablesSyntaxError: '',
      body,
    });
    props.onChange(newContent);

    _highlightOperation(body.operationName || null);
  };
  const renderSchemaFetchMessage = () => {
    if (!props.request.url) {
      return '';
    }
    const { schemaLastFetchTime, schemaIsFetching } = state;
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

  useEffect(() => {
    _fetchAndSetSchema(props.request);
  }, [_fetchAndSetSchema, props.request]);

  const _fetchAndSetSchema = async (rawRequest: Request) => {
    setState({ ...state, schemaIsFetching: true });
    const { environmentId } = props;
    const newState = {
      schema: state.schema,
      schemaFetchError: null as any,
      schemaLastFetchTime: state.schemaLastFetchTime,
      schemaIsFetching: false,
    };
    let responsePatch: ResponsePatch | null = null;
    if (!rawRequest.url) {
      return;
    }
    try {
      const bodyJson = JSON.stringify({
        query: getIntrospectionQuery(),
        operationName: 'IntrospectionQuery',
      });
      const introspectionRequest = await db.upsert(
        Object.assign({}, rawRequest, {
          _id: rawRequest._id + '.graphql',
          settingMaxTimelineDataSize: 5000,
          parentId: rawRequest._id,
          isPrivate: true,
          // So it doesn't get synced or exported
          body: newBodyRaw(bodyJson, CONTENT_TYPE_JSON),
        }),
      );
      responsePatch = await network.send(introspectionRequest._id, environmentId);
      const bodyBuffer = models.response.getBodyBuffer(responsePatch);
      const status = typeof responsePatch.statusCode === 'number' ? responsePatch.statusCode : 0;
      const error = typeof responsePatch.error === 'string' ? responsePatch.error : '';

      if (error) {
        newState.schemaFetchError = {
          message: error,
          response: responsePatch,
        };
      } else if (status < 200 || status >= 300) {
        const renderedURL = responsePatch.url || rawRequest.url;
        newState.schemaFetchError = {
          message: `Got status ${status} fetching schema from "${renderedURL}"`,
          response: responsePatch,
        };
      } else if (bodyBuffer) {
        const { data } = JSON.parse(bodyBuffer.toString());
        newState.schema = buildClientSchema(data);
        newState.schemaLastFetchTime = Date.now();
      } else {
        newState.schemaFetchError = {
          message: 'No response body received when fetching schema',
          response: responsePatch,
        };
      }
    } catch (err) {
      console.log('[graphql] ERROR: Failed to fetch schema', err);
      newState.schemaFetchError = {
        message: `Failed to fetch schema: ${err.message}`,
        response: responsePatch,
      };
    }

    if (_isMounted) {
      setState({ ...state, ...newState });
    }
  };

  const _loadAndSetLocalSchema = async () => {
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

      if (!_isMounted) {
        return;
      }
      setState({
        ...state,
        schema: buildClientSchema(content.data),
        schemaLastFetchTime: Date.now(),
        schemaFetchError: null,
        schemaIsFetching: false,
      });
    } catch (err) {
      console.log('[graphql] ERROR: Failed to fetch schema', err);
      if (!_isMounted) {
        return;
      }
      setState({
        ...state,
        schemaFetchError: {
          message: `Failed to fetch schema: ${err.message}`,
          response: null,
        },
        schemaIsFetching: false,
      });
    }
  };

  const {
    content,
    className,
    uniquenessKey,
  } = props;
  const {
    schema,
    schemaFetchError,
    hideSchemaFetchErrors,
    variablesSyntaxError,
    schemaIsFetching,
    automaticFetch,
    activeReference,
    explorerVisible,
    schemaLastFetchTime,
  } = state;
  const { operationName } = state.body;
  let obj: GraphQLBody;
  try {
    obj = JSON.parse(content);
  } catch (err) {
    obj = { query: '' };
  }
  if (typeof obj.variables === 'string') {
    obj.variables = jsonParseOr(obj.variables, '');
  }
  const body: GraphQLBody = {
    query: obj.query || '',
    variables: obj.variables || undefined,
    operationName: obj.operationName || undefined,
  };

  const { query, variables: variablesObject } = body;

  const variables = jsonPrettify(JSON.stringify(variablesObject));

  const variableTypes = _buildVariableTypes(schema);

  // Create portal for GraphQL Explorer
  let graphQLExplorerPortal: React.ReactPortal | null = null;
  if (explorerContainer) {
    graphQLExplorerPortal = ReactDOM.createPortal(
      <GraphQLExplorer
        schema={schema}
        key={schemaLastFetchTime}
        visible={explorerVisible}
        reference={activeReference}
        handleClose={() => setState({
          explorerVisible: false,
        })}
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

  if (schema) {
    graphqlOptions = {
      hintOptions: {
        schema,
        completeSingle: false,
      },
      infoOptions: {
        schema,
        renderDescription: text => `<div class="markdown-preview__content">${markdownToHTML(text)}</div>`,
        onClick: _handleClickReference,
      },
      jumpOptions: {
        schema,
        onClick: _handleClickReference,
      },
      lintOptions: {
        schema,
      },
    };
  }

  return (
    <div className="graphql-editor">
      <KeydownBinder onKeydown={event => executeHotKey(event, hotKeyRefs.BEAUTIFY_REQUEST_BODY, _handlePrettify)} />
      <Dropdown right className="graphql-editor__schema-dropdown margin-bottom-xs">

        <DropdownButton className="space-left btn btn--micro btn--outlined">
          schema <i className="fa fa-wrench" />
        </DropdownButton>

        <DropdownItem
          onClick={() => {
            setState({ ...state, explorerVisible: true });
          }}
          disabled={!schema}
        >
          <i className="fa fa-file-code-o" /> Show Documentation
        </DropdownItem>

        <DropdownDivider>Remote GraphQL Schema</DropdownDivider>

        <DropdownItem onClick={_handleRefreshSchema} stayOpenAfterClick>
          <i className={classnames('fa', 'fa-refresh', { 'fa-spin': schemaIsFetching })} /> Refresh Schema
        </DropdownItem>
        <DropdownItem
          onClick={() => {
            setState({ ...state, automaticFetch: !state.automaticFetch });
            window.localStorage.setItem('graphql.automaticFetch', state.automaticFetch.toString());
          }}
          stayOpenAfterClick
        >
          <i className={`fa fa-toggle-${automaticFetch ? 'on' : 'off'}`} />{' '}
          Automatic Fetch
          <HelpTooltip>Automatically fetch schema when request URL is modified</HelpTooltip>
        </DropdownItem>

        <DropdownDivider>Local GraphQL Schema</DropdownDivider>

        <DropdownItem onClick={() => setState({ hideSchemaFetchErrors: false }, _loadAndSetLocalSchema)}>
          <i className="fa fa-file-code-o" /> Load schema from JSON
          <HelpTooltip>
            Run <i>apollo-codegen introspect-schema schema.graphql --output schema.json</i> to
            convert GraphQL DSL to JSON.
          </HelpTooltip>
        </DropdownItem>
      </Dropdown>

      <div className="graphql-editor__query">
        <CodeEditor
          dynamicHeight
          manualPrettify
          uniquenessKey={uniquenessKey ? uniquenessKey + '::query' : undefined}
          defaultValue={query}
          className={className}
          onChange={query => {
            // Since we're editing the query, we may be changing the operation name, so
            // Don't pass it to the body change in order to automatically re-detect it
            // based on the current cursor position.
            _handleBodyChange(query, state.body.variables, null);
          }}
          onCodeMirrorInit={codeMirror => {
            editorRef.current = codeMirror;
            // @ts-expect-error -- TSCONVERSION window.cm doesn't exist
            window.cm = editorRef.current;
            const { query, variables, operationName } = state.body;
            _handleBodyChange(query, variables, operationName);
          }}
          onCursorActivity={_handleQueryUserActivity}
          onFocus={_handleQueryUserActivity}
          mode="graphql"
          placeholder=""
          {...graphqlOptions}
        />
      </div>
      <div className="graphql-editor__schema-error">
        {!hideSchemaFetchErrors && schemaFetchError && (
          <div className="notice error margin no-margin-top margin-bottom-sm">
            <div className="pull-right">
              <Tooltip position="top" message="View introspection request/response timeline">
                <button
                  className="icon icon--success"
                  onClick={() => {
                    if (schemaFetchError?.response) {
                      showModal(ResponseDebugModal, {
                        title: 'GraphQL Introspection Response',
                        response: schemaFetchError.response,
                      });
                    }
                  }}
                >
                  <i className="fa fa-bug" />
                </button>
              </Tooltip>{' '}
              <button
                className="icon"
                onClick={() => setState({ ...state, hideSchemaFetchErrors: true })}
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
        <div className="graphql-editor__operation-name">{operationName ? <span title="Current operationName">{operationName}</span> : null}</div>
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
          manualPrettify={false}
          defaultValue={variables}
          className={className}
          getAutocompleteConstants={() => Object.keys(variableTypes || {})}
          lintOptions={{
            variableToType: variableTypes,
          }}
          noLint={!variableTypes}
          onChange={_handleVariablesChange}
          mode="graphql-variables"
          placeholder=""
        />
      </div>
      <div className="pane__footer">
        <button className="pull-right btn btn--compact" onClick={_handlePrettify}>
          Prettify GraphQL
        </button>
      </div>

      {graphQLExplorerPortal}
    </div>
  );
};
