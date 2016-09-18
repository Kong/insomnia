import React, {PropTypes, Component} from 'react';
import ReactDOM from 'react-dom';


class ElmComponent extends Component {
  componentWillReceiveProps (nextProps) {
    const componentProps = this._extractProps(nextProps);
    this.app.ports.replaceModel.send(componentProps);
  }

  shouldComponentUpdate () {
    return false;
  }

  componentDidMount () {
    const node = ReactDOM.findDOMNode(this);
    if (!node) {
      // Node is null if component is not mounted
      return;
    }

    // Make sure to remove existing Elm app if it's there
    node.innerHTML = '';

    const {component, ports} = this.props;
    const componentProps = this._extractProps(this.props);
    this.app = component.embed(node, componentProps);

    // Bind the port listeners
    if (ports) {
      for (const name of Object.keys(ports)) {
        this.app.ports[name].subscribe(ports[name]);
      }
    }
  }

  _extractProps (props) {
    const {component, container, ...componentProps} = props;
    return componentProps;
  }

  render () {
    return this.props.container;
  }
}

ElmComponent.propTypes = {
  component: PropTypes.object.isRequired,
  container: PropTypes.object.isRequired,

  // Optional
  ports: PropTypes.object
};

export default ElmComponent
