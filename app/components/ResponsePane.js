import React from 'react'
import Editor from '../components/Editor'

const ResponsePane = (props) => (
  <section id="response" className="pane col grid-v">
    <header className="pane-header header-no-padding text-center bg-super-light">
      <div>
        <div className="tag success"><strong>200</strong> SUCCESS</div>
        <div className="tag"><strong>GET</strong> https://google.com</div>
      </div>
    </header>
    <div className="pane-body">
      <Editor value={'{}'} options={{mode: 'application/json', lineNumbers: true}}></Editor>
    </div>
  </section>
);

ResponsePane.propTypes = {};

export default ResponsePane;
