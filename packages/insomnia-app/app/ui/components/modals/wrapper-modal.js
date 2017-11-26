// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';

type Props = {};
type State = {
  title: string,
  body: React.Node
}

@autobind
class WrapperModal extends React.PureComponent<Props, State> {
  modal: ?Modal;

  constructor (props: Props) {
    super(props);

    this.state = {
      title: '',
      body: null
    };
  }

  _setModalRef (m: ?Modal) {
    this.modal = m;
  }

  show (options: Object = {}) {
    const {title, body} = options;
    this.setState({title, body});

    this.modal && this.modal.show();
  }

  render () {
    const {title, body} = this.state;

    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>{title || 'Uh Oh!'}</ModalHeader>
        <ModalBody className="wide pad">
          {body}
        </ModalBody>
      </Modal>
    );
  }
}

export default WrapperModal;
