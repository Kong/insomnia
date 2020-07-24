// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import YAML from 'yaml';
import YAMLSourceMap from 'yaml-source-map';
import { Sidebar } from 'insomnia-components';
import type { ApiSpec } from '../../../models/api-spec';
import { trackEvent } from '../../../common/analytics';

type Props = {|
  apiSpec: ApiSpec,
  handleSetSelection: (chStart: number, chEnd: number, lineStart: number, lineEnd: number) => void,
|};

type State = {|
  error: string,
|};

@autobind
class SpecEditorSidebar extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      error: '',
    };
  }

  _handleScrollEditor(pos: {
    start: { line: number, col: number },
    end: { line: number, col: number },
  }) {
    trackEvent('Spec Sidebar', 'Navigate');
    const { handleSetSelection } = this.props;

    // NOTE: We're subtracting 1 from everything because YAML CST uses
    //   1-based indexing and we use 0-based.
    handleSetSelection(pos.start.col - 1, pos.end.col - 1, pos.start.line - 1, pos.end.line - 1);
  }

  componentDidUpdate() {
    const { apiSpec } = this.props;
    const { error } = this.state;

    if (apiSpec.type === 'json') {
      this.setState({
        error:
          'Tree navigation is not yet supported for JSON-formatted spec ' +
          'files. Please use YAML instead.',
      });
    } else if (error) {
      this.setState({ error: '' });
    }
  }

  render() {
    const { error } = this.state;

    if (error) {
      return <p className="notice error margin-sm">{error}</p>;
    }

    const { apiSpec } = this.props;
    const specCst = YAML.parseCST(apiSpec.contents);

    // console.log(apiSpec);

    let specJSON = {};

    if (apiSpec.contentType === 'yaml') {
      specJSON = YAML.parse(apiSpec.contents);
    }

    console.log(specJSON);

    if (!specCst) {
      return null;
    }

    const [document] = specCst;

    if (!document.contents) {
      return null;
    }

    const sourceMap = new YAMLSourceMap();
    const specMap = sourceMap.index(
      YAML.parseDocument(apiSpec.contents, { keepCstNodes: true /* must specify this */ }),
    );

    let itemPath = [];
    const scrollPosition = {
      start: {
        line: 0,
        col: 0,
      },
      end: {
        line: 0,
        col: 0,
      },
    };

    const _handleItemClick = (section, item) => {
      itemPath = [section];
      itemPath.push.apply(itemPath, item);
      const itemPosition = sourceMap.lookup(itemPath, specMap);
      // Hack for servers array due to offest in YAML CST mapping
      if (section === 'servers') {
        scrollPosition.start.line = itemPosition.start.line;
      } else {
        scrollPosition.start.line = itemPosition.start.line - 1;
      }
      scrollPosition.end.line = scrollPosition.start.line;
      scrollPosition.end.col = 200;

      // Scroll to selection
      this._handleScrollEditor(scrollPosition);
    };

    return (
      <div className="spec-editor-sidebar">
        <Sidebar jsonData={specJSON} onClick={_handleItemClick} />
      </div>
    );
  }
}

export default SpecEditorSidebar;
