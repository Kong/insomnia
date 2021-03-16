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
  bodyHTML: ?string,
  tall: ?boolean,
  skinny: ?boolean,
  wide: ?boolean,
};

@autobind
class WrapperModal extends React.PureComponent<Props, State> {
  modal: ?Modal;

  constructor(props: Props) {
    super(props);

    this.state = {
      title: '',
      body: null,
      bodyHTML: null,
      tall: false,
      skinny: false,
      wide: false,
    };
  }

  _setModalRef(m: ?Modal) {
    this.modal = m;
  }

  show(options: Object = {}) {
    const { title, body, bodyHTML, tall, skinny, wide } = options;
    this.setState({
      title,
      body,
      bodyHTML,
      tall: !!tall,
      skinny: !!skinny,
      wide: !!wide,
    });

    this.modal && this.modal.show();
  }

  render() {
    const { title, body, bodyHTML, tall, skinny, wide } = this.state;

    let finalBody = body;
    if (bodyHTML) {
      finalBody = <div dangerouslySetInnerHTML={{ __html: bodyHTML }} className="tall wide pad" />;
    }

    return (
      <Modal ref={this._setModalRef} tall={tall} skinny={skinny} wide={wide}>
        <ModalHeader>{title || 'Uh Oh!'}</ModalHeader>
        <ModalBody>{finalBody}</ModalBody>
      </Modal>
    );
  }
}

export default WrapperModal;
