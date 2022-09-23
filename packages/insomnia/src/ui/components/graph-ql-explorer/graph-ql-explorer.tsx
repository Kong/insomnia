import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { SchemaReference } from 'codemirror-graphql/utils/SchemaReference';
import { GraphQLEnumType, GraphQLField, GraphQLNamedType, GraphQLSchema, GraphQLType, isNamedType } from 'graphql';
import React, { FC, PureComponent, useCallback, useEffect, useRef, useState } from 'react';
import { createRef } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { hotKeyRefs } from '../../../common/hotkeys';
import { executeHotKey } from '../../../common/hotkeys-listener';
import { DebouncedInput } from '../base/debounced-input';
import { KeydownBinder } from '../keydown-binder';
import { GraphQLExplorerEnum } from './graph-ql-explorer-enum';
import { GraphQLExplorerField } from './graph-ql-explorer-field';
import { GraphQLExplorerSchema } from './graph-ql-explorer-schema';
import { GraphQLExplorerSearchResults } from './graph-ql-explorer-search-results';
import { GraphQLExplorerType } from './graph-ql-explorer-type';
import { ActiveReference, GraphQLFieldWithParentName } from './graph-ql-types';

function getReferenceInfo(reference: SchemaReference) {
  let field: GraphQLField<any, any, { [key: string]: any }> | undefined;
  if ('field' in reference) {
    field = reference.field;
  }

  let type: GraphQLType | undefined | null;
  if ('type' in reference) {
    type = reference.type;
  }

  return { type, field };
}

function isSameFieldAndType(
  currentType?: GraphQLType | null,
  type?: GraphQLType | null,
  currentField?: GraphQLFieldWithParentName,
  field?: GraphQLField<any, any, { [key: string]: any }>
) {
  // @TODO Simplify this function since it's hard to follow along
  const compare = <
    T extends GraphQLNamedType | GraphQLFieldWithParentName,
    U extends GraphQLNamedType | GraphQLFieldWithParentName
  >(a?: T, b?: U) => (!a && !b) || (a && b && a.name === b.name);

  if (!isNamedType(currentType)) {
    currentType = undefined;
  }

  if (!isNamedType(type)) {
    type = undefined;
  }

  const isSameType = compare(currentType, type);

  const isSameField = compare(currentField, field);
  return isSameType && isSameField;
}

interface Props {
  handleClose: () => void;
  schema: GraphQLSchema | null;
  visible: boolean;
  reference: null | ActiveReference;
}

interface HistoryItem {
  currentType?: GraphQLType | null;
  currentField?: GraphQLFieldWithParentName;
}

interface State extends HistoryItem {
  history: HistoryItem[];
  filter: string;
}

const SEARCH_UPDATE_DELAY_IN_MS = 200;
export const GraphQLExplorer: FC<Props> = ({ schema, handleClose, visible, reference }) => {
  const [state, setState] = useState<State>({ history:[], filter: '' });
  const inputRef = useRef<DebouncedInput>(null);

  const addToHistory = useCallback(() => {
    const { currentType, currentField, history } = state;
    if (!currentType && !currentField) {
      return history;
    }
    return [...history, { currentType, currentField }];
  }, [state]);

  useEffect(() => {
    const { currentField, currentType } = state;
    if (!reference) {
      return;
    }
    const { type, field } = getReferenceInfo(reference);

    if (isSameFieldAndType(currentType, type, currentField, field)) {
      return;
    }

    setState({
      ...state,
      history: addToHistory(),
      currentType: type,
      currentField: field,
    });
  }, [addToHistory, reference, state]);

  const handleNavigateType = (type: GraphQLType) => {
    setState({
      ...state,
      currentType: type,
      currentField: undefined,
      history: addToHistory(),
    });
  };

  const handleNavigateField = (field: GraphQLFieldWithParentName) => {
    setState({
      ...state,
      currentType: field.type,
      currentField: field,
      history: addToHistory(),
    });
  };

  const handlePopHistory = () => {
    const last = state.history[history.length - 1] || null;
    setState({
      ...state,
      history: history.slice(0, history.length - 1),
      currentType: last ? last.currentType : undefined,
      currentField: last ? last.currentField : undefined,
    });
  };

  if (!visible) {
    return null;
  }

  const { currentType, currentField, history } = state;
  let child: JSX.Element | null = null;

  if (currentField) {
    child = (
      <GraphQLExplorerField onNavigateType={handleNavigateType} field={currentField} />
    );
  } else if (currentType && currentType instanceof GraphQLEnumType) {
    child = <GraphQLExplorerEnum type={currentType} />;
  } else if (currentType) {
    child = (
      <GraphQLExplorerType
        schema={schema}
        type={currentType}
        onNavigateType={handleNavigateType}
        onNavigateField={handleNavigateField}
      />
    );
  } else if (schema) {
    child = (
      <>
        <div className="graphql-explorer__search">
          <div className="form-control form-control--outlined form-control--btn-right">
            <DebouncedInput
              ref={inputRef}
              onChange={filter => setState({ ...state, filter })}
              placeholder="Search the docs..."
              delay={SEARCH_UPDATE_DELAY_IN_MS}
              initialValue={state.filter}
            />
            {state.filter && (
              <button
                className="form-control__right"
                onClick={() => {
                  inputRef.current?.setValue('');
                  setState({ ...state, filter:'' });
                }}
              >
                <i className="fa fa-times-circle" />
              </button>
            )}
          </div>
        </div>
        {state.filter ? (
          <GraphQLExplorerSearchResults
            schema={schema}
            filter={state.filter}
            onNavigateType={handleNavigateType}
            onNavigateField={handleNavigateField}
          />
        ) : (
          <GraphQLExplorerSchema
            onNavigateType={handleNavigateType}
            schema={schema}
          />
        )}
      </>
    );
  }

  if (!child) {
    return null;
  }

  const fieldName = currentField ? currentField.name : null;
  const typeName = isNamedType(currentType) ? currentType.name : null;
  const schemaName = schema ? 'Schema' : null;
  const typeOrField = currentType || currentField;
  let name = 'Unknown';
  const lastHistoryItem = history[history.length - 1] || {};
  if (lastHistoryItem.currentField?.name) {
    name = lastHistoryItem.currentField?.name;
  } else if (isNamedType(lastHistoryItem.currentType)) {
    name = lastHistoryItem.currentType.name;
  }
  return (
    <KeydownBinder
      onKeydown={event => {
        executeHotKey(event, hotKeyRefs.GRAPHQL_EXPLORER_FOCUS_FILTER, () => {
          setState({
            ...state,
            currentType: undefined,
            currentField: undefined,
            history: addToHistory(),
          });
          if (inputRef.current) {
            inputRef.current?.focus();
            inputRef.current?.select();
          }
        });
      }}
    >
      <div className="graphql-explorer theme--dialog">
        <div className="graphql-explorer__header">
          {state.history.length ?
            (<a
              href="#"
              className="graphql-explorer__header__back-btn"
              onClick={event => {
                event.preventDefault();
                handlePopHistory();
              }}
            >
              <i className="fa--skinny fa fa-angle-left" /> {name}
            </a>)
            : typeOrField ?
              (<a
                href="#"
                className="graphql-explorer__header__back-btn"
                onClick={event => {
                  event.preventDefault();
                  handlePopHistory();
                }}
              >
                <i className="fa--skinny fa fa-angle-left" /> Schema
              </a>)
              : null}
          <h1>{fieldName || typeName || schemaName || 'Unknown'}</h1>
          <button
            className="btn btn--compact graphql-explorer__header__close-btn"
            onClick={handleClose}
          >
            <i className="fa fa-close" />
          </button>
        </div>
        <div className="graphql-explorer__body">{child}</div>
      </div>
    </KeydownBinder>
  );
};
