import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { createRef, PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { HandleGetRenderContext, HandleRender } from '../../../common/render';

interface Props {
  handleRender: HandleRender;
  handleGetRenderContext: HandleGetRenderContext;
  defaultValue: string;
  onChange: Function;
}

interface State {
  variables: any[];
  value: string;
  preview: string;
  error: string;
  variableSource: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class VariableEditor extends PureComponent<Props, State> {
  textAreaRef = createRef<HTMLTextAreaElement>();
  _select: HTMLSelectElement | null = null;

  constructor(props: Props) {
    super(props);
    const inner = props.defaultValue.replace(/\s*}}$/, '').replace(/^{{\s*/, '');
    this.state = {
      variables: [],
      value: `{{ ${inner} }}`,
      preview: '',
      error: '',
      variableSource: '',
    };
  }

  componentDidMount() {
    this._update(this.state.value, true);

    this._resize();
  }

  componentDidUpdate() {
    this._resize();
  }

  _handleChange(e) {
    const name = e.target.value;

    this._update(name);
  }

  _resize() {
    setTimeout(() => {
      const element = this.textAreaRef.current;
      // @ts-expect-error -- TSCONVERSION null coalesce
      element.style.cssText = 'height:auto';
      // @ts-expect-error -- TSCONVERSION null coalesce
      element.style.cssText = `height:${element.scrollHeight}px;overflow:hidden`;
    }, 200);
  }

  _setSelectRef(n: HTMLSelectElement) {
    this._select = n;
    // Let it render, then focus the input
    setTimeout(() => {
      this._select?.focus();
    }, 100);
  }

  async _update(value, noCallback = false) {
    const { handleRender } = this.props;
    const cleanedValue = value
      .replace(/^{%/, '')
      .replace(/%}$/, '')
      .replace(/^{{/, '')
      .replace(/}}$/, '')
      .trim();
    let preview = '';
    let error = '';

    try {
      preview = await handleRender(value);
    } catch (err) {
      error = err.message;
    }

    const context = await this.props.handleGetRenderContext();
    const variables = context.keys.sort((a, b) => (a.name < b.name ? -1 : 1));
    const variableSource = context.context.getKeysContext().keyContext[cleanedValue] || '';

    // Hack to skip updating if we unmounted for some reason
    if (this._select) {
      this.setState({
        preview,
        error,
        variables,
        value,
        variableSource,
      });
    }

    // Call the callback if we need to
    if (!noCallback) {
      this.props.onChange(value);
    }
  }

  render() {
    const { error, value, preview, variables, variableSource } = this.state;
    const isOther = !variables.find(v => value === `{{ ${v.name} }}`);
    return (
      <div>
        <div className="form-control form-control--outlined">
          <label>
            Environment Variable
            <select ref={this._setSelectRef} value={value} onChange={this._handleChange}>
              <option value={"{{ 'my custom template logic' | urlencode }}"}>-- Custom --</option>
              {variables.map((v, i) => (
                <option key={`${i}::${v.name}`} value={`{{ ${v.name} }}`}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {isOther && (
          <div className="form-control form-control--outlined">
            <input type="text" defaultValue={value} onChange={this._handleChange} />
          </div>
        )}
        <div className="form-control form-control--outlined">
          <label>
            Live Preview {variableSource && ` - {source: ${variableSource} }`}
            {error ? (
              <textarea className="danger" value={error || 'Error'} readOnly />
            ) : (
              <textarea ref={this.textAreaRef} value={preview || ''} readOnly />
            )}
          </label>
        </div>
      </div>
    );
  }
}
