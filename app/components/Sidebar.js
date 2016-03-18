import React from 'react'

const Sidebar = (props) => (
  <aside id="sidebar" className="pane">
    <header className="pane-header pane-header-clickable bg-primary">
      <h2><a href="#">Insomnia</a></h2>
    </header>
    <div className="pane-body">
      <ul className="sidebar-items">
        {[0, 1, 2, 3, 4].map((i) => {
          return <li key={i} className={'sidebar-item ' + (i === 0 ? 'active': '')}>
            <a href="#">Item 1</a>
          </li>;
        })}
      </ul>
    </div>
  </aside>
);

Sidebar.propTypes = {};

export default Sidebar;
