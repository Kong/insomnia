// @flow
import React from 'react';
import classnames from 'classnames';
import autobind from 'autobind-decorator';
import {isDevelopment} from '../../common/constants';

const PAGE_SIZE = isDevelopment() ? 50 : 500;
const MAX_PAGES = isDevelopment() ? 100 : 10000;
const MAX_VALUE_LENGTH = 75;

type Props = {
  body: Buffer,
  fontSize: number,

  // Optional
  className?: string,
};

@autobind
class JSONViewer extends React.PureComponent<Props> {
  viewer: ?HTMLDivElement;
  largestWidth: ?number;

  setRef (n: HTMLDivElement | null) {
    this.viewer = n;
  }

  setMinWidth () {
    if (!this.viewer) {
      return;
    }

    const td = this.viewer.querySelector('td');
    if (!td) {
      return;
    }

    const width = td.getBoundingClientRect().width;
    if (!this.largestWidth || width > this.largestWidth) {
      this.largestWidth = width;
      td.style.minWidth = `${this.largestWidth}px`;
      td.style.boxSizing = 'border-box';
    }
  }

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
          expandChildren
          onExpand={this.setMinWidth}
          value={{root: JSON.parse(body.toString())}}
          indent={0}
          paths={[]}
        />
      );
    } catch (err) {
      rows = <tr>
        <td>Uh Oh!</td>
      </tr>;
    }

    return (
      <div ref={this.setRef} className={classnames(className, 'json-viewer')} style={{fontSize}}>
        <table>
          <tbody>{rows}</tbody>
        </table>
      </div>
    );
  }
}

type Props2 = {|
  paths: Array<string>,
  value: any,
  onExpand: Function,
  indent: number,
  expandChildren?: boolean,
  expanded?: boolean,
  label?: string | number,
  hide?: boolean
|};

type State2 = {|
  expanded: boolean,
  hasBeenExpanded: boolean,
  pages: {[string]: boolean}
|};

@autobind
class JSONViewerObj extends React.PureComponent<Props2, State2> {
  constructor (props: Props2) {
    super(props);
    const {paths, expanded} = props;
    this.state = {
      expanded: expanded || paths.length === 0,
      hasBeenExpanded: false,
      pages: {}
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
      comment = n > 0 ? `${n} item${n === 1 ? '' : 's'}` : '';
      abbr = collapsed && n > 0 ? `[…]` : '[]';
    } else if (obj && typeof obj === 'object') {
      hasChildren = true;
      n = Object.keys(obj).length;
      comment = n > 0 ? `${n} key${n === 1 ? '' : 's'}` : '';
      abbr = collapsed && n > 0 ? `{…}` : '{}';
    }

    if (hasChildren) {
      if (n === 0) {
        return (
          <td>
            {abbr}
          </td>
        );
      } else if (collapsed) {
        return (
          <td>
            {abbr} <span className="json-viewer__type-comment">{comment}</span>
          </td>
        );
      } else {
        return null;
      }
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
      <td className={`json-viewer__value json-viewer__type-${this.getType(obj)}`}>
        {displayValue}
      </td>
    );
  }

  componentDidUpdate () {
    this.props.onExpand();
  }

  handleClickKey () {
    this.setState(state => ({
      expanded: !state.expanded,
      hasBeenExpanded: true
    }));
  }

  handleTogglePage (page: number) {
    this.setState(state => {
      const visible = !state.pages[page.toString()];
      const pages = Object.assign({}, state.pages, {[page]: visible});
      return {pages};
    });
  }

  render () {
    const {label, value, paths, hide, onExpand, indent, expandChildren} = this.props;
    const {expanded, hasBeenExpanded, pages} = this.state;

    const collapsable = this.isCollapsable(value);
    const collapsed = !expanded;

    // NOTE: Subtract 1 from indent because indent is applied on the child, which gets indent + 1
    const getIndentStyles = indent => ({paddingLeft: `${indent - 1}em`});

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
            <td style={getIndentStyles(indent)}
                className="json-viewer__key-container"
                onClick={collapsable ? this.handleClickKey : null}>
              <span className="json-viewer__icon"></span>
              <span className="json-viewer__key json-viewer__key--array">{label}</span>
            </td>
            {this.getValue(value, collapsed)}
          </tr>
        ));
      }

      if (!collapsed || hasBeenExpanded) {
        const hasMultiplePages = Array.isArray(value) && value.length > PAGE_SIZE;
        const maxItemsToShow = MAX_PAGES * PAGE_SIZE;
        const totalPages = Math.ceil(value.length / PAGE_SIZE);
        for (let page = 0; page < totalPages; page++) {
          const pageStart = page * PAGE_SIZE;
          const pageEnd = Math.min(value.length, pageStart + PAGE_SIZE);

          if (!collapsed && pageStart > maxItemsToShow) {
            rows.push(
              <tr key={`page__${page}`}>
                <td style={getIndentStyles(indent + 1)}
                    onClick={e => this.handleTogglePage(page)}
                    className="json-viewer__key-container">
                  <span className="json-viewer__icon"></span>
                  <span
                    className="json-viewer__key json-viewer__key--page">{pageStart}…{value.length}</span>
                </td>
                <td className="json-viewer__value json-viewer__type-comment">
                  Too many remaining to show
                </td>
              </tr>
            );
          }

          // Don't render any more!
          if (pageStart > maxItemsToShow) {
            break;
          }

          for (let key = pageStart; key < pageEnd; key++) {
            const isFirstInPage = key % PAGE_SIZE === 0;
            const visible = !hasMultiplePages || !!pages[page.toString()];
            const hasBeenVisible = !hasMultiplePages || pages[page.toString()] !== undefined;

            // Add "Show" button if we're at the start of a page
            if (hasMultiplePages && isFirstInPage) {
              const start = page * PAGE_SIZE;
              const end = Math.min(value.length, start + PAGE_SIZE);
              const className = classnames({
                'hide': collapsed,
                'json-viewer__row': true,
                'json-viewer__row--collapsable': collapsable,
                'json-viewer__row--collapsed': !visible
              });
              rows.push(
                <tr key={`page__${page}`} className={className}>
                  <td style={getIndentStyles(indent + 1)}
                      onClick={e => this.handleTogglePage(page)}
                      className="json-viewer__key-container">
                    <span className="json-viewer__icon"></span>
                    <span className="json-viewer__key json-viewer__key--page">{start}…{end}</span>
                  </td>
                </tr>
              );
            }

            if (visible || hasBeenVisible) {
              // Push all the children
              const newPaths = [...paths, `[${key}]`];
              rows.push((
                <JSONViewerObj
                  expanded={expandChildren}
                  indent={indent + (hasMultiplePages ? 2 : 1)}
                  hide={hide || collapsed || !visible}
                  key={key}
                  label={key}
                  onExpand={onExpand}
                  value={value[key]}
                  paths={newPaths}
                />
              ));
            }
          }
        }
      }
    } else if (value && typeof value === 'object') {
      if (label !== undefined) {
        rows.push((
          <tr key={paths.join('')} className={rowClasses}>
            <td style={getIndentStyles(indent)}
                className="json-viewer__key-container"
                onClick={collapsable ? this.handleClickKey : null}>
              <span className="json-viewer__icon"></span>
              <span className="json-viewer__key json-viewer__key--array">
              {label}
            </span>
            </td>
            {this.getValue(value, collapsed)}
          </tr>
        ));
      }

      if (!collapsed || hasBeenExpanded) {
        for (let key of Object.keys(value)) {
          const newPaths = [...paths, `.${key}`];
          rows.push((
            <JSONViewerObj
              indent={indent + 1}
              hide={hide || collapsed}
              expanded={expandChildren}
              key={key}
              label={key}
              onExpand={onExpand}
              value={value[key]}
              paths={newPaths}
            />
          ));
        }
      }
    } else {
      rows.push((
        <tr key={paths.join('')} className={rowClasses}>
          <td style={getIndentStyles(indent)}
              className="json-viewer__key-container"
              onClick={collapsable ? this.handleClickKey : null}>
            <span className="json-viewer__icon"></span>
            {paths.length > 0 ? (
              <span className="json-viewer__key json-viewer__key--array">
                {label}
              </span>
            ) : null}
          </td>
          {this.getValue(value, collapsed)}
        </tr>
      ));
    }

    return rows;
  }
}

export default JSONViewer;
