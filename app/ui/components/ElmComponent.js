import React, {PropTypes, Component} from 'react';
import ReactDOM from 'react-dom';


class ElmComponent extends Component {
  constructor (props) {
    super(props);

    // To keep track of the ports we've already subscribed to
    this.proxyFunctions = {};

    // To keep the callbacks for the port proxy function to call.
    // This allows us to easily swap callbacks without resubscribing
    this.portCallbacks = {};
  }

  componentWillReceiveProps (nextProps) {
    const componentProps = this._extractProps(nextProps);
    this.app.ports.replaceModel.send(componentProps);

    const {ports} = nextProps;
    this._bindPorts(ports);
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

    this._bindPorts(ports);
  }

  _bindPorts (ports) {
    if (!ports) {
      return;
    }

    // NOTE: This is kind of hacky, but since Elm does not have a way to
    // unsubscribe from a port, we have to do this hack.
    //
    // - Create proxy function for each port we want to subscribe to
    // - Call the original function from inside the proxy
    // - This allows us to swap out the original functions while keeping the
    //   proxy functions subscribed.

    for (const name of Object.keys(ports)) {
      this.portCallbacks[name] = ports[name];

      if (!this.proxyFunctions[name]) {
        const that = this;
        const proxyFn = function () {
          that.portCallbacks[name].apply(that, arguments);
        };

        this.app.ports[name].subscribe(proxyFn);
        this.proxyFunctions[name] = proxyFn;
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
