import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';

interface Props {
  delay?: number;
}

interface State {
  show: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class Lazy extends PureComponent<Props> {
  state: State = {
    show: false,
  };

  show() {
    this.setState({
      show: true,
    });
  }

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillMount() {
    const { delay } = this.props;
    if (typeof delay === 'number' && delay < 0) {
      // Show right away if negative delay passed
      this.show();
    } else {
      setTimeout(this.show, this.props.delay || 50);
    }
  }

  render() {
    return this.state.show ? this.props.children : null;
  }
}

export default Lazy;
