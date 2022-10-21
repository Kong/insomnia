import classnames from 'classnames';
import clone from 'clone';
import React, { FC, useCallback, useEffect, useState } from 'react';
import { useMount } from 'react-use';

import { database as db } from '../../../common/database';
import { delay, fnOrString } from '../../../common/misc';
import { HandleGetRenderContext, HandleRender } from '../../../common/render';
import { metaSortKeySort } from '../../../common/sorting';
import * as models from '../../../models';
import type { BaseModel } from '../../../models/index';
import { isRequest, Request } from '../../../models/request';
import { isRequestGroup, RequestGroup } from '../../../models/request-group';
import type { Workspace } from '../../../models/workspace';
import { getTemplateTags } from '../../../plugins';
import * as pluginContexts from '../../../plugins/context';
import * as templating from '../../../templating';
import type {
  NunjucksParsedTag,
  NunjucksParsedTagArg,
} from '../../../templating/utils';
import * as templateUtils from '../../../templating/utils';
import { useNunjucks } from '../../context/nunjucks/use-nunjucks';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { FileInputButton } from '../base/file-input-button';
import { HelpTooltip } from '../help-tooltip';

interface Props {
  handleRender: HandleRender;
  handleGetRenderContext: HandleGetRenderContext;
  defaultValue: string;
  onChange: (...args: any[]) => any;
  workspace: Workspace;
}

interface State {
  activeTagData: NunjucksParsedTag | null;
  activeTagDefinition: NunjucksParsedTag | null;
  tagDefinitions: NunjucksParsedTag[];
  loadingDocs: boolean;
  allDocs: Record<string, BaseModel[]>;
  rendering: boolean;
  preview: string;
  error: string;
  variables: {
    name: string;
    value: string;
  }[];
}
export const TagEditor: FC<Props> = props => {
  const [state, setState] = useState<State>({
    activeTagData: null,
    activeTagDefinition: null,
    tagDefinitions: [],
    loadingDocs: false,
    allDocs: {},
    rendering: true,
    preview: '',
    error: '',
    variables: [],
  });
  const { handleGetRenderContext } = useNunjucks();

  const sortRequests = useCallback((_models: (Request | RequestGroup)[], parentId: string) => {
    let sortedModels: (Request | RequestGroup)[] = [];
    _models
      .filter(model => model.parentId === parentId)
      .sort(metaSortKeySort)
      .forEach(model => {
        if (isRequest(model)) {
          sortedModels.push(model);
        }
        if (isRequestGroup(model)) {
          sortedModels = sortedModels.concat(sortRequests(_models, model._id));
        }
      });
    return sortedModels;
  }, []);

  const refreshModels = useCallback(async () => {
    setState(state => ({ ...state, loadingDocs: true }));
    const allDocs: Record<string, models.BaseModel[]> = {};
    for (const type of models.types()) {
      allDocs[type] = [];
    }
    for (const doc of await db.withDescendants(props.workspace, models.request.type)) {
      allDocs[doc.type].push(doc);
    }
    // @ts-expect-error -- type unsoundness
    allDocs[models.request.type] = sortRequests((allDocs[models.request.type] || []).concat(allDocs[models.requestGroup.type] || []), props.workspace._id);
    setState(state => ({ ...state, allDocs, loadingDocs: false }));
  }, [sortRequests, props.workspace]);

  useMount(async () => {
    const activeTagData = templateUtils.tokenizeTag(props.defaultValue);
    const tagDefinitions = await templating.getTagDefinitions();
    const activeTagDefinition: NunjucksParsedTag | null =
      tagDefinitions.find(d => d.name === activeTagData.name) || null;
    // Edit tags raw that we don't know about
    if (!activeTagDefinition) {
      activeTagData.rawValue = props.defaultValue;
    }
    // Fix strings: arg.value expects an escaped value (based on _updateArg logic)
    for (const arg of activeTagData.args) {
      if (typeof arg.value === 'string') {
        arg.value = arg.value.replace(/\\/g, '\\\\');
      }
    }
    await Promise.all([
      refreshModels(),
      _update(tagDefinitions, activeTagDefinition, activeTagData, true),
    ]);
    const context = await handleGetRenderContext();
    const variables = context.keys;
    setState(state => ({ ...state, variables }));
  });

  // this is probably
  useEffect(() => {
    refreshModels();
  }, [refreshModels]);

  async function _updateArg(
    argValue: string | number | boolean,
    argIndex: number,
    forceNewType: string | null = null,
    patch: Record<string, any> = {},
  ) {
    const { tagDefinitions, activeTagData, activeTagDefinition } = state;
    if (!activeTagData) {
      console.warn('No active tag data to update', {
        state: state,
      });
      return;
    }
    if (!activeTagDefinition) {
      console.warn('No active tag definition to update', {
        state: state,
      });
      return;
    }
    // Fix strings
    if (typeof argValue === 'string') {
      argValue = argValue.replace(/\\/g, '\\\\');
    }
    // Ensure all arguments exist
    const defaultArgs = templateUtils.tokenizeTag(templateUtils.getDefaultFill(
      activeTagDefinition.name,
      activeTagDefinition.args,
    )).args;
    for (let i = 0; i < defaultArgs.length; i++) {
      if (activeTagData.args[i]) {
        continue;
      }
      activeTagData.args[i] = defaultArgs[i];
    }
    const tagData = clone(activeTagData);
    const argData: NunjucksParsedTagArg = tagData.args[argIndex];
    if (!argData) {
      // Should never happen
      console.warn('Could not find arg data to update', {
        tagData,
        argIndex,
      });
      return;
    }
    // Update it
    argData.value = argValue;
    // Update type if we need to
    if (forceNewType) {
      // Ugh, what a hack (because it's enum)
      Object.assign(argData as any, { type: forceNewType }, patch);
    }
    _update(tagDefinitions, activeTagDefinition, tagData, false);
  }

  function handleChange(event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>) {
    let argIndex = -1;
    if (event.currentTarget.parentNode instanceof HTMLElement) {
      const index = event.currentTarget.parentNode?.getAttribute('data-arg-index');
      argIndex = typeof index === 'string' ? parseInt(index, 10) : -1;
    }
    // Handle special types
    if (event.currentTarget.getAttribute('data-encoding') === 'base64') {
      return _updateArg(templateUtils.encodeEncoding(event.currentTarget.value, 'base64'), argIndex);
    }
    // Handle normal types
    if (event.currentTarget.type === 'number') {
      return _updateArg(parseFloat(event.currentTarget.value), argIndex);
    } else if (event.currentTarget.type === 'checkbox') {
      // @ts-expect-error -- TSCONVERSION .checked doesn't exist on HTMLSelectElement
      return _updateArg(event.currentTarget.checked, argIndex);
    } else {
      return _updateArg(event.currentTarget.value, argIndex);
    }
  }
  async function _update(
    tagDefinitions: NunjucksParsedTag[],
    tagDefinition: NunjucksParsedTag | null,
    tagData: NunjucksParsedTag | null,
    noCallback = false,
  ) {
    const { handleRender } = props;
    const start = Date.now();
    setState(state => ({ ...state, rendering: true }));
    let preview = '';
    let error = '';
    let activeTagData: NunjucksParsedTag | null = tagData;

    if (!activeTagData && tagDefinition) {
      activeTagData = templateUtils.tokenizeTag(templateUtils.getDefaultFill(
        tagDefinition.name,
        tagDefinition.args,
      ));
    } else if (!activeTagData && !tagDefinition && state.activeTagData) {
      activeTagData = {
        name: 'custom',
        displayName: 'Custom',
        args: [],
        rawValue: templateUtils.unTokenizeTag(state.activeTagData),
      };
    }
    let template;
    if (activeTagData) {
      try {
        template =
          typeof activeTagData.rawValue === 'string'
            ? activeTagData.rawValue
            : templateUtils.unTokenizeTag(activeTagData);
        preview = await handleRender(template);
      } catch (err) {
        error = err.message;
      }
    }

    setState(state => ({
      ...state,
      tagDefinitions,
      activeTagData,
      error,
      activeTagDefinition: tagDefinition,
    }));
    // Call the callback if we need to
    if (!noCallback) {
      props.onChange(template);
    }
    // Make rendering take at least this long so we can see a spinner
    await delay(300 - (Date.now() - start));
    setState(state => ({ ...state, rendering: false, preview }));
  }

  function resolveRequestGroupPrefix(requestGroupId: string, allRequestGroups: any[]) {
    let prefix = '';
    let reqGroup: any;
    do {
      // Get prefix from inner most request group.
      reqGroup = allRequestGroups.find(rg => rg._id === requestGroupId);
      if (reqGroup == null) {
        break;
      }
      const name = typeof reqGroup.name === 'string' ? reqGroup.name : '';
      prefix = `[${name}] ` + prefix;
      requestGroupId = reqGroup.parentId;
    } while (true);
    return prefix;
  }

  const { error, preview, activeTagDefinition, activeTagData, rendering } = state;
  if (!activeTagData) {
    return null;
  }
  let finalPreview = preview;
  if (activeTagDefinition?.disablePreview && activeTagDefinition.disablePreview(activeTagData.args)) {
    finalPreview = preview.replace(/./g, '*');
  }
  let previewElement;
  if (error) {
    previewElement = <textarea className="danger" value={error || 'Error'} readOnly rows={5} />;
  } else if (rendering) {
    previewElement = <textarea value="rendering..." readOnly rows={5} />;
  } else {
    previewElement = <textarea value={finalPreview || 'error'} readOnly rows={5} />;
  }

  return (
    <div>
      <div className="form-control form-control--outlined">
        <label>
          Function to Perform
          <select
            onChange={async event => {
              const name = event.currentTarget.value;
              const tagDefinitions = await templating.getTagDefinitions();
              const tagDefinition = tagDefinitions.find(d => d.name === name) || null;

              _update(state.tagDefinitions, tagDefinition, null, false);
            }}
            value={activeTagDefinition ? activeTagDefinition.name : ''}
          >
            {state.tagDefinitions.map((tagDefinition, i) => (
              <option key={`${i}::${tagDefinition.name}`} value={tagDefinition.name}>
                {tagDefinition.displayName} – {tagDefinition.description}
              </option>
            ))}
            <option value="custom">-- Custom --</option>
          </select>
        </label>
      </div>
      {activeTagDefinition?.args.map((argDefinition: NunjucksParsedTagArg, index) => {
        // Decide whether or not to show it
        if (typeof argDefinition.hide === 'function' && argDefinition.hide(activeTagData.args)) {
          return null;
        }
        let argData: NunjucksParsedTagArg;
        if (index < activeTagData.args.length) {
          argData = activeTagData.args[index];
        } else if (state.activeTagDefinition) {
          const defaultTagData = templateUtils.tokenizeTag(templateUtils.getDefaultFill(
            state.activeTagDefinition.name,
            state.activeTagDefinition.args,
          ));
          argData = defaultTagData.args[index];
        } else {
          return null;
        }
        if (!argData) {
          console.error('Failed to find argument to set default', {
            argDefinition,
            argDatas: activeTagData.args,
            argIndex: index,
          });
          return null;
        }
        const strValue = templateUtils.decodeEncoding(argData.value.toString());
        const isVariable = argData.type === 'variable';
        const argInputVariable = isVariable ? state.variables.length === 0 ? (
          <select disabled>
            <option>-- No Environment Variables Found --</option>
          </select>
        ) : (
          <select value={strValue || ''} onChange={handleChange}>
            <option key="n/a" value="NO_VARIABLE">
              -- Select Variable --
            </option>
            {state.variables.map((v, i) => (
              <option key={`${i}::${v.name}`} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
        ) : null;
        let argInput;
        let isVariableAllowed = true;
        if (argDefinition.type === 'string') {
          const placeholder =
            typeof argDefinition.placeholder === 'string' ? argDefinition.placeholder : '';
          const encoding = argDefinition.encoding || 'utf8';
          argInput = (<input
            type="text"
            defaultValue={strValue.replace(/\\\\/g, '\\') || ''}
            placeholder={placeholder}
            onChange={handleChange}
            data-encoding={encoding}
          />);
        } else if (argDefinition.type === 'enum') {
          argInput = (
            <select value={strValue} onChange={handleChange}>
              {!argDefinition.options?.find(o => o.value === strValue) ? <option value="">-- Select Option --</option> : null}
              {argDefinition.options?.map(option => (
                // @ts-expect-error -- TSCONVERSION boolean not accepted by option
                <option key={option.value.toString()} value={option.value}>
                  {option.description ? `${fnOrString(option.displayName, state.activeTagData?.args || [])} – ${option.description}` : fnOrString(option.displayName, state.activeTagData?.args || [])}
                </option>
              ))}
            </select>
          );
        } else if (argDefinition.type === 'file') {
          argInput = (<FileInputButton
            showFileIcon
            showFileName
            className="btn btn--clicky btn--super-compact"
            onChange={path => _updateArg(path, index)}
            path={strValue.replace(/\\\\/g, '\\')}
            itemtypes={argDefinition.itemTypes}
            extensions={argDefinition.extensions}
          />);
        } else if (argDefinition.type === 'model') {
          isVariableAllowed = false;
          argInput = state.loadingDocs ? (
            <select disabled={state.loadingDocs}>
              <option>Loading...</option>
            </select>
          ) : (
            <select value={typeof strValue === 'string' ? strValue : 'unknown'} onChange={handleChange}>
              <option value="n/a">-- Select Item --</option>
              {state.allDocs[typeof argDefinition.model === 'string' ? argDefinition.model : 'unknown']?.map((doc: any) => {
                let namePrefix: string | null = null;
                // Show parent folder with name if it's a request
                if (isRequest(doc)) {
                  const requests = state.allDocs[models.request.type] || [];
                  const request: any = requests.find(r => r._id === doc._id);
                  const method = request && typeof request.method === 'string' ? request.method : 'GET';
                  const parentId = request ? request.parentId : 'n/a';
                  const allRequestGroups = state.allDocs[models.requestGroup.type] || [];
                  const requestGroupPrefix = resolveRequestGroupPrefix(parentId, allRequestGroups);
                  namePrefix = `${requestGroupPrefix + method} `;
                }
                return (
                  <option key={doc._id} value={doc._id}>
                    {namePrefix}
                    {typeof doc.name === 'string' ? doc.name : 'Unknown Request'}
                  </option>
                );
              })}
            </select>
          );
        } else if (argDefinition.type === 'boolean') {
          argInput = <input type="checkbox" checked={strValue.toLowerCase() === 'true'} onChange={handleChange} />;
        } else if (argDefinition.type === 'number') {
          const placeholder =
            typeof argDefinition.placeholder === 'string' ? argDefinition.placeholder : '';
          argInput = (<input
            type="number"
            defaultValue={strValue || '0'}
            placeholder={placeholder}
            onChange={handleChange}
          />);
        } else {
          return null;
        }
        const help =
          typeof argDefinition.help === 'string' || typeof argDefinition.help === 'function'
            ? fnOrString(argDefinition.help, activeTagData.args)
            : '';
        const displayName =
          typeof argDefinition.displayName === 'string' ||
            typeof argDefinition.displayName === 'function'
            ? fnOrString(argDefinition.displayName, activeTagData.args)
            : '';
        let validationError = '';
        const canValidate = argDefinition.type === 'string' || argDefinition.type === 'number';
        if (canValidate && typeof argDefinition.validate === 'function') {
          validationError = argDefinition.validate(strValue) || '';
        }
        const formControlClasses = classnames({
          'form-control': true,
          'form-control--thin': argDefinition.type === 'boolean',
          'form-control--outlined': argDefinition.type !== 'boolean',
        });
        return (
          <div key={index} className="form-row">
            <div className={formControlClasses}>
              <label data-arg-index={index}>
                {fnOrString(displayName, activeTagData.args)}
                {isVariable && <span className="faded space-left">(Variable)</span>}
                {help && <HelpTooltip className="space-left">{help}</HelpTooltip>}
                {validationError && <span className="font-error space-left">{validationError}</span>}
                {argInputVariable || argInput}
              </label>
            </div>
            {isVariableAllowed ? (
              <div
                className={classnames('form-control form-control--outlined width-auto', {
                  'form-control--no-label': argDefinition.type !== 'boolean',
                })}
              >
                <Dropdown right>
                  <DropdownButton className="btn btn--clicky">
                    <i className="fa fa-gear" />
                  </DropdownButton>
                  <DropdownDivider>Input Type</DropdownDivider>
                  <DropdownItem
                    onClick={() => {
                      const { activeTagData, activeTagDefinition, variables } = state;
                      if (!activeTagData || !activeTagDefinition) {
                        console.warn('Failed to change arg variable', { state: state });
                        return;
                      }
                      const argData = activeTagData.args[index];
                      const argDef = activeTagDefinition.args[index];
                      const existingValue = argData ? argData.value : '';
                      const initialType = argDef ? argDef.type : 'string';
                      const variable = variables.find(v => v.name === existingValue);
                      const value = variable ? variable.value : '';
                      return _updateArg(value, index, initialType, { quotedBy: "'" });
                    }}
                  >
                    <i className={'fa ' + (isVariable ? '' : 'fa-check')} /> Static Value
                  </DropdownItem>
                  <DropdownItem
                    onClick={() => {
                      const { activeTagData, activeTagDefinition, variables } = state;
                      if (!activeTagData || !activeTagDefinition) {
                        console.warn('Failed to change arg variable', { state: state });
                        return;
                      }
                      const argData = activeTagData.args[index];
                      const existingValue = argData ? argData.value : '';
                      const variable = variables.find(v => v.value === existingValue);
                      const firstVariable = variables.length ? variables[0].name : '';
                      const value = variable ? variable.name : firstVariable;
                      return _updateArg(value || 'my_variable', index, 'variable');
                    }}
                  >
                    <i className={'fa ' + (isVariable ? 'fa-check' : '')} /> Environment Variable
                  </DropdownItem>
                </Dropdown>
              </div>
            ) : null}
          </div>
        );
      }
      )}
      {activeTagDefinition?.actions && activeTagDefinition?.actions?.length > 0 ? (
        <div className="form-row">
          <div className="form-control">
            <label>Actions</label>
            <div className="form-row">{activeTagDefinition.actions.map(action => (
              <button
                key={action.name}
                className="btn btn--clicky btn--largest"
                type="button"
                onClick={async () => {
                  const templateTags = await getTemplateTags();
                  const activeTemplateTag = templateTags.find(({ templateTag }) => {
                    return templateTag.name === state.activeTagData?.name;
                  });
                  // @ts-expect-error -- TSCONVERSION activeTemplateTag can be undefined
                  const helperContext: pluginContexts.PluginStore = { ...pluginContexts.store.init(activeTemplateTag.plugin) };
                  await action.run(helperContext);
                  _update(
                    state.tagDefinitions,
                    state.activeTagDefinition,
                    state.activeTagData,
                    true,
                  );
                }}
              >
                {action.icon ? <i className={action.icon} /> : undefined}
                {action.name}
              </button>
            ))}</div>
          </div>
        </div>
      ) : null}

      {!activeTagDefinition && (
        <div className="form-control form-control--outlined">
          <label>
            Custom
            <input
              type="text"
              defaultValue={activeTagData.rawValue}
              onChange={event => {
                const { tagDefinitions, activeTagData, activeTagDefinition } = state;
                const tagData: NunjucksParsedTag | null = clone(activeTagData);
                if (tagData) {
                  tagData.rawValue = event.currentTarget.value;
                }
                _update(tagDefinitions, activeTagDefinition, tagData, false);
              }}
            />
          </label>
        </div>
      )}
      <hr className="hr" />
      <div className="form-row">
        <div className="form-control form-control--outlined">
          <button
            type="button"
            style={{
              zIndex: 10,
              position: 'relative',
            }}
            className="txt-sm pull-right icon inline-block"
            onClick={() => _update(
              state.tagDefinitions,
              state.activeTagDefinition,
              state.activeTagData,
              true,
            )}
          >
            refresh{' '}
            <i
              className={classnames('fa fa-refresh', {
                'fa-spin': rendering,
              })}
            />
          </button>
          <label>
            Live Preview
            {previewElement}
          </label>
        </div>
      </div>
    </div>
  );

};
