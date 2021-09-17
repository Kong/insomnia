import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import { buildQueryStringFromParams, joinUrlAndQueryString } from 'insomnia-url';
import React, { Fragment, PureComponent } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import { AUTOBIND_CFG } from '../../../common/constants';
import { hotKeyRefs } from '../../../common/hotkeys';
import { executeHotKey } from '../../../common/hotkeys-listener';
import { keyboardKeys } from '../../../common/keyboard-keys';
import { fuzzyMatchAll } from '../../../common/misc';
import type { BaseModel } from '../../../models';
import * as models from '../../../models';
import { isRequest, Request } from '../../../models/request';
import { isRequestGroup } from '../../../models/request-group';
import { Workspace } from '../../../models/workspace';
import { RootState } from '../../redux/modules';
import { activateWorkspace } from '../../redux/modules/workspace';
import { selectActiveRequest, selectActiveWorkspace, selectRequestMetas, selectWorkspaceRequestsAndRequestGroups, selectWorkspacesForActiveProject } from '../../redux/selectors';
import Button from '../base/button';
import Highlight from '../base/highlight';
import Modal from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import KeydownBinder from '../keydown-binder';
import { MethodTag } from '../tags/method-tag';

type ReduxProps = ReturnType<typeof mapStateToProps> & ReturnType<typeof mapDispatchToProps>;

const mapStateToProps = (state: RootState) => {
  const activeRequest = selectActiveRequest(state);
  // the request switcher modal does not know about grpc requests yet
  const normalizedRequest = activeRequest && isRequest(activeRequest) ? activeRequest : undefined;

  return {
    activeRequest: normalizedRequest,
    workspace: selectActiveWorkspace(state),
    workspaces: selectWorkspacesForActiveProject(state),
    requestMetas: selectRequestMetas(state),
    workspaceChildren: selectWorkspaceRequestsAndRequestGroups(state),
  };
};

const mapDispatchToProps = dispatch => {
  const bound = bindActionCreators({ activateWorkspace }, dispatch);
  return {
    handleActivateWorkspace: bound.activateWorkspace,
  };
};

interface Props extends ReduxProps {
  activateRequest: (id: string) => void;
}

interface State {
  searchString: string;
  workspaces: Workspace[];
  matchedRequests: Request[];
  matchedWorkspaces: Workspace[];
  activeIndex: number;
  maxRequests: number;
  maxWorkspaces: number;
  disableInput: boolean;
  selectOnKeyup: boolean;
  hideNeverActiveRequests: boolean;
  isModalVisible: boolean;
  title: string | null;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class RequestSwitcherModal extends PureComponent<Props, State> {
  modal: Modal | null = null;
  _input: HTMLInputElement | null = null;
  _openTimeout: NodeJS.Timeout | null = null;

  state: State = {
    searchString: '',
    workspaces: [],
    matchedRequests: [],
    matchedWorkspaces: [],
    activeIndex: -1,
    maxRequests: 20,
    maxWorkspaces: 20,
    disableInput: false,
    selectOnKeyup: false,
    hideNeverActiveRequests: false,
    isModalVisible: true,
    title: null,
  };

  _handleInputKeydown(e: React.KeyboardEvent<HTMLDivElement>) {
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

  _setModalRef(n: Modal) {
    this.modal = n;
  }

  _setInputRef(n: HTMLInputElement) {
    this._input = n;
  }

  _setActiveIndex(activeIndex: number) {
    const maxIndex = this.state.matchedRequests.length + this.state.matchedWorkspaces.length;

    if (activeIndex < 0) {
      activeIndex = this.state.matchedRequests.length - 1;
    } else if (activeIndex >= maxIndex) {
      activeIndex = 0;
    }

    this.setState({
      activeIndex,
    });
  }

  async _activateCurrentIndex() {
    const { activeIndex, matchedRequests, matchedWorkspaces, searchString } = this.state;

    if (activeIndex < matchedRequests.length) {
      // Activate the request if there is one
      const request = matchedRequests[activeIndex];

      this._activateRequest(request);
    } else if (activeIndex < matchedRequests.length + matchedWorkspaces.length) {
      // Activate the workspace if there is one
      const index = activeIndex - matchedRequests.length;
      const workspace = matchedWorkspaces[index];

      if (workspace) {
        this._activateWorkspace(workspace);
      }
    } else if (searchString) {
      // Create request if no match
      await this._createRequestFromSearch();
    } else {
      // Do nothing
    }
  }

  async _createRequestFromSearch() {
    const { activeRequest, workspace } = this.props;
    const { searchString } = this.state;

    if (!workspace) {
      return;
    }

    // Create the request if nothing matched
    const parentId = activeRequest ? activeRequest.parentId : workspace._id;
    const patch = {
      parentId,
      name: searchString,
    };
    const request = await models.request.create(patch);

    this._activateRequest(request);
  }

  async _activateWorkspace(workspace: Workspace) {
    await this.props.handleActivateWorkspace({ workspace });

    this.modal?.hide();
  }

  _activateRequest(request: Request) {
    if (!request) {
      return;
    }

    this.props.activateRequest(request._id);
    this.modal?.hide();
  }

  _handleChange(e: React.SyntheticEvent<HTMLInputElement>) {
    this._handleChangeValue(e.currentTarget.value);
  }

  /** Return array of path segments for given request or folder */
  _groupOf(requestOrRequestGroup: BaseModel): string[] {
    const { workspaceChildren } = this.props;
    const requestGroups = workspaceChildren.filter(isRequestGroup);
    const matchedGroups = requestGroups.filter(g => g._id === requestOrRequestGroup.parentId);
    const currentGroupName = isRequestGroup(requestOrRequestGroup) ? `${requestOrRequestGroup.name}` : '';

    // It's the final parent
    if (matchedGroups.length === 0) {
      return [currentGroupName];
    }

    // Still has more parents
    if (currentGroupName) {
      return [...this._groupOf(matchedGroups[0]), currentGroupName];
    }

    // It's the child
    return this._groupOf(matchedGroups[0]);
  }

  _isMatch(request: Request, searchStrings: string): number | null {
    let finalUrl = request.url;

    if (request.parameters) {
      finalUrl = joinUrlAndQueryString(finalUrl, buildQueryStringFromParams(request.parameters));
    }

    const match = fuzzyMatchAll(
      searchStrings,
      [request.name, finalUrl, request.method || '', this._groupOf(request).join('/')],
      {
        splitSpace: true,
      },
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

  _handleChangeValue(searchString: string) {
    const { workspace, workspaceChildren, workspaces, requestMetas, activeRequest } = this.props;
    const { maxRequests, maxWorkspaces, hideNeverActiveRequests } = this.state;
    const lastActiveMap = {};

    for (const meta of requestMetas) {
      lastActiveMap[meta.parentId] = meta.lastActive;
    }

    // OPTIMIZATION: This only filters if we have a filter
    let matchedRequests = workspaceChildren
      .filter(isRequest)
      .sort((a, b) => {
        const aLA = lastActiveMap[a._id] || 0;
        const bLA = lastActiveMap[b._id] || 0;

        // If lastActive same, go by name
        if (aLA === bLA) {
          return a.name > b.name ? 1 : -1;
        }

        return bLA - aLA;
      });

    if (hideNeverActiveRequests) {
      matchedRequests = matchedRequests.filter(r => lastActiveMap[r._id]);
    }

    if (searchString) {
      matchedRequests = matchedRequests
        .map(r => ({
          request: r,
          score: this._isMatch(r as any, searchString),
        }))
        .filter(v => v.score !== null)
        .sort((a, b) => (a.score || -Infinity) - (b.score || -Infinity))
        .map(v => v.request);
    }

    const matchedWorkspaces = workspaces
      .filter(w => w._id !== workspace?._id)
      .filter(w => {
        const name = w.name.toLowerCase();
        const toMatch = searchString.toLowerCase();
        return name.indexOf(toMatch) !== -1;
      });
    // Make sure we select the first item but we don't want to select the currently active
    // one because that wouldn't make any sense.
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    const indexOfFirstNonActiveRequest = matchedRequests.findIndex(r => r._id !== activeRequestId);
    this.setState({
      searchString,
      activeIndex: indexOfFirstNonActiveRequest >= 0 ? indexOfFirstNonActiveRequest : 0,
      matchedRequests: (matchedRequests as any[]).slice(0, maxRequests),
      matchedWorkspaces: matchedWorkspaces.slice(0, maxWorkspaces),
    });
  }

  async show(
    options: {
      maxRequests?: number;
      maxWorkspaces?: number;
      disableInput?: boolean;
      selectOnKeyup?: boolean;
      hideNeverActiveRequests?: boolean;
      title?: string;
      openDelay?: number;
    } = {},
  ) {
    // Don't show if we're already showing
    if (this.modal?.isOpen()) {
      return;
    }

    const newState = {
      maxRequests: typeof options.maxRequests === 'number' ? options.maxRequests : 20,
      maxWorkspaces: typeof options.maxWorkspaces === 'number' ? options.maxWorkspaces : 20,
      disableInput: !!options.disableInput,
      hideNeverActiveRequests: !!options.hideNeverActiveRequests,
      selectOnKeyup: !!options.selectOnKeyup,
      title: options.title || null,
      isModalVisible: false,
    };

    // Using a visibility toggle here because we want to be able to interact with everything
    // here via keyboard BEFORE the modal shows.
    if (options.openDelay) {
      this._openTimeout = setTimeout(() => {
        this.setState({
          isModalVisible: true,
        });
      }, options.openDelay);
    } else {
      newState.isModalVisible = true;
    }

    this.setState(newState, () => {
      // Change value after because it accesses state properties
      this._handleChangeValue('');
    });
    this.modal?.show();
    setTimeout(() => this._input?.focus(), 100);
  }

  hide() {
    if (this._openTimeout !== null) {
      clearTimeout(this._openTimeout);
    }
    this.modal?.hide();
  }

  toggle() {
    if (this.modal?.isOpen()) {
      this.hide();
    } else {
      this.show();
    }
  }

  _handleKeydown(e: KeyboardEvent) {
    if (e.keyCode === keyboardKeys.esc.keyCode) {
      this.hide();
      return;
    }

    // Only control up/down with tab if modal is visible
    executeHotKey(e, hotKeyRefs.SHOW_RECENT_REQUESTS, () => {
      if (this.state.isModalVisible) {
        this._setActiveIndex(this.state.activeIndex + 1);
      }
    });
    // Only control up/down with tab if modal is visible
    executeHotKey(e, hotKeyRefs.SHOW_RECENT_REQUESTS_PREVIOUS, () => {
      if (this.state.isModalVisible) {
        this._setActiveIndex(this.state.activeIndex - 1);
      }
    });
  }

  async _handleKeyup(e: KeyboardEvent) {
    const { selectOnKeyup } = this.state;
    // Handle selection if unpresses all modifier keys. Ideally this would trigger once
    // the user unpresses the hotkey that triggered this modal but we currently do not
    // have the facilities to do that.
    const isMetaKeyDown = e.ctrlKey || e.shiftKey || e.metaKey || e.altKey;
    const isActive = this.modal?.isOpen();

    if (selectOnKeyup && isActive && !isMetaKeyDown) {
      await this._activateCurrentIndex();
      this.hide();
    }
  }

  render() {
    const {
      searchString,
      activeIndex,
      matchedRequests,
      matchedWorkspaces,
      disableInput,
      title,
      isModalVisible,
    } = this.state;
    const { workspaceChildren, workspace } = this.props;
    const requestGroups = workspaceChildren.filter(isRequestGroup);
    return (
      <KeydownBinder onKeydown={this._handleKeydown} onKeyup={this._handleKeyup}>
        <Modal
          ref={this._setModalRef}
          dontFocus={!disableInput}
          className={isModalVisible ? '' : 'hide'}
        >
          <ModalHeader hideCloseButton>
            {title || (
              <Fragment>
                <div className="pull-right txt-sm pad-right tall">
                  <span className="vertically-center">
                    <div>
                      <span className="monospace">tab</span> or&nbsp;
                      <span className="monospace">↑↓</span> to navigate&nbsp;&nbsp;&nbsp;&nbsp;
                      <span className="monospace">↵</span> &nbsp;to select&nbsp;&nbsp;&nbsp;&nbsp;
                      <span className="monospace">esc</span> to dismiss
                    </div>
                  </span>
                </div>
                <div>Quick Switch</div>
              </Fragment>
            )}
          </ModalHeader>
          <ModalBody className="request-switcher">
            {!disableInput && (
              <div className="pad" onKeyDown={this._handleInputKeydown}>
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
            )}
            <ul>
              {matchedRequests.map((r, i) => {
                const requestGroup = requestGroups.find(rg => rg._id === r.parentId);
                const buttonClasses = classnames(
                  'btn btn--expandable-small wide text-left pad-bottom',
                  {
                    focus: activeIndex === i,
                  },
                );
                return (
                  <li key={r._id}>
                    <Button onClick={this._activateRequest} value={r} className={buttonClasses}>
                      <div>
                        {requestGroup ? (
                          <div className="pull-right faint italic">
                            <Highlight search={searchString} text={this._groupOf(r).join(' / ')} />
                            &nbsp;&nbsp;
                            <i className="fa fa-folder-o" />
                          </div>
                        ) : null}
                        <Highlight search={searchString} text={r.name} />
                      </div>
                      <div className="margin-left-xs faint">
                        <MethodTag method={r.method} />
                        <Highlight search={searchString} text={r.url} />
                      </div>
                    </Button>
                  </li>
                );
              })}

              {matchedRequests.length > 0 && matchedWorkspaces.length > 0 && (
                <li className="pad-left pad-right">
                  <hr />
                </li>
              )}

              {matchedWorkspaces.map((w, i) => {
                const buttonClasses = classnames('btn btn--super-compact wide text-left', {
                  focus: activeIndex - matchedRequests.length === i,
                });
                return (
                  <li key={w._id}>
                    <Button onClick={this._activateWorkspace} value={w} className={buttonClasses}>
                      <i className="fa fa-random" />
                      &nbsp;&nbsp;&nbsp; Switch to <strong>{w.name}</strong>
                    </Button>
                  </li>
                );
              })}
            </ul>

            {searchString && matchedRequests.length === 0 && matchedWorkspaces.length === 0 && (
              <div className="text-center pad-bottom">
                <p>
                  No matches found for <strong>{searchString}</strong>
                </p>

                {workspace ? <button
                  className="btn btn--outlined btn--compact"
                  disabled={!searchString}
                  onClick={this._activateCurrentIndex}
                >
                  Create a request named {searchString}
                </button> : null}
              </div>
            )}
          </ModalBody>
        </Modal>
      </KeydownBinder>
    );
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  null,
  { forwardRef: true }
)(RequestSwitcherModal);
