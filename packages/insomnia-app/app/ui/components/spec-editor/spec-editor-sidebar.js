// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import YAML from 'yaml';
import type { ApiSpec } from '../../../models/api-spec';
import SpecEditorSidebarItem from './spec-editor-sidebar-item';

type Props = {|
  apiSpec: ApiSpec,
  handleJumpToLine: (value: string, value: string | Object) => void,
|};

type State = {|
  parsedSpec: Object | null,
|};

@autobind
class SpecEditorSidebar extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      parsedSpec: null,
    };
  }

  _refreshSpec(apiSpec: ApiSpec) {
    let spec;
    try {
      spec = apiSpec.type === 'json' ? JSON.parse(apiSpec.contents) : YAML.parse(apiSpec.contents);
    } catch (err) {
      console.log('[spec-sidebar] Failed to parse', err.message);
      return;
    }

    this.setState({ parsedSpec: spec });
  }

  _handleScrollEditor(key: string, value: string) {
    const { handleJumpToLine } = this.props;
    handleJumpToLine(key, value);
  }

  componentWillReceiveProps(nextProps: Props) {
    this._refreshSpec(nextProps.apiSpec);
  }

  componentDidMount() {
    this._refreshSpec(this.props.apiSpec);
  }

  render() {
    const { parsedSpec } = this.state;

    // Not loaded yet
    if (!parsedSpec) {
      return null;
    }

    const parse = (v: any) => {
      const t = Object.prototype.toString.call(v);

      if (t === '[object Array]') {
        return (
          <ul>
            {v.map((value, i) => (
              <SpecEditorSidebarItem
                key={i}
                name={i + ''}
                onClick={() => this._handleScrollEditor(i + '', value)}>
                {parse(value)}
              </SpecEditorSidebarItem>
            ))}
          </ul>
        );
      } else if (t === '[object Object]') {
        return (
          <ul>
            {Object.entries(v).map(([key, value]) => (
              <SpecEditorSidebarItem
                key={key}
                name={key}
                onClick={() => this._handleScrollEditor(key, (value: any))}>
                {parse(value)}
              </SpecEditorSidebarItem>
            ))}
          </ul>
        );
      }
      return null;
    };

    return (
      <div className="spec-editor-sidebar">
        {this.state.parsedSpec ? parse(this.state.parsedSpec) : ''}
      </div>
    );
  }
}

export default SpecEditorSidebar;
