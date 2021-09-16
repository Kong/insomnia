import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import clone from 'clone';
import React, { PureComponent, ReactNode } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
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
import type { PluginArgumentEnumOption } from '../../../templating/extensions/index';
import type {
  NunjucksActionTag,
  NunjucksParsedTag,
  NunjucksParsedTagArg,
} from '../../../templating/utils';
import * as templateUtils from '../../../templating/utils';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import FileInputButton from '../base/file-input-button';
import HelpTooltip from '../help-tooltip';

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

@autoBindMethodsForReact(AUTOBIND_CFG)
class TagEditor extends PureComponent<Props, State> {
  _select: HTMLSelectElement | null = null;

  state: State = {
    activeTagData: null,
    activeTagDefinition: null,
    tagDefinitions: [],
    loadingDocs: false,
    allDocs: {},
    rendering: true,
    preview: '',
    error: '',
    variables: [],
  };

  async load() {
    const activeTagData = templateUtils.tokenizeTag(this.props.defaultValue);
    const tagDefinitions = await templating.getTagDefinitions();
    const activeTagDefinition: NunjucksParsedTag | null =
      tagDefinitions.find(d => d.name === activeTagData.name) || null;

    // Edit tags raw that we don't know about
    if (!activeTagDefinition) {
      activeTagData.rawValue = this.props.defaultValue;
    }

    // Fix strings: arg.value expects an escaped value (based on _updateArg logic)
    for (const arg of activeTagData.args) {
      if (typeof arg.value === 'string') {
        arg.value = this._escapeStringArgs(arg.value);
      }
    }

    await Promise.all([
      this._refreshModels(this.props.workspace),
      this._update(tagDefinitions, activeTagDefinition, activeTagData, true),
    ]);
  }

  async loadVariables() {
    const context = await this.props.handleGetRenderContext();
    const variables = context.keys;
    this.setState({
      variables,
    });
  }

  componentDidMount() {
    this.load();
    this.loadVariables();
  }

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    const { workspace } = nextProps;

    if (this.props.workspace._id !== workspace._id) {
      this._refreshModels(workspace);
    }
  }

  async _handleRefresh() {
    await this._update(
      this.state.tagDefinitions,
      this.state.activeTagDefinition,
      this.state.activeTagData,
      true,
    );
  }

  _sortRequests(_models: (Request | RequestGroup)[], parentId: string) {
    let sortedModels: (Request | RequestGroup)[] = [];

    _models
      .filter(model => model.parentId === parentId)
      .sort(metaSortKeySort)
      .forEach(model => {
        if (isRequest(model)) sortedModels.push(model);
        if (isRequestGroup(model)) { sortedModels = sortedModels.concat(this._sortRequests(_models, model._id)); }
      });

    return sortedModels;
  }

  async _refreshModels(workspace: Workspace) {
    this.setState({
      loadingDocs: true,
    });
    const allDocs = {};

    for (const type of models.types()) {
      allDocs[type] = [];
    }

    for (const doc of await db.withDescendants(workspace, models.request.type)) {
      allDocs[doc.type].push(doc);
    }

    const requests = allDocs[models.request.type] || [];
    const requestGroups = allDocs[models.requestGroup.type] || [];

    const sortedReqs = this._sortRequests(requests.concat(requestGroups), this.props.workspace._id);

    allDocs[models.request.type] = sortedReqs;
    this.setState({
      allDocs,
      loadingDocs: false,
    });
  }

  async _updateArg(
    argValue: string | number | boolean,
    argIndex: number,
    forceNewType: string | null = null,
    patch: Record<string, any> = {},
  ) {
    const { tagDefinitions, activeTagData, activeTagDefinition } = this.state;

    if (!activeTagData) {
      console.warn('No active tag data to update', {
        state: this.state,
      });
      return;
    }

    if (!activeTagDefinition) {
      console.warn('No active tag definition to update', {
        state: this.state,
      });
      return;
    }

    // Fix strings
    if (typeof argValue === 'string') {
      argValue = this._escapeStringArgs(argValue);
    }

    // Ensure all arguments exist
    const defaultArgs = TagEditor._getDefaultTagData(activeTagDefinition).args;

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
      Object.assign(
        argData as any,
        {
          type: forceNewType,
        },
        patch,
      );
    }

    await this._update(tagDefinitions, activeTagDefinition, tagData, false);
  }

  async _handleChangeArgVariable(options: { argIndex: number; variable: boolean }) {
    const { variable, argIndex } = options;
    const { activeTagData, activeTagDefinition, variables } = this.state;

    if (!activeTagData || !activeTagDefinition) {
      console.warn('Failed to change arg variable', {
        state: this.state,
      });
      return;
    }

    const argData = activeTagData.args[argIndex];
    const argDef = activeTagDefinition.args[argIndex];
    const existingValue = argData ? argData.value : '';

    if (variable) {
      const variable = variables.find(v => v.value === existingValue);
      const firstVariable = variables.length ? variables[0].name : '';
      const value = variable ? variable.name : firstVariable;
      return this._updateArg(value || 'my_variable', argIndex, 'variable');
    } else {
      const initialType = argDef ? argDef.type : 'string';
      const variable = variables.find(v => v.name === existingValue);
      const value = variable ? variable.value : '';
      return this._updateArg(value, argIndex, initialType, {
        quotedBy: "'",
      });
    }
  }

  _handleChangeFile(path: string, argIndex: number) {
    return this._updateArg(path, argIndex);
  }

  _handleChange(e: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>) {
    const parent = e.currentTarget.parentNode;
    let argIndex = -1;

    if (parent instanceof HTMLElement) {
      const index = parent?.getAttribute('data-arg-index');
      argIndex = typeof index === 'string' ? parseInt(index, 10) : -1;
    }

    // Handle special types
    if (e.currentTarget.getAttribute('data-encoding') === 'base64') {
      return this._updateArg(
        templateUtils.encodeEncoding(e.currentTarget.value, 'base64'),
        argIndex,
      );
    }

    // Handle normal types
    if (e.currentTarget.type === 'number') {
      return this._updateArg(parseFloat(e.currentTarget.value), argIndex);
    } else if (e.currentTarget.type === 'checkbox') {
      // @ts-expect-error -- TSCONVERSION .checked doesn't exist on HTMLSelectElement
      return this._updateArg(e.currentTarget.checked, argIndex);
    } else {
      return this._updateArg(e.currentTarget.value, argIndex);
    }
  }

  _handleChangeCustomArg(e: React.SyntheticEvent<HTMLInputElement>) {
    const { tagDefinitions, activeTagData, activeTagDefinition } = this.state;
    const tagData: NunjucksParsedTag | null = clone(activeTagData);

    if (tagData) {
      tagData.rawValue = e.currentTarget.value;
    }

    this._update(tagDefinitions, activeTagDefinition, tagData, false);
  }

  async _handleChangeTag(e: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>) {
    const name = e.currentTarget.value;
    const tagDefinitions = await templating.getTagDefinitions();
    const tagDefinition = tagDefinitions.find(d => d.name === name) || null;

    this._update(this.state.tagDefinitions, tagDefinition, null, false);
  }

  async _handleActionClick(action: NunjucksActionTag) {
    const templateTags = await getTemplateTags();
    const activeTemplateTag = templateTags.find(({ templateTag }) => {
      return templateTag.name === this.state.activeTagData?.name;
    });
    // @ts-expect-error -- TSCONVERSION activeTemplateTag can be undefined
    const helperContext: pluginContexts.PluginStore = { ...pluginContexts.store.init(activeTemplateTag.plugin) };
    await action.run(helperContext);
    return this._handleRefresh();
  }

  _setSelectRef(n: HTMLSelectElement) {
    this._select = n;
    // Let it render, then focus the input
    setTimeout(() => {
      if (this._select instanceof HTMLSelectElement) {
        this._select.focus();
      }
    }, 100);
  }

  _escapeStringArgs(value: string) {
    return value.replace(/\\/g, '\\\\');
  }

  _unescapeStringArgs(value: string) {
    return value.replace(/\\\\/g, '\\');
  }

  static _getDefaultTagData(tagDefinition: NunjucksParsedTag): NunjucksParsedTag {
    const defaultFill: string = templateUtils.getDefaultFill(
      tagDefinition.name,
      tagDefinition.args,
    );
    return templateUtils.tokenizeTag(defaultFill);
  }

  async _update(
    tagDefinitions: NunjucksParsedTag[],
    tagDefinition: NunjucksParsedTag | null,
    tagData: NunjucksParsedTag | null,
    noCallback = false,
  ) {
    const { handleRender } = this.props;
    this.setState({
      rendering: true,
    });
    // Start render loader
    const start = Date.now();
    this.setState({
      rendering: true,
    });
    let preview = '';
    let error = '';
    let activeTagData: NunjucksParsedTag | null = tagData;

    if (!activeTagData && tagDefinition) {
      activeTagData = TagEditor._getDefaultTagData(tagDefinition);
    } else if (!activeTagData && !tagDefinition && this.state.activeTagData) {
      activeTagData = {
        name: 'custom',
        displayName: 'Custom',
        args: [],
        rawValue: templateUtils.unTokenizeTag(this.state.activeTagData),
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

    this.setState({
      tagDefinitions,
      activeTagData,
      error,
      activeTagDefinition: tagDefinition,
    });

    // Call the callback if we need to
    if (!noCallback) {
      this.props.onChange(template);
    }

    // Make rendering take at least this long so we can see a spinner
    await delay(300 - (Date.now() - start));
    this.setState({
      rendering: false,
      preview,
    });
  }

  renderArgVariable(path: string) {
    const { variables } = this.state;

    if (variables.length === 0) {
      return (
        <select disabled>
          <option>-- No Environment Variables Found --</option>
        </select>
      );
    }

    return (
      <select value={path || ''} onChange={this._handleChange}>
        <option key="n/a" value="NO_VARIABLE">
          -- Select Variable --
        </option>
        {variables.map((v, i) => (
          <option key={`${i}::${v.name}`} value={v.name}>
            {v.name}
          </option>
        ))}
      </select>
    );
  }

  renderArgString(value: string, placeholder: string, encoding: string) {
    return (
      <input
        type="text"
        defaultValue={this._unescapeStringArgs(value) || ''}
        placeholder={placeholder}
        onChange={this._handleChange}
        data-encoding={encoding || 'utf8'}
      />
    );
  }

  renderArgNumber(value: string, placeholder: string) {
    return (
      <input
        type="number"
        defaultValue={value || '0'}
        placeholder={placeholder}
        onChange={this._handleChange}
      />
    );
  }

  renderArgBoolean(checked: boolean) {
    return <input type="checkbox" checked={checked} onChange={this._handleChange} />;
  }

  renderArgFile(
    value: string,
    argIndex: number,
    itemTypes?: ('file' | 'directory')[],
    extensions?: string[],
  ) {
    return (
      <FileInputButton
        showFileIcon
        showFileName
        className="btn btn--clicky btn--super-compact"
        onChange={path => this._handleChangeFile(path, argIndex)}
        path={this._unescapeStringArgs(value)}
        itemtypes={itemTypes}
        extensions={extensions}
      />
    );
  }

  renderArgEnum(value: string, options: PluginArgumentEnumOption[]) {
    const argDatas = this.state.activeTagData ? this.state.activeTagData.args : [];
    let unsetOption: ReactNode = null;

    if (!options.find(o => o.value === value)) {
      unsetOption = <option value="">-- Select Option --</option>;
    }

    return (
      <select value={value} onChange={this._handleChange}>
        {unsetOption}
        {options.map(option => {
          let label: string;
          const { description } = option;

          if (description) {
            label = `${fnOrString(option.displayName, argDatas)} – ${description}`;
          } else {
            label = fnOrString(option.displayName, argDatas);
          }

          return (
            // @ts-expect-error -- TSCONVERSION boolean not accepted by option
            <option key={option.value.toString()} value={option.value}>
              {label}
            </option>
          );
        })}
      </select>
    );
  }

  resolveRequestGroupPrefix(requestGroupId: string, allRequestGroups: any[]) {
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

  renderArgModel(value: string, modelType: string) {
    const { allDocs, loadingDocs } = this.state;
    const docs = allDocs[modelType] || [];
    const id = value || 'n/a';

    if (loadingDocs) {
      return (
        <select disabled={loadingDocs}>
          <option>Loading...</option>
        </select>
      );
    }

    return (
      <select value={id} onChange={this._handleChange}>
        <option value="n/a">-- Select Item --</option>
        {docs.map((doc: any) => {
          let namePrefix: string | null = null;

          // Show parent folder with name if it's a request
          if (isRequest(doc)) {
            const requests = allDocs[models.request.type] || [];
            const request: any = requests.find(r => r._id === doc._id);
            const method = request && typeof request.method === 'string' ? request.method : 'GET';
            const parentId = request ? request.parentId : 'n/a';
            const allRequestGroups = allDocs[models.requestGroup.type] || [];
            const requestGroupPrefix = this.resolveRequestGroupPrefix(parentId, allRequestGroups);
            namePrefix = `${requestGroupPrefix + method} `;
          }

          const docName = typeof doc.name === 'string' ? doc.name : 'Unknown Request';
          return (
            <option key={doc._id} value={doc._id}>
              {namePrefix}
              {docName}
            </option>
          );
        })}
      </select>
    );
  }

  renderArg(
    argDefinition: NunjucksParsedTagArg,
    argDatas: NunjucksParsedTagArg[],
    argIndex: number,
  ) {
    // Decide whether or not to show it
    if (typeof argDefinition.hide === 'function' && argDefinition.hide(argDatas)) {
      return null;
    }

    let argData: NunjucksParsedTagArg;

    if (argIndex < argDatas.length) {
      argData = argDatas[argIndex];
    } else if (this.state.activeTagDefinition) {
      const defaultTagData = TagEditor._getDefaultTagData(this.state.activeTagDefinition);

      argData = defaultTagData.args[argIndex];
    } else {
      return null;
    }

    if (!argData) {
      console.error('Failed to find argument to set default', {
        argDefinition,
        argDatas,
        argIndex,
      });
      return null;
    }

    const strValue = templateUtils.decodeEncoding(argData.value.toString());
    const isVariable = argData.type === 'variable';
    const argInputVariable = isVariable ? this.renderArgVariable(strValue) : null;
    let argInput;
    let isVariableAllowed = true;

    if (argDefinition.type === 'string') {
      const placeholder =
        typeof argDefinition.placeholder === 'string' ? argDefinition.placeholder : '';
      const encoding = argDefinition.encoding || 'utf8';
      argInput = this.renderArgString(strValue, placeholder, encoding);
    } else if (argDefinition.type === 'enum') {
      const { options } = argDefinition;
      argInput = this.renderArgEnum(strValue, options || []);
    } else if (argDefinition.type === 'file') {
      argInput = this.renderArgFile(
        strValue,
        argIndex,
        argDefinition.itemTypes,
        argDefinition.extensions,
      );
    } else if (argDefinition.type === 'model') {
      isVariableAllowed = false;
      const model = typeof argDefinition.model === 'string' ? argDefinition.model : 'unknown';
      const modelId = typeof strValue === 'string' ? strValue : 'unknown';
      argInput = this.renderArgModel(modelId, model);
    } else if (argDefinition.type === 'boolean') {
      argInput = this.renderArgBoolean(strValue.toLowerCase() === 'true');
    } else if (argDefinition.type === 'number') {
      const placeholder =
        typeof argDefinition.placeholder === 'string' ? argDefinition.placeholder : '';
      argInput = this.renderArgNumber(strValue, placeholder || '');
    } else {
      return null;
    }

    const help =
      typeof argDefinition.help === 'string' || typeof argDefinition.help === 'function'
        ? fnOrString(argDefinition.help, argDatas)
        : '';
    const displayName =
      typeof argDefinition.displayName === 'string' ||
      typeof argDefinition.displayName === 'function'
        ? fnOrString(argDefinition.displayName, argDatas)
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
      <div key={argIndex} className="form-row">
        <div className={formControlClasses}>
          <label data-arg-index={argIndex}>
            {fnOrString(displayName, argDatas)}
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
                value={{
                  variable: false,
                  argIndex,
                }}
                onClick={this._handleChangeArgVariable}
              >
                <i className={'fa ' + (isVariable ? '' : 'fa-check')} /> Static Value
              </DropdownItem>
              <DropdownItem
                value={{
                  variable: true,
                  argIndex,
                }}
                onClick={this._handleChangeArgVariable}
              >
                <i className={'fa ' + (isVariable ? 'fa-check' : '')} /> Environment Variable
              </DropdownItem>
            </Dropdown>
          </div>
        ) : null}
      </div>
    );
  }

  renderActions(actions: NunjucksActionTag[] = []) {
    return (
      <div className="form-row">
        <div className="form-control">
          <label>Actions</label>
          <div className="form-row">{actions.map(this.renderAction)}</div>
        </div>
      </div>
    );
  }

  renderAction(action: NunjucksActionTag) {
    const name = action.name;
    const icon = action.icon ? <i className={action.icon} /> : undefined;
    return (
      <button
        key={name}
        className="btn btn--clicky btn--largest"
        type="button"
        onClick={() => this._handleActionClick(action)}
      >
        {icon}
        {name}
      </button>
    );
  }

  render() {
    const { error, preview, activeTagDefinition, activeTagData, rendering } = this.state;

    if (!activeTagData) {
      return null;
    }

    let finalPreview = preview;

    if (activeTagDefinition?.disablePreview) {
      finalPreview = activeTagDefinition.disablePreview(activeTagData.args)
        ? preview.replace(/./g, '*')
        : preview;
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
              ref={this._setSelectRef}
              onChange={this._handleChangeTag}
              value={activeTagDefinition ? activeTagDefinition.name : ''}
            >
              {this.state.tagDefinitions.map((tagDefinition, i) => (
                <option key={`${i}::${tagDefinition.name}`} value={tagDefinition.name}>
                  {tagDefinition.displayName} – {tagDefinition.description}
                </option>
              ))}
              <option value="custom">-- Custom --</option>
            </select>
          </label>
        </div>
        {activeTagDefinition?.args.map((argDefinition: NunjucksParsedTagArg, index) =>
          this.renderArg(argDefinition, activeTagData.args, index),
        )}

        {activeTagDefinition?.actions && activeTagDefinition?.actions?.length > 0 ? (
          this.renderActions(activeTagDefinition.actions)
        ) : null}

        {!activeTagDefinition && (
          <div className="form-control form-control--outlined">
            <label>
              Custom
              <input
                type="text"
                defaultValue={activeTagData.rawValue}
                onChange={this._handleChangeCustomArg}
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
              onClick={this._handleRefresh}
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
  }
}

export default TagEditor;
