// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import type { HotKeyRegistry } from '../../../common/hotkeys';
import { hotKeyRefs } from '../../../common/hotkeys';
import { DropdownHint } from '../base/dropdown';

type Props = {
  requestCreate: () => void,
  requestGroupCreate: () => void,
  hotKeyRegistry: HotKeyRegistry,
};

@autobind
class SidebarContextMenu extends React.PureComponent<Props> {
  async _handleRequestGroupCreate() {
    this.props.requestGroupCreate();
  }

  async _handleRequestCreate() {
    this.props.requestCreate();
  }

  render() {
    const { hotKeyRegistry } = this.props;
    return (
      <React.Fragment>
        <ul style={style.ul}>
          <li>
            <button style={style.button} onClick={this._handleRequestCreate}>
              <i style={style.fa} className="fa fa-plus-circle" /> New Request
              <DropdownHint
                styles={style.hint}
                keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_CREATE.id]}
              />
            </button>
          </li>
          <li>
            <button style={style.button} onClick={this._handleRequestGroupCreate}>
              <i style={style.fa} className="fa fa-folder" /> New Folder
              <DropdownHint
                styles={style.hint}
                keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_CREATE_FOLDER.id]}
              />
            </button>
          </li>
        </ul>
      </React.Fragment>
    );
  }
}

const style = {
  button: {
    minWidth: '15rem',
    fontSize: 'calc(var(--font-size) * 1.0)',
    textAlign: 'left',
    paddingRight: 'calc(var(--font-size) * 1.2)',
    paddingLeft: 'calc(var(--font-size) * 0.6)',
    height: 'calc(var(--font-size) * 2.448)',
    width: '100%',
    color: 'var(--color-font) !important',
    whiteSpace: 'nowrap',
    margin: 0,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  fa: {
    display: 'inline-block',
    width: '2.2em',
    textAlign: 'center',
  },
  hint: {
    color: 'var(--hl-xl)',
    marginLeft: 'auto',
    paddingLeft: 'calc(var(--font-size) * 2.5)',
  },
  ul: {
    left: '20px',
    right: '0px',
    top: '300.031px',
    position: 'absolute',
    bottom: 'initial',
    minWidth: 'initial',
    maxWidth: 197,
    maxHeight: 505.969,
    zIndex: 99999,
    color: 'var(--color-bg)',
    border: '1px solid var(--hl-sm)',
    boxShadow: '0 0 1rem 0 rgba(0, 0, 0, 0.1)',
    boxSizing: 'border-box',
    background: '#fff',
    margin: 'calc(var(--font-size) * 0.2) 3px',
    paddingTop: 'calc(var(--font-size) * 0.3)',
    paddingBottom: 'calc(var(--font-size) * 0.3)',
    borderRadius: 'calc(var(--font-size) * 0.3)',
    overflow: 'auto',
  },
};

export default SidebarContextMenu;
