import React, {PropTypes} from 'react'
import Editor from '../components/Editor'

const ResponsePane = (props) => (
  <section id="response" className="pane col grid-v">
    <header className="pane__header text-center bg-super-light">
      <div className="pane__header__content">
        <div className="tag success"><strong>200</strong> SUCCESS</div>
        <div className="tag"><strong>GET</strong> https://google.com</div>
      </div>
    </header>
    <div className="pane__body">
      <Editor value={'{}'} options={{mode: 'application/json'}}></Editor>
    </div>
  </section>
);

ResponsePane.propTypes = {
  request: PropTypes.object.isRequired
};

export default ResponsePane;
