import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import {buildQueryStringFromParams, joinUrlAndQueryString} from 'insomnia-url';
import Button from '../base/button';
import Modal from '../base/modal';
import ModalHeader from '../base/modal-header';
import ModalBody from '../base/modal-body';
import MethodTag from '../tags/method-tag';
import * as models from '../../../models';
import {fuzzyMatchAll} from '../../../common/misc';

@autobind
class RequestSwitcherModal extends PureComponent {
  constructor (props) {
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

  _handleKeydown (e) {
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

  _setModalRef (n) {
    this.modal = n;
  }

  _setInputRef (n) {
    this._input = n;
  }

  _setActiveIndex (activeIndex) {
    const maxIndex = this.state.matchedRequests.length + this.state.matchedWorkspaces.length;
    if (activeIndex < 0) {
      activeIndex = this.state.matchedRequests.length - 1;
    } else if (activeIndex >= maxIndex) {
      activeIndex = 0;
    }

    this.setState({activeIndex});
  }

  _activateCurrentIndex () {
    const {
      activeIndex,
      matchedRequests,
      matchedWorkspaces
    } = this.state;

    if (activeIndex < matchedRequests.length) {
      // Activate the request if there is one
      const request = matchedRequests[activeIndex];
      this._activateRequest(request);
    } else if (activeIndex < (matchedRequests.length + matchedWorkspaces.length)) {
      // Activate the workspace if there is one
      const index = activeIndex - matchedRequests.length;
      const workspace = matchedWorkspaces[index];
      this._activateWorkspace(workspace);
    } else {
      // Create request if no match
      this._createRequestFromSearch();
    }
  }

  async _createRequestFromSearch () {
    const {activeRequestParentId} = this.props;
    const {searchString} = this.state;

    // Create the request if nothing matched
    const patch = {
      name: searchString,
      parentId: activeRequestParentId
    };

    const request = await models.request.create(patch);
    this._activateRequest(request);
  }

  _activateWorkspace (workspace) {
    if (!workspace) {
      return;
    }

    this.props.handleSetActiveWorkspace(workspace._id);
    this.modal.hide();
  }

  _activateRequest (request) {
    if (!request) {
      return;
    }

    this.props.activateRequest(request._id);
    this.modal.hide();
  }

  _handleChange (e) {
    this._handleChangeValue(e.target.value);
  }

  /**
   * Appends path of ancestor groups, delimited by forward slashes
   * E.g. Folder1/Folder2/Folder3
   */
  _groupOf (requestOrRequestGroup) {
    const {workspaceChildren} = this.props;
    const requestGroups = workspaceChildren.filter(d => d.type === models.requestGroup.type);
    const matchedGroups = requestGroups.filter(g => g._id === requestOrRequestGroup.parentId);
    const currentGroupName = requestOrRequestGroup.type === models.requestGroup.type && requestOrRequestGroup.name ? `${requestOrRequestGroup.name}` : '';

    if (matchedGroups.length === 0) {
      return currentGroupName;
    }

    const parentGroup = this._groupOf(matchedGroups[0]);
    const parentGroupText = parentGroup ? `${parentGroup}/` : '';
    const group = `${parentGroupText}${currentGroupName}`;

    return group;
  }

  _isMatch (searchStrings) {
    return (request) => {
      let finalUrl = request.url;
      if (request.parameters) {
        finalUrl = joinUrlAndQueryString(
          finalUrl,
          buildQueryStringFromParams(request.parameters));
      }

      // Match request attributes
      const matchesAttributes = fuzzyMatchAll(searchStrings,
        [
          request.name,
          finalUrl,
          request.method,
          this._groupOf(request)
        ]);

      // Match exact Id
      const matchesId = request._id === searchStrings;

      return matchesAttributes || matchesId;
    };
  }

  async _handleChangeValue (searchString) {
    const {workspaceChildren, workspaces} = this.props;
    const {workspaceId, activeRequestParentId} = this.props;

    // OPTIMIZATION: This only filters if we have a filter
    let matchedRequests = workspaceChildren
      .filter(d => d.type === models.request.type);

    if (searchString) {
      matchedRequests = matchedRequests.filter(this._isMatch(searchString));
    }

    matchedRequests = matchedRequests.sort((a, b) => {
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
    }).slice(0, 20); // show 20 max

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
      matchedRequests,
      matchedWorkspaces
    });
  }

  async show () {
    await this._handleChangeValue('');
    this.modal.show();
    setTimeout(() => this._input.focus(), 100);
  }

  hide () {
    this.modal.hide();
  }

  toggle () {
    if (this.modal.isOpen()) {
      this.hide();
    } else {
      this.show();
    }
  }

  render () {
    const {
      searchString,
      activeIndex,
      matchedRequests,
      matchedWorkspaces
    } = this.state;

    const {workspaceChildren} = this.props;
    const requestGroups = workspaceChildren.filter(d => d.type === models.requestGroup.type);

    return (
      <Modal ref={this._setModalRef} dontFocus tall>
        <ModalHeader hideCloseButton>
          <div className="pull-right txt-sm pad-right">
            <span className="monospace">tab</span> or
            &nbsp;
            <span className="monospace">↑ ↓</span> &nbsp;to navigate
            &nbsp;&nbsp;&nbsp;
            <span className="monospace">↵</span> &nbsp;to select
            &nbsp;&nbsp;&nbsp;
            <span className="monospace">esc</span> to dismiss
          </div>
          <div>Quick Switch</div>
        </ModalHeader>
        <ModalBody className="request-switcher">
          <div className="pad" onKeyDown={this._handleKeydown}>
            <div className="form-control form-control--outlined no-margin">
              <input
                type="text"
                placeholder="Fuzzy filter by request name, folder, url, method, or query parameters"
                ref={this._setInputRef}
                value={searchString}
                onChange={this._handleChange}
              />
            </div>
          </div>
          <ul>
            {matchedRequests.map((r, i) => {
              const requestGroup = requestGroups.find(rg => rg._id === r.parentId);
              const buttonClasses = classnames(
                'btn btn--super-compact wide text-left',
                {focus: activeIndex === i}
              );

              return (
                <li key={r._id}>
                  <Button onClick={this._activateRequest} value={r} className={buttonClasses}>
                    {requestGroup && (
                      <div className="pull-right faint italic">
                        {requestGroup.name}
                        &nbsp;&nbsp;
                        <i className="fa fa-folder-o"/>
                      </div>
                    )}
                    <MethodTag method={r.method}/>
                    <strong>{r.name}</strong>
                  </Button>
                </li>
              );
            })}

            {(matchedRequests.length > 0 && matchedWorkspaces.length > 0) && (
              <li className="pad-left pad-right">
                <hr/>
              </li>
            )}

            {matchedWorkspaces.map((w, i) => {
              const buttonClasses = classnames(
                'btn btn--super-compact wide text-left',
                {focus: (activeIndex - matchedRequests.length) === i}
              );

              return (
                <li key={w._id}>
                  <Button onClick={this._activateWorkspace} value={w} className={buttonClasses}>
                    <i className="fa fa-random"/>
                    &nbsp;&nbsp;&nbsp;
                    Switch to <strong>{w.name}</strong>
                  </Button>
                </li>
              );
            })}
          </ul>

          {(matchedRequests.length === 0 && matchedWorkspaces.length === 0) && (
            <div className="text-center">
              <p>
                No matches found for <strong>{searchString}</strong>
              </p>

              <button className="btn btn--outlined btn--compact"
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

RequestSwitcherModal.propTypes = {
  handleSetActiveWorkspace: PropTypes.func.isRequired,
  activateRequest: PropTypes.func.isRequired,
  workspaceId: PropTypes.string.isRequired,
  activeRequestParentId: PropTypes.string.isRequired,
  workspaceChildren: PropTypes.arrayOf(PropTypes.object).isRequired,
  workspaces: PropTypes.arrayOf(PropTypes.object).isRequired
};

export default RequestSwitcherModal;
