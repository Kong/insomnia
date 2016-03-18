import React from 'react'

const Sidebar = (props) => (
  <aside id="sidebar" className="pane">
    <header className="header header-clickable">
      <h2><a href="#">Insomnia</a></h2>
    </header>
    <ul className="sidebar-items">
      {[0, 1, 2, 3, 4].map((i) => {
        return <li key={i} className={'sidebar-item ' + (i === 0 ? 'active': '')}>
          <a href="#">Item 1</a>
        </li>;
      })}
    </ul>
  </aside>
);

Sidebar.propTypes = {};

export default Sidebar;
