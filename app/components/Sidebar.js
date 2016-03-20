import React, {PropTypes} from 'react'

const Sidebar = (props) => (
  <aside id="sidebar" className="pane">
    <header className="pane__header bg-primary">
      <h2>
        <a href="#" className="pane__header__content">
          {props.loading ? <i className="fa fa-refresh fa-spin pull-right"></i> : ''}
          Insomnia
        </a>
      </h2>
    </header>
    <div className="pane__body">
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
        {props.requests.all.map((request) => {
          const isActive = request.id === props.requests.active.id;
          return (
            <li key={request.id} className={'sidebar-item ' + (isActive ? 'active': '')}>
              <a href="#" onClick={() => {props.activateRequest(request)}}>{request.name}</a>
            </li>
          );
        })}
      </ul>
    </div>
  </aside>
);

Sidebar.propTypes = {
  activateRequest: PropTypes.func.isRequired,
  requests: PropTypes.object.isRequired,
  loading: PropTypes.bool.isRequired
};

export default Sidebar;
