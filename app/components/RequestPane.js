import React from 'react'
import Editor from '../components/Editor'

const RequestPane = (props) => (
  <section id="request" className="pane col grid-v">
    <header className="header header-no-padding">
      <div className="form-control url-input">
        <div className="grid">
          <button className="btn bg-super-light method-dropdown">
            POST&nbsp;&nbsp;<i className="fa fa-caret-down"></i>
          </button>
          <input type="text" placeholder="https://google.com"/>
          <button className="btn bg-super-light send-request-button">
            <i className="fa fa-repeat txt-xl"></i>
          </button>
        </div>
      </div>
    </header>
    <div className="bg-light pane-tabs">
      {['Query Params', 'Body', 'Headers', 'Basic Auth'].map((name => {
        return <button key={name} className={'btn ' + (name === 'Body' ? 'bg-dark' : 'bg-light')}>
          {name}
        </button>
      }))}
    </div>
    <Editor value={localStorage['json']}
            onChange={(v) => {localStorage['json'] = v;}}
            options={{mode: 'application/json', lineNumbers: true}}
    ></Editor>
  </section>
);

RequestPane.propTypes = {};

export default RequestPane;
