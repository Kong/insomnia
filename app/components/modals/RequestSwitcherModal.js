import React, {PropTypes, Component} from 'react';
import ReactDOM from 'react-dom';
import classnames from 'classnames';
import Modal from '../base/Modal';
import ModalHeader from '../base/ModalHeader';
import ModalBody from '../base/ModalBody';
import MethodTag from '../tags/MethodTag';
import * as db from '../../database';


class RequestSwitcherModal extends Component {
  constructor (props) {
    super(props);
    this.state = {
      searchString: '',
      matchedRequests: [],
      requestGroups: [],
      activeIndex: -1
    }
  }

  _setActiveIndex (activeIndex) {
    if (activeIndex < 0) {
      activeIndex = this.state.matchedRequests.length - 1;
    } else if (activeIndex >= this.state.matchedRequests.length) {
      activeIndex = 0;
    }

    this.setState({activeIndex});
  }

  _activateCurrentIndex () {
    if (this.state.matchedRequests.length) {
      // Activate the request if there is one
      const request = this.state.matchedRequests[this.state.activeIndex];
      this._activateRequest(request);
    } else {
      // Create the request if nothing matched
      const name = this.state.searchString;
      const parentId = this.props.activeRequestParentId;

      db.requestCreate({name, parentId}).then(request => {
        this._activateRequest(request);
      });
    }
  }

  _activateRequest (request) {
    if (!request) {
      return;
    }

    this.props.activateRequest(request);
    this.modal.hide();
  }

  _handleChange (searchString) {
    const {workspaceId} = this.props;

    Promise.all([
      db.requestAll(),
      db.requestGroupAll()
    ]).then(([
      allRequests,
      allRequestGroups
    ]) => {
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
      let matchedRequests = !searchString ? requests : requests.filter(
        r => r.name.toLowerCase().indexOf(searchString.toLowerCase()) !== -1
      );

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

      const activeIndex = searchString ? 0 : -1;

      this.setState({
        activeIndex,
        matchedRequests,
        requestGroups,
        searchString
      });
    });
  }

  show () {
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
          <p>Jump To Request</p>
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
          </ul>

          {matchedRequests.length === 0 ? (
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
  workspaceId: PropTypes.string.isRequired,
  activeRequestParentId: PropTypes.string.isRequired
};

export default RequestSwitcherModal;
