// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';

type Props = {};
type State = {
  title: string,
  body: React.Node,
  tall: boolean
};

@autobind
class WrapperModal extends React.PureComponent<Props, State> {
  modal: ?Modal;

  constructor(props: Props) {
    super(props);

    this.state = {
      title: '',
      body: null,
      tall: false
    };
  }

  _setModalRef(m: ?Modal) {
    this.modal = m;
  }

  show(options: Object = {}) {
    const { title, body, tall } = options;
    this.setState({
      title,
      body,
      tall: !!tall
    });

    this.modal && this.modal.show();
  }

  render() {
    const { title, body, tall } = this.state;

    return (
      <Modal ref={this._setModalRef} tall={tall}>
        <ModalHeader>{title || 'Uh Oh!'}</ModalHeader>
        <ModalBody>{body}</ModalBody>
      </Modal>
    );
  }
}

export default WrapperModal;
