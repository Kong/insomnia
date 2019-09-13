// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import YAML from 'yaml';
import type { ApiSpec } from '../../../models/api-spec';
import * as Tree from 'react-animated-tree';

const parentTree = {
  position: 'relative',
  padding: '10px 0px 0px 15px',
  color: 'white',
  fill: 'white',
  width: '90%',
};

const childTree = {
  position: 'relative',
  padding: '0px 0px 0px 0px',
  color: 'white',
  fill: 'white',
  width: '90%',
};

const styleGet = {
  fill: '#B799F4',
  color: '#B799F4',
  fontWeight: 'bold',
};

const stylePost = {
  fill: '#59CA93',
  color: '#59CA93',
  fontWeight: 'bold',
};

const styleDelete = {
  fill: '#F8686D',
  color: '#F8686D',
  fontWeight: 'bold',
};

type Props = {|
  apiSpec: ApiSpec,
  handleJumpToLine: (vale: string, value: string | Object) => void,
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

  _handleScrollEditor(key, value) {
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
                <Tree content={i} canHide onClick={e => this._handleScrollEditor(i, value)}>
                  {parse(value)}
                </Tree>
              ))
            : null;
        }
        if (typeof v === 'object') {
          return Object.entries(v).map(([key, value]) => (
            <Tree
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
