// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import YAML from 'yaml';
import type { ApiSpec } from '../../../models/api-spec';
import * as Tree from 'react-animated-tree';

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
    console.log(key, value);
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

    if (!parsedSpec) {
      // Not loaded yet
      return 'Loading...';
    }
    const treeStyles = {
      color: 'white',
      fill: 'white',
      width: '100%',
    };

    const parse = v => {
      if (typeof v === 'string' || typeof v === 'number' || v === null) {
        // return <Tree content={v} style={{color: '#63b1de'}} canHide onClick={(e) => handleClick(v)}/>
      } else {
        if (v instanceof Array) {
          return v.length > 0
            ? v.map((value, i) => (
                <Tree
                  key={i}
                  content={i}
                  canHide
                  onClick={e => this._handleScrollEditor(i + '', value)}>
                  {parse(value)}
                </Tree>
              ))
            : null;
        }
        if (typeof v === 'object') {
          return Object.entries(v).map(([key, value]) => (
            <Tree
              key={key}
              content={key}
              style={treeStyles}
              canHide
              onClick={e => this._handleScrollEditor(key, value)}>
              {parse(value)}
            </Tree>
          ));
        }
      }
    };

    console.log(typeof parsedSpec); // Object
    console.dir(parsedSpec);
    return (
      <React.Fragment>
        <div>{this.state.parsedSpec ? parse(this.state.parsedSpec) : ''}</div>
      </React.Fragment>
    );
  }
}

export default SpecEditorSidebar;
