import React, {PropTypes, Component} from 'react'
import Sidebar from './Sidebar'
import RequestPane from './RequestPane'
import ResponsePane from './ResponsePane'

class App extends Component {
  renderEditor () {
    const {updateRequest, requests} = this.props;
    return (
      <div className="grid">
        <RequestPane
          updateRequest={updateRequest}
          request={requests.active}/>
        <ResponsePane request={requests.active}/>
      </div>
    )
  }

  render () {
    const {addRequest, loading, requests} = this.props;
    return (
      <div className="grid bg-dark">
        <Sidebar
          addRequest={addRequest}
          loading={loading}
          requests={requests}/>
        {requests.active ? this.renderEditor() : <div></div>}
      </div>
    )
  }
}

App.propTypes = {
  addRequest: PropTypes.func.isRequired,
  updateRequest: PropTypes.func.isRequired,
  requests: PropTypes.object.isRequired,
  loading: PropTypes.bool.isRequired
};

export default App;
