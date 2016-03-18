import React from 'react'
import Editor from '../components/Editor'

const RequestPane = (props) => (
  <section id="request" className="pane col grid-v">
    <header className="pane-header pane-header-no-padding bg-super-light">
      <div className="form-control url-input">
        <div className="grid">
          <button className="btn method-dropdown">
            POST&nbsp;&nbsp;<i className="fa fa-caret-down"></i>
          </button>
          <input type="text" placeholder="https://google.com"/>
          <button className="btn send-request-button">
            <i className="fa fa-repeat txt-xl"></i>
          </button>
        </div>
      </div>
    </header>
    <div className="pane-body grid-v">
      <div className="bg-dark pane-tabs">
        {['Query Params', 'Body', 'Headers', 'Basic Auth'].map((name =>
            <button key={name} className={'btn ' + (name === 'Body' ? 'bg-dark' : 'bg-dark')}>
              {name}
            </button>
        ))}
      </div>
      <Editor value={localStorage['json']}
              onChange={(v) => {localStorage['json'] = v}}
              options={{mode: 'application/json', lineNumbers: true}}/>
    </div>
  </section>
);

RequestPane.propTypes = {};

export default RequestPane;
