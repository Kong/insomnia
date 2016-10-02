import React, {PropTypes, Component} from 'react';
import ReactDOM from 'react-dom';
import classnames from 'classnames';
import Modal from '../base/Modal';
import ModalHeader from '../base/ModalHeader';
import ModalBody from '../base/ModalBody';
import MethodTag from '../tags/MethodTag';
import * as db from '../../../backend/database';
import {trackEvent} from '../../../backend/analytics';


class RequestSwitcherModal extends Component {
  constructor (props) {
    super(props);
    this.state = {
      searchString: '',
      matchedRequests: [],
      matchedWorkspaces: [],
      requestGroups: [],
      activeIndex: -1
    }
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

    const request = await db.request.create(patch);
    this._activateRequest(request);
  }

  _activateWorkspace (workspace) {
    if (!workspace) {
      return;
    }

    this.props.activateWorkspace(workspace);
    this.modal.hide();
  }

  _activateRequest (request) {
    if (!request) {
      return;
    }

    this.props.activateRequest(request);
    this.modal.hide();
  }

  async _handleChange (searchString) {
    const {workspaceId} = this.props;

    const allRequests = await db.request.all();
    const allRequestGroups = await db.requestGroup.all();
    const allWorkspaces = await db.workspace.all();

    // TODO: Support nested RequestGroups
    // Filter out RequestGroups that don't belong to this Workspace
    const requestGroups = allRequestGroups.filter(
      rg => rg.parentId === workspaceId
    );

    // Filter out Requests that don't belong to this Workspace
    const requests = allRequests.filter(r => {
      if (r.parentId === workspaceId) {
        return true;
      } else {
        return !!requestGroups.find(rg => rg._id === r.parentId);
      }
    });

    const parentId = this.props.activeRequestParentId;

    // OPTIMIZATION: This only filters if we have a filter
    let matchedRequests = requests;
    if (searchString) {
      matchedRequests = matchedRequests.filter(r => {
        const name = r.name.toLowerCase();
        const toMatch = searchString.toLowerCase();
        return name.indexOf(toMatch) !== -1
      });
    }

    // OPTIMIZATION: Apply sort after the filter so we have to sort less
    matchedRequests = matchedRequests.sort(
      (a, b) => {
        if (a.parentId === b.parentId) {
          // Sort Requests by name inside of the same parent
          // TODO: Sort by quality of match (eg. start of string vs
          // mid string, etc)
          return a.name > b.name ? 1 : -1;
        } else {
          // Sort RequestGroups by relevance if Request isn't in same parent
          if (a.parentId === parentId) {
            return -1;
          } else if (b.parentId === parentId) {
            return 1;
          } else {
            return a.parentId > b.parentId ? -1 : 1;
          }
        }
      }
    );

    let matchedWorkspaces = [];
    if (searchString) {
      // Only match workspaces if there is a search
      matchedWorkspaces = allWorkspaces
        .filter(w => w._id !== workspaceId)
        .filter(w => {
          const name = w.name.toLowerCase();
          const toMatch = searchString.toLowerCase();
          return name.indexOf(toMatch) !== -1
        });
    }

    const activeIndex = searchString ? 0 : -1;

    this.setState({
      activeIndex,
      matchedRequests,
      matchedWorkspaces,
      requestGroups,
      searchString
    });
  }

  show () {
    trackEvent('Show Quick Switcher');
    this.modal.show();
    this._handleChange('');
  }

  toggle () {
    this.modal.toggle();
    this._handleChange('');
  }

  componentDidMount () {
    ReactDOM.findDOMNode(this).addEventListener('keydown', e => {
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
    })
  }

  render () {
    const {
      matchedRequests,
      matchedWorkspaces,
      requestGroups,
      searchString,
      activeIndex
    } = this.state;

    return (
      <Modal ref={m => this.modal = m} top={true}
             dontFocus={true} {...this.props}>
        <ModalHeader hideCloseButton={true}>
          <p className="pull-right txt-md">
            <span className="monospace">tab</span> or
            &nbsp;
            <span className="monospace">↑ ↓</span> &nbsp;to navigate
            &nbsp;&nbsp;&nbsp;
            <span className="monospace">↵</span> &nbsp;to select
            &nbsp;&nbsp;&nbsp;
            <span className="monospace">esc</span> to dismiss
          </p>
          <p>Quick Switch</p>
        </ModalHeader>
        <ModalBody className="pad request-switcher">
          <div className="form-control form-control--outlined no-margin">
            <input
              type="text"
              ref={n => n && n.focus()}
              value={searchString}
              onChange={e => this._handleChange(e.target.value)}
            />
          </div>
          <ul className="pad-top">
            {matchedRequests.map((r, i) => {
              const requestGroup = requestGroups.find(
                rg => rg._id === r.parentId
              );
              const buttonClasses = classnames(
                'btn btn--compact wide text-left',
                {focus: activeIndex === i}
              );

              return (
                <li key={r._id}>
                  <button onClick={e => this._activateRequest(r)}
                          className={buttonClasses}>
                    {requestGroup ? (
                      <div className="pull-right faint italic">
                        {requestGroup.name}
                        &nbsp;&nbsp;
                        <i className="fa fa-folder-o"></i>
                      </div>
                    ) : null}
                    <MethodTag method={r.method}/>
                    <strong>{r.name}</strong>
                  </button>
                </li>
              )
            })}

            {matchedRequests.length && matchedWorkspaces.length ? (
              <hr/>
            ) : null}

            {matchedWorkspaces.map((w, i) => {
              const buttonClasses = classnames(
                'btn btn--compact wide text-left',
                {focus: (activeIndex - matchedRequests.length) === i}
              );

              return (
                <li key={w._id}>
                  <button onClick={e => this._activateRequest(w)}
                          className={buttonClasses}>
                    <i className="fa fa-random"></i>
                    &nbsp;&nbsp;&nbsp;
                    Switch to <strong>{w.name}</strong>
                  </button>
                </li>
              )
            })}
          </ul>

          {!matchedRequests.length && !matchedWorkspaces.length ? (
            <div className="text-center">
              <p>
                No matches found for <strong>{searchString}</strong>
              </p>
              <button className="btn btn--outlined btn--compact"
                      onClick={e => this._activateCurrentIndex()}>
                Create a request named {searchString}
              </button>
            </div>
          ) : null}
        </ModalBody>
      </Modal>
    );
  }
}

RequestSwitcherModal.propTypes = {
  activateRequest: PropTypes.func.isRequired,
  activateWorkspace: PropTypes.func.isRequired,
  workspaceId: PropTypes.string.isRequired,
  activeRequestParentId: PropTypes.string.isRequired
};

export default RequestSwitcherModal;
