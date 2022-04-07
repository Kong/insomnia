import { fireEvent, render, screen } from "@testing-library/react";
import React, { FunctionComponent, useEffect, useRef } from "react";
import userEvent from "@testing-library/user-event";

import * as constants from "../../../../common/constants";
import { Modal, ModalProps } from "../../base/modal";
import { ModalBody } from "../../base/modal-body";
import { ModalFooter } from "../../base/modal-footer";
import { ModalHeader } from "../../base/modal-header";
import { KeydownBinder } from "../../keydown-binder";

describe('<Modal />', () => {
  const MockedModalContainer = () => {
    const ref = useRef<Modal>(null);

    const handleOpen = () => {
      ref.current?.show();
    };

    return (
      <div>
        <button type="button" onClick={handleOpen}>open</button>
        <Modal ref={ref}>
          <ModalHeader>modal header</ModalHeader>
          <ModalBody>modal body</ModalBody>
          <ModalFooter>modal footer</ModalFooter>
        </Modal>
      </div>
    );
  };

  it('renders without exploding', async () => {
    render(<MockedModalContainer />);
    const modalSelf = screen.queryByRole('dialog');
    expect(modalSelf).not.toBeInTheDocument();

    const btn = screen.getByRole('button', { name: 'open' });
    expect(btn).toBeInTheDocument();
  });

  it('opens a modal when triggered', async () => {
    render(<MockedModalContainer />);
    const modalSelf = screen.queryByRole('dialog');
    expect(modalSelf).not.toBeInTheDocument();

    const btn = screen.getByRole('button', { name: 'open' });
    expect(btn).toBeInTheDocument();

    await userEvent.click(btn);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('modal header')).toBeInTheDocument();
    expect(screen.getByText('modal body')).toBeInTheDocument();
    expect(screen.getByText('modal footer')).toBeInTheDocument();
  });

  it('closes a modal when overlay is clicked', async () => {
    const { container } = render(<MockedModalContainer />);

    const modalSelf = screen.queryByRole('dialog');
    expect(modalSelf).not.toBeInTheDocument();

    const btn = screen.getByRole('button', { name: 'open' });
    expect(btn).toBeInTheDocument();

    await userEvent.click(btn);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('modal header')).toBeInTheDocument();
    expect(screen.getByText('modal body')).toBeInTheDocument();
    expect(screen.getByText('modal footer')).toBeInTheDocument();

    const overlayElement = container.querySelector('.overlay');
    expect(overlayElement).toBeInTheDocument();

    await userEvent.click(overlayElement as Element);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes a modal when close btn is clicked', async () => {
    render(<MockedModalContainer />);

    const modalSelf = screen.queryByRole('dialog');
    expect(modalSelf).not.toBeInTheDocument();

    const btn = screen.getByRole('button', { name: 'open' });
    expect(btn).toBeInTheDocument();

    await userEvent.click(btn);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    const closeBtn = screen.getByTitle('Click to close a modal').closest('button');
    expect(closeBtn).toBeInTheDocument();
    expect(closeBtn).toHaveAttribute('data-close-modal');

    await userEvent.click(closeBtn as Element);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('<Modal /> with <KeydownBinder />', () => {
  const MockedModalContainer: FunctionComponent<ModalProps> = (props) => {
    const ref = useRef<Modal>(null);

    useEffect(() => {
      ref.current?.show();
    }, []);

    return (
      <div>
        <Modal ref={ref} {...props}>
          <ModalHeader>modal header</ModalHeader>
          <ModalBody>modal body</ModalBody>
          <ModalFooter>modal footer</ModalFooter>
        </Modal>
      </div>
    );
  };

  // for non-Mac
  it('renders for non-Mac with stopMetaPropagation:true as a default prop', async () => {
    jest.spyOn(constants, 'isMac').mockImplementation(() => false);

    const onKeydownMock = jest.fn();

    render(
      <KeydownBinder
        captureEvent={false}
        onKeydown={onKeydownMock}
      >
        <MockedModalContainer/>
      </KeydownBinder>,
    );

    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    const modalSelf = screen.getByRole('dialog');
    expect(modalSelf).toBeInTheDocument();

    fireEvent.keyDown(
      modalSelf,
      {
        key: 'Control',
        keyCode: 17,
        ctrlKey: true,
      }
    );

    expect(onKeydownMock).not.toHaveBeenCalled();
  });

  it('renders for non-Mac with stopMetaPropagation:false', async () => {
    jest.spyOn(constants, 'isMac').mockImplementation(() => false);
    const onKeydownMock = jest.fn();

    render(
      <KeydownBinder
        captureEvent={false}
        onKeydown={onKeydownMock}
      >
        <MockedModalContainer stopMetaPropagation={false} />
      </KeydownBinder>,
    );

    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    const modalSelf = screen.getByRole('dialog');
    expect(modalSelf).toBeInTheDocument();

    fireEvent.keyDown(
      modalSelf,
      {
        key: 'Control',
        keyCode: 17,
        ctrlKey: true,
      }
    );

    expect(onKeydownMock).toHaveBeenCalled();
  });

  it('renders with stopMetaPropagation:true as a default prop', async () => {
    jest.spyOn(constants, 'isMac').mockImplementation(() => true);

    const onKeydownMock = jest.fn();

    render(
      <KeydownBinder
        captureEvent={false}
        onKeydown={onKeydownMock}
      >
        <MockedModalContainer/>
      </KeydownBinder>,
    );

    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    const modalSelf = screen.getByRole('dialog');
    expect(modalSelf).toBeInTheDocument();

    fireEvent.keyDown(
      modalSelf,
      {
        key: 'Meta',
        keyCode: 91,
        metaKey: true,
      }
    );

    expect(onKeydownMock).not.toHaveBeenCalled();
  });

  it('renders with stopMetaPropagation:false', async () => {
    jest.spyOn(constants, 'isMac').mockImplementation(() => true);
    const onKeydownMock = jest.fn();

    render(
      <KeydownBinder
        captureEvent={false}
        onKeydown={onKeydownMock}
      >
        <MockedModalContainer stopMetaPropagation={false} />
      </KeydownBinder>,
    );

    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    const modalSelf = screen.getByRole('dialog');
    expect(modalSelf).toBeInTheDocument();

    fireEvent.keyDown(
      modalSelf,
      {
        key: 'Meta',
        keyCode: 91,
        metaKey: true,
      }
    );

    expect(onKeydownMock).toHaveBeenCalled();
  });
});
