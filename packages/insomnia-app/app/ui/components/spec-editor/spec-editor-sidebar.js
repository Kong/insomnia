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
  handleJumpToLine: (line: number) => void,
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

  _handleScrollEditor() {
    const { handleJumpToLine } = this.props;
    handleJumpToLine(10);
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

    let title = (
      <React.Fragment>
        Missing <code>info.title</code>
      </React.Fragment>
    );
    if (parsedSpec.info && parsedSpec.info.title) {
      title = parsedSpec.info.title;
    }

    return (
      <React.Fragment>
        <Tree content="openapi" style={parentTree} />
        <Tree content="info" style={parentTree} canHide onClick={this._handleScrollEditor} />
        <Tree content="servers" style={parentTree} />
        <Tree content="paths" style={parentTree}>
          <Tree content="pets">
            <Tree content="get" style={styleGet} />
            <Tree content="post" style={stylePost} />
          </Tree>
          <Tree content="pets/{id}">
            <Tree content="get" style={styleGet} />
            <Tree content="delete" style={styleDelete} />
          </Tree>
        </Tree>
        <Tree content="components" style={parentTree}>
          <Tree content="links">
            <Tree content="someLink" style={childTree} />
            <Tree content="someOtherLink" style={childTree} />
          </Tree>
          <Tree content="schemas">
            <Tree content="Pet" style={childTree} />
            <Tree content="NewPet" style={childTree} />
            <Tree content="Error" style={childTree} />
          </Tree>
        </Tree>
        {/*
          <button onClick={this._handleScrollEditor} className="btn btn--clicky-small">
          Scroll to 10
          </button>
          */}
      </React.Fragment>
    );
  }
}

export default SpecEditorSidebar;
