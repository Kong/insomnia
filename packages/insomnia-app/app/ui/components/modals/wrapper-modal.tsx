import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent, ReactNode } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { Modal } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';

interface State {
  title: string;
  body: ReactNode;
  bodyHTML?: string | null;
  tall?: boolean | null;
  skinny?: boolean | null;
  wide?: boolean | null;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class WrapperModal extends PureComponent<{}, State> {
  modal: Modal | null = null;

  state: State = {
    title: '',
    body: null,
    bodyHTML: null,
    tall: false,
    skinny: false,
    wide: false,
  };

  _setModalRef(m: Modal) {
    this.modal = m;
  }

  show(options: Record<string, any> = {}) {
    const { title, body, bodyHTML, tall, skinny, wide } = options;
    this.setState({
      title,
      body,
      bodyHTML,
      tall: !!tall,
      skinny: !!skinny,
      wide: !!wide,
    });
    this.modal?.show();
  }

  render() {
    const { title, body, bodyHTML, tall, skinny, wide } = this.state;
    let finalBody = body;

    if (bodyHTML) {
      finalBody = (
        <div
          dangerouslySetInnerHTML={{
            __html: bodyHTML,
          }}
          className="tall wide pad"
        />
      );
    }

    return (
      <Modal ref={this._setModalRef} tall={tall ?? undefined} skinny={skinny ?? undefined} wide={wide ?? undefined}>
        <ModalHeader>{title || 'Uh Oh!'}</ModalHeader>
        <ModalBody>{finalBody}</ModalBody>
      </Modal>
    );
  }
}
