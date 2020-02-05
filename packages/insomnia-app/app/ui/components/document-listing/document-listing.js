// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import type { Workspace } from '../../../models/workspace';
import 'swagger-ui-react/swagger-ui.css';
import { fuzzyMatch } from '../../../common/misc';
import Highlight from '../base/highlight';
import Notice from '../notice';
import { Button, AppHeader } from 'insomnia-components';
import KeydownBinder from '../keydown-binder';
import { executeHotKey } from '../../../common/hotkeys-listener';
import { hotKeyRefs } from '../../../common/hotkeys';

type Props = {|
  activeWorkspace: Workspace,
  workspaces: Array<Workspace>,
  handleSetActiveWorkspace: (workspaceId: string) => any,
|};

type State = {|
  filter: string
|};

@autobind
class DocumentListing extends React.PureComponent<Props, State> {
  state = {
    filter: '',
  };

  _filterInput: ?HTMLInputElement;

  _setFilterInputRef(n: ?HTMLInputElement) {
    this._filterInput = n;
  }

  _handleFilterChange(e: SyntheticEvent<HTMLInputElement>) {
    this.setState({ filter: e.currentTarget.value });
  }

  _filterWorkspaces(): Array<Workspace> {
    const { workspaces } = this.props;
    const { filter } = this.state;

    if (!filter) {
      return workspaces;
    }

    return workspaces.filter(w => {
      const result = fuzzyMatch(filter, w.name, {
        splitSpace: true,
        loose: true,
      });

      return !!result;
    });
  }

  _handleKeyDown(e) {
    executeHotKey(e, hotKeyRefs.FILTER_DOCUMENTS, () => {
      if (this._filterInput) {
        this._filterInput.focus();
      }
    });
  }

  render() {
    const {
      handleSetActiveWorkspace,
    } = this.props;

    const { filter } = this.state;

    const filteredWorkspaces = this._filterWorkspaces();

    return (
      <KeydownBinder onKeydown={this._handleKeyDown}>
        <div className="document-listing theme--pane">
          <AppHeader />
          <div className="document-listing__body">
            <header className="document-listing__header">
              <h1>Documents</h1>
              <div className="form-control form-control--outlined">
                <input
                  ref={this._setFilterInputRef}
                  type="text"
                  placeholder="filter"
                  onChange={this._handleFilterChange}
                />
              </div>
              <Button>Add New</Button>
            </header>
            <div className="dummy-cards">
              {filteredWorkspaces.map(w => (
                <div className="dummy-card" key={w._id} onClick={() => handleSetActiveWorkspace(w._id)}>
                  <Highlight search={filter} text={w.name} />
                </div>
              ))}
            </div>
            {filteredWorkspaces.length === 0 && (
              <Notice color="subtle">No workspaces found for <strong>{filter}</strong></Notice>
            )}
          </div>
        </div>
      </KeydownBinder>
    );
  }
}

export default DocumentListing;
