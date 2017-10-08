// @flow
import React from 'react';
import classnames from 'classnames';
import autobind from 'autobind-decorator';

// const PAGE_SIZE = 10;
const MAX_VALUE_LENGTH = 50;

type Props = {
  body: Buffer,
  fontSize: number,

  // Optional
  className?: string,
};

@autobind
class JSONViewer extends React.PureComponent<Props> {
  render () {
    const {
      body,
      fontSize,
      className
    } = this.props;

    let rows;
    try {
      rows = (
        <JSONViewerObj
          value={JSON.parse(body.toString())}
          paths={[]}
        />
      );
    } catch (err) {
      rows = <tr>
        <td>Uh Oh!</td>
      </tr>;
    }

    return (
      <div className={classnames(className, 'json-viewer')} style={{fontSize}}>
        <table>
          <tbody>{rows}</tbody>
        </table>
      </div>
    );
  }
}

type Props2 = {
  paths: Array<string>,
  value: any,
  label?: string | number,
  hide?: boolean
};

type State2 = {
  expanded: boolean,
  hasBeenExpanded: boolean
};

@autobind
class JSONViewerObj extends React.PureComponent<Props2, State2> {
  constructor (props: Props2) {
    super(props);
    const {paths} = props;
    this.state = {
      expanded: paths.length === 0,
      hasBeenExpanded: false
    };
  }

  getType (value: any) {
    const type = Object.prototype.toString.call(value);
    switch (type) {
      case '[object Boolean]':
        return 'boolean';
      case '[object Object]':
        return 'object';
      case '[object Array]':
        return 'array';
      case '[object Number]':
        return 'number';
      case '[object String]':
        return 'string';
      case '[object Null]':
        return 'null';
      default:
        return 'unknown';
    }
  }

  isCollapsable (obj: any): boolean {
    switch (this.getType(obj)) {
      case 'string':
        return obj.length > MAX_VALUE_LENGTH;
      case 'array':
        return obj.length > 0;
      case 'object':
        return Object.keys(obj).length > 0;
      default:
        return false;
    }
  }

  getValue (obj: any, collapsed: boolean) {
    let n;
    let comment;
    let abbr;
    let hasChildren = false;

    if (Array.isArray(obj)) {
      hasChildren = true;
      n = obj.length;
      comment = n > 0 ? `// ${n} item${n === 1 ? '' : 's'}` : '';
      abbr = collapsed && n > 0 ? `[…]` : '[]';
    } else if (obj && typeof obj === 'object') {
      hasChildren = true;
      n = Object.keys(obj).length;
      comment = n > 0 ? `// ${n} key${n === 1 ? '' : 's'}` : '';
      abbr = collapsed && n > 0 ? `{…}` : '{}';
    }

    if (hasChildren) {
      if (n === 0) {
        return abbr;
      }

      return collapsed
        ? <span>{abbr} <span className="json-viewer__type-comment">{comment}</span></span>
        : null;
    }

    const strObj: string = `${obj}`;
    let displayValue = strObj;

    let collapsable = strObj.length > MAX_VALUE_LENGTH;
    if (collapsable && collapsed) {
      const halfOfMax = Math.floor(MAX_VALUE_LENGTH / 2) - 5;
      const start = strObj.slice(0, halfOfMax);
      const end = strObj.slice(strObj.length - halfOfMax);
      displayValue = `${start}…${end}`;
    }

    return (
      <span className={`json-viewer__value json-viewer__type-${this.getType(obj)}`}>
        {displayValue}
      </span>
    );
  }

  handleClickKey () {
    this.setState(state => ({
      expanded: !state.expanded,
      hasBeenExpanded: true
    }));
  }

  render () {
    const {label, value, paths, hide} = this.props;
    const {expanded, hasBeenExpanded} = this.state;

    const collapsable = this.isCollapsable(value);
    const collapsed = !expanded;
    const indentStyles = {paddingLeft: `${(paths.length - 1) * 1.3}em`};

    const rowClasses = classnames({
      'hide': hide,
      'json-viewer__row': true,
      'json-viewer__row--collapsable': collapsable,
      'json-viewer__row--collapsed': collapsed
    });

    const rows = [];
    if (Array.isArray(value)) {
      if (label !== undefined) {
        rows.push((
          <tr key={paths.join('')} className={rowClasses}>
            <td style={indentStyles}
                className="json-viewer__key-container"
                onClick={collapsable ? this.handleClickKey : null}>
              <span className="json-viewer__icon"></span>
              <span className="json-viewer__key json-viewer__key--array">
            {label}
          </span>
            </td>
            <td>
              {this.getValue(value, collapsed)}
            </td>
          </tr>
        ));
      }

      if (!collapsed || hasBeenExpanded) {
        for (let key = 0; key < value.length; key++) {
          const newPaths = [...paths, `[${key}]`];
          rows.push((
            <JSONViewerObj
              hide={hide || collapsed}
              key={key}
              label={key}
              value={value[key]}
              paths={newPaths}
            />
          ));
        }
      }
    } else if (value && typeof value === 'object') {
      if (label !== undefined) {
        rows.push((
          <tr key={paths.join('')} className={rowClasses}>
            <td style={indentStyles}
                className="json-viewer__key-container"
                onClick={collapsable ? this.handleClickKey : null}>
              <span className="json-viewer__icon"></span>
              <span className="json-viewer__key json-viewer__key--array">
              {label}
            </span>
            </td>
            <td>
              {this.getValue(value, collapsed)}
            </td>
          </tr>
        ));
      }

      if (!collapsed || hasBeenExpanded) {
        for (let key of Object.keys(value)) {
          const newPaths = [...paths, `.${key}`];
          rows.push((
            <JSONViewerObj
              hide={hide || collapsed}
              key={key}
              label={key}
              value={value[key]}
              paths={newPaths}
            />
          ));
        }
      }
    } else {
      rows.push((
        <tr key={paths.join('')} className={rowClasses}>
          <td style={indentStyles}
              className="json-viewer__key-container"
              onClick={collapsable ? this.handleClickKey : null}>
            <span className="json-viewer__icon"></span>
            {paths.length > 0 ? (
              <span className="json-viewer__key json-viewer__key--array">
                {label}
              </span>
            ) : null}
          </td>
          <td>
            {this.getValue(value, collapsed)}
          </td>
        </tr>
      ));
    }

    return rows;
  }
}

export default JSONViewer;
