import React, {PropTypes} from 'react'
import Dropdown from './base/Dropdown'

const Sidebar = (props) => (
  <aside id="sidebar" className="pane">
    <div className="grid-v">
      <header className="pane__header bg-primary">
        <h1>
          <Dropdown right={true}>
            <a href="#" className="pane__header__content">
              <i className="fa fa-angle-down pull-right"></i>
              {props.loading ? <i className="fa fa-refresh fa-spin pull-right"></i> : ''}
              Insomnia
            </a>
            <ul className="bg-super-light">
              <li><button>hello</button></li>
              <li><button>hello</button></li>
              <li><button>hello</button></li>
              <li><button>hello</button></li>
              <li><button>hello</button></li>
            </ul>
          </Dropdown>
        </h1>
      </header>
      <div className="pane__body hide-scrollbars bg-dark">
        <ul className="sidebar-items">
          <li className="grid">
            <div className="form-control col">
              <input type="text" placeholder="Filter Requests"/>
            </div>
            <button className="btn" onClick={(e) => props.addRequest()}>
              <i className="fa fa-plus-circle"></i>
            </button>
          </li>
        </ul>
        <ul className="sidebar-items">
          {props.requests.map((request) => {
            const isActive = request.id === props.activeRequest.id;
            return (
              <li key={request.id} className={'sidebar-item ' + (isActive ? 'active': '')}>
                <a href="#" onClick={() => {props.activateRequest(request.id)}}>{request.name}</a>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  </aside>
);

Sidebar.propTypes = {
  activateRequest: PropTypes.func.isRequired,
  addRequest: PropTypes.func.isRequired,
  requests: PropTypes.array.isRequired,
  activeRequest: PropTypes.object,
  loading: PropTypes.bool.isRequired
};

export default Sidebar;
