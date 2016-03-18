import React from 'react'
import Editor from '../components/Editor'

const ResponsePane = (props) => (
  <section id="response" className="pane col grid-v bg-super-light">
    <header className="header header-no-padding text-center">
      <div>
        <div className="tag success"><strong>200</strong> SUCCESS</div>
        <div className="tag"><strong>GET</strong> https://google.com</div>
      </div>
    </header>
    <Editor value={'{}'}
            options={{mode: 'application/json', lineNumbers: true}}
    ></Editor>
  </section>
);

ResponsePane.propTypes = {};

export default ResponsePane;
