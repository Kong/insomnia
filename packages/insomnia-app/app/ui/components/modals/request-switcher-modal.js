// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import {
  buildQueryStringFromParams,
  joinUrlAndQueryString
} from 'insomnia-url';
import Button from '../base/button';
import Highlight from '../base/highlight';
import Modal from '../base/modal';
import ModalHeader from '../base/modal-header';
import ModalBody from '../base/modal-body';
import MethodTag from '../tags/method-tag';
import { fuzzyMatchAll } from '../../../common/misc';
import type { BaseModel } from '../../../models';
import * as models from '../../../models';
import type { RequestGroup } from '../../../models/request-group';
import type { Request } from '../../../models/request';
import type { Workspace } from '../../../models/workspace';

type Props = {
  handleSetActiveWorkspace: (id: string) => void,
  activateRequest: (id: string) => void,
  workspaceId: string,
  activeRequestParentId: string,
  workspaceChildren: Array<Request | RequestGroup>,
  workspaces: Array<Workspace>
};

type State = {
  searchString: string,
  requestGroups: Array<RequestGroup>,
  requests: Array<Request>,
  workspaces: Array<Workspace>,
  matchedRequests: Array<Request>,
  matchedWorkspaces: Array<Workspace>,
  activeIndex: number
};

@autobind
class RequestSwitcherModal extends React.PureComponent<Props, State> {
  modal: ?Modal;
  _input: ?HTMLInputElement;

  constructor(props: Props) {
    super(props);

    this.state = {
      searchString: '',
      requestGroups: [],
      requests: [],
      workspaces: [],
      matchedRequests: [],
      matchedWorkspaces: [],
      activeIndex: -1
    };
  }

  _handleKeydown(e: KeyboardEvent) {
    const keyCode = e.keyCode;

    if (keyCode === 38 || (keyCode === 9 && e.shiftKey)) {
      // Up or Shift+Tab
      this._setActiveIndex(this.state.activeIndex - 1);
    } else if (keyCode === 40 || keyCode === 9) {
      // Down or Tab
      this._setActiveIndex(this.state.activeIndex + 1);
    } else if (keyCode === 13) {
      // Enter
      this._activateCurrentIndex();
    } else {
      return;
    }

    e.preventDefault();
  }

  _setModalRef(n: ?Modal) {
    this.modal = n;
  }

  _setInputRef(n: ?HTMLInputElement) {
    this._input = n;
  }

  _setActiveIndex(activeIndex: number) {
    const maxIndex =
      this.state.matchedRequests.length + this.state.matchedWorkspaces.length;
    if (activeIndex < 0) {
      activeIndex = this.state.matchedRequests.length - 1;
    } else if (activeIndex >= maxIndex) {
      activeIndex = 0;
    }

    this.setState({ activeIndex });
  }

  _activateCurrentIndex() {
    const { activeIndex, matchedRequests, matchedWorkspaces } = this.state;

    if (activeIndex < matchedRequests.length) {
      // Activate the request if there is one
      const request = matchedRequests[activeIndex];
      this._activateRequest(request);
    } else if (
      activeIndex <
      matchedRequests.length + matchedWorkspaces.length
    ) {
      // Activate the workspace if there is one
      const index = activeIndex - matchedRequests.length;
      const workspace = matchedWorkspaces[index];
      if (workspace) {
        this._activateWorkspace(workspace);
      }
    } else {
      // Create request if no match
      this._createRequestFromSearch();
    }
  }

  async _createRequestFromSearch() {
    const { activeRequestParentId } = this.props;
    const { searchString } = this.state;

    // Create the request if nothing matched
    const patch = {
      name: searchString,
      parentId: activeRequestParentId
    };

    const request = await models.request.create(patch);
    this._activateRequest(request);
  }

  _activateWorkspace(workspace: Workspace) {
    this.props.handleSetActiveWorkspace(workspace._id);
    this.modal && this.modal.hide();
  }

  _activateRequest(request: ?Request) {
    if (!request) {
      return;
    }

    this.props.activateRequest(request._id);
    this.modal && this.modal.hide();
  }

  _handleChange(e: SyntheticEvent<HTMLInputElement>) {
    this._handleChangeValue(e.currentTarget.value);
  }

  /** Return array of path segments for given request or folder */
  _groupOf(requestOrRequestGroup: BaseModel): Array<string> {
    const { workspaceChildren } = this.props;
    const requestGroups = workspaceChildren.filter(
      d => d.type === models.requestGroup.type
    );
    const matchedGroups = requestGroups.filter(
      g => g._id === requestOrRequestGroup.parentId
    );
    const currentGroupName =
      requestOrRequestGroup.type === models.requestGroup.type
        ? `${(requestOrRequestGroup: any).name}`
        : '';

    // It's the final parent
    if (matchedGroups.length === 0) {
      return [currentGroupName];
    }

    // Still has more parents
    if (currentGroupName) {
      return [currentGroupName, ...this._groupOf(matchedGroups[0])];
    }

    // It's the child
    return this._groupOf(matchedGroups[0]);
  }

  _isMatch(request: Request, searchStrings: string): number | null {
    let finalUrl = request.url;
    if (request.parameters) {
      finalUrl = joinUrlAndQueryString(
        finalUrl,
        buildQueryStringFromParams(request.parameters)
      );
    }

    const match = fuzzyMatchAll(
      searchStrings,
      [
        request.name,
        finalUrl,
        request.method || '',
        this._groupOf(request).join('/')
      ],
      { splitSpace: true }
    );

    // Match exact Id
    const matchesId = request._id === searchStrings;

    // _id match is the highest;
    if (matchesId) {
      return Infinity;
    }

    if (!match) {
      return null;
    }

    return match.score;
  }

  async _handleChangeValue(searchString: string) {
    const { workspaceChildren, workspaces } = this.props;
    const { workspaceId, activeRequestParentId } = this.props;

    // OPTIMIZATION: This only filters if we have a filter
    let matchedRequests = workspaceChildren
      .filter(d => d.type === models.request.type)
      .sort((a, b) => {
        if (a.parentId === b.parentId) {
          // Sort Requests by name inside of the same parent
          // TODO: Sort by quality of match (eg. start vs mid string, etc)
          return a.name > b.name ? 1 : -1;
        } else {
          // Sort RequestGroups by relevance if Request isn't in same parent
          if (a.parentId === activeRequestParentId) {
            return -1;
          } else if (b.parentId === activeRequestParentId) {
            return 1;
          } else {
            return a.parentId > b.parentId ? -1 : 1;
          }
        }
      });

    if (searchString) {
      matchedRequests = matchedRequests
        .map(r => ({
          request: r,
          score: this._isMatch((r: any), searchString)
        }))
        .filter(v => v.score !== null)
        .sort((a, b) => (a.score || -Infinity) - (b.score || -Infinity))
        .map(v => v.request);
    }

    // Show 20 max
    matchedRequests = matchedRequests.slice(0, 20);

    const matchedWorkspaces = workspaces
      .filter(w => w._id !== workspaceId)
      .filter(w => {
        const name = w.name.toLowerCase();
        const toMatch = searchString.toLowerCase();
        return name.indexOf(toMatch) !== -1;
      });

    const activeIndex = searchString ? 0 : -1;

    this.setState({
      activeIndex,
      searchString,
      matchedWorkspaces,

      // Ugh. Force cast to make Flow happy
      matchedRequests: ((matchedRequests: any): Array<Request>)
    });
  }

  async show() {
    await this._handleChangeValue('');
    this.modal && this.modal.show();
    setTimeout(() => {
      this._input && this._input.focus();
    }, 100);
  }

  hide() {
    this.modal && this.modal.hide();
  }

  toggle() {
    if (this.modal && this.modal.isOpen()) {
      this.hide();
    } else {
      this.show();
    }
  }

  render() {
    const {
      searchString,
      activeIndex,
      matchedRequests,
      matchedWorkspaces
    } = this.state;

    const { workspaceChildren } = this.props;
    const requestGroups = workspaceChildren.filter(
      d => d.type === models.requestGroup.type
    );

    return (
      <Modal ref={this._setModalRef} dontFocus tall>
        <ModalHeader hideCloseButton>
          <div className="pull-right txt-sm pad-right tall">
            <span className="vertically-center">
              <div>
                <span className="monospace">tab</span> or&nbsp;
                <span className="monospace">↑↓</span> to
                navigate&nbsp;&nbsp;&nbsp;&nbsp;
                <span className="monospace">↵</span> &nbsp;to
                select&nbsp;&nbsp;&nbsp;&nbsp;
                <span className="monospace">esc</span> to dismiss
              </div>
            </span>
          </div>
          <div>Quick Switch</div>
        </ModalHeader>
        <ModalBody className="request-switcher">
          <div className="pad" onKeyDown={this._handleKeydown}>
            <div className="form-control form-control--outlined no-margin">
              <input
                type="text"
                placeholder="Filter by name or folder"
                ref={this._setInputRef}
                value={searchString}
                onChange={this._handleChange}
              />
            </div>
          </div>
          <ul>
            {matchedRequests.map((r, i) => {
              const requestGroup = requestGroups.find(
                rg => rg._id === r.parentId
              );
              const buttonClasses = classnames(
                'btn btn--expandable-small wide text-left pad-bottom',
                { focus: activeIndex === i }
              );

              return (
                <li key={r._id}>
                  <Button
                    onClick={this._activateRequest}
                    value={r}
                    className={buttonClasses}>
                    <div>
                      {requestGroup ? (
                        <div className="pull-right faint italic">
                          <Highlight
                            search={searchString}
                            text={this._groupOf(r).join(' / ')}
                          />
                          &nbsp;&nbsp;
                          <i className="fa fa-folder-o" />
                        </div>
                      ) : null}
                      <Highlight search={searchString} text={(r: any).name} />
                    </div>
                    <div className="margin-left-xs faint">
                      <MethodTag method={(r: any).method} />
                      <Highlight search={searchString} text={(r: any).url} />
                    </div>
                  </Button>
                </li>
              );
            })}

            {matchedRequests.length > 0 &&
              matchedWorkspaces.length > 0 && (
                <li className="pad-left pad-right">
                  <hr />
                </li>
              )}

            {matchedWorkspaces.map((w, i) => {
              const buttonClasses = classnames(
                'btn btn--super-compact wide text-left',
                { focus: activeIndex - matchedRequests.length === i }
              );

              return (
                <li key={w._id}>
                  <Button
                    onClick={this._activateWorkspace}
                    value={w}
                    className={buttonClasses}>
                    <i className="fa fa-random" />
                    &nbsp;&nbsp;&nbsp; Switch to{' '}
                    <strong>{(w: any).name}</strong>
                  </Button>
                </li>
              );
            })}
          </ul>

          {matchedRequests.length === 0 &&
            matchedWorkspaces.length === 0 && (
              <div className="text-center">
                <p>
                  No matches found for <strong>{searchString}</strong>
                </p>

                <button
                  className="btn btn--outlined btn--compact"
                  disabled={!searchString}
                  onClick={this._activateCurrentIndex}>
                  Create a request named {searchString}
                </button>
              </div>
            )}
        </ModalBody>
      </Modal>
    );
  }
}

export default RequestSwitcherModal;
