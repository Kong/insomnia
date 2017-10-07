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

type State = {
  expandedPaths: {[string]: boolean};
};

@autobind
class JSONViewer extends React.PureComponent<Props, State> {
  constructor (props: Props) {
    super(props);
    this.state = {
      expandedPaths: {'.root': true}
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

  handleClickKey (e: MouseEvent) {
    if (e.currentTarget instanceof HTMLElement) {
      const path: string = e.currentTarget.getAttribute('data-path') || '';
      this.setState(state => ({
        expandedPaths: Object.assign({}, state.expandedPaths, {
          [path]: !this.isExpanded(path)
        })
      }));
    }
  }

  isCollapsed (path: string): boolean {
    if (!this.state.expandedPaths.hasOwnProperty(path)) {
      return false;
    }

    return !this.state.expandedPaths[path];
  }

  isExpanded (path: string): boolean {
    return !this.isCollapsed(path);
  }

  renderRows (obj: any, paths: Array<string> = []) {
    if (paths.length > 0 && this.isCollapsed(paths.join(''))) {
      return [];
    }

    const rows = [];
    const indentStyles = {paddingLeft: `${paths.length * 1.3}em`};

    if (Array.isArray(obj)) {
      for (let key = 0; key < obj.length; key++) {
        const newPaths = [...paths, `[${key}]`];
        const collapsed = this.isCollapsed(newPaths.join(''));
        const collapsable = this.isCollapsable(obj[key]);
        const rowClasses = classnames({
          'json-viewer__row': true,
          'json-viewer__row--collapsable': collapsable,
          'json-viewer__row--collapsed': collapsed
        });
        rows.push((
          <tr key={newPaths.join('')} className={rowClasses}>
            <td style={indentStyles}
                className="json-viewer__key-container"
                data-path={newPaths.join('')}
                onClick={collapsable ? this.handleClickKey : null}>
              <span className="json-viewer__icon"></span>
              <span className="json-viewer__key json-viewer__key--array">
                {key}
              </span>
            </td>
            <td>
              {this.getValue(obj[key], collapsed)}
            </td>
          </tr>
        ));

        if (!this.isCollapsed(paths.join(''))) {
          for (const row of this.renderRows(obj[key], newPaths)) {
            rows.push(row);
          }
        }
      }
    } else if (obj && typeof obj === 'object') {
      for (let key of Object.keys(obj)) {
        const newPaths = [...paths, `.${key}`];
        const collapsed = this.isCollapsed(newPaths.join(''));
        const collapsable = this.isCollapsable(obj[key]);
        const rowClasses = classnames({
          'json-viewer__row': true,
          'json-viewer__row--collapsable': collapsable,
          'json-viewer__row--collapsed': collapsed
        });
        rows.push((
          <tr key={newPaths.join('')} className={rowClasses}>
            <td style={indentStyles}
                className="json-viewer__key-container"
                data-path={newPaths.join('')}
                onClick={collapsable ? this.handleClickKey : null}>
              <span className="json-viewer__icon"></span>
              <span className="json-viewer__key json-viewer__key--object">
                {key}
              </span>
            </td>
            <td>
              {this.getValue(obj[key], collapsed)}
            </td>
          </tr>
        ));

        if (!this.isCollapsed(paths.join(''))) {
          for (const row of this.renderRows(obj[key], newPaths)) {
            rows.push(row);
          }
        }
      }
    } else if (paths.length === 0) {
      const collapsed = this.isCollapsed(paths.join(''));
      const collapsable = this.isCollapsable(obj);
      const rowClasses = classnames({
        'json-viewer__row': true,
        'json-viewer__row--collapsable': collapsable,
        'json-viewer__row--collapsed': collapsed
      });
      rows.push((
        <tr key={paths.join('')} className={rowClasses}>
          <td style={indentStyles}
              className="json-viewer__key-container"
              data-path={paths.join('')}
              onClick={collapsable ? this.handleClickKey : null}>
            <span className="json-viewer__icon"></span>
          </td>
          <td>
            {this.getValue(obj, collapsed)}
          </td>
        </tr>
      ));
    }

    return rows;
  }

  render () {
    const {
      body,
      fontSize,
      className
    } = this.props;

    let rows;
    try {
      rows = this.renderRows(JSON.parse(body.toString()));
    } catch (err) {
      rows = <tr><td>Uh Oh!</td></tr>;
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

export default JSONViewer;
