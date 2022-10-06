import EventEmitter from 'events';
import React from 'react';
import { ComponentType, useEffect, useState } from 'react';
import { OverlayContainer, OverlayProvider } from 'react-aria';
import { useOverlayTriggerState } from 'react-stately';

export interface ModalComposition<T> {
  component: ComponentType<T>;
  props?: T;
}

const MODAL_TRIGGER = 'modal';
const $onModal = new EventEmitter();

interface UseGlobalModal<T> {
  showModal: (instance: ModalComposition<T>) => void;
  hideModal: () => void;
}
export function useGlobalModal<T>(): UseGlobalModal<T> {
  const showModal = (instance: ModalComposition<T>) => {
    $onModal.emit('modal', instance);
  };
  const hideModal = () => {
    $onModal.emit('modal', null);
  };

  return { showModal, hideModal };
}
export const GlobalMoal = () => {
  const state = useOverlayTriggerState({});
  const [composition, setComposition] = useState<ModalComposition<any> | null>();

  useEffect(() => {
    const handler = (instance: ModalComposition<any> | null) => {
      const composed = instance ? {
        component: instance.component,
        props: { ...instance.props, onClose: state.close },
      } : null;
      setComposition(composed);
    };

    $onModal.on(MODAL_TRIGGER, handler);

    return () => {
      $onModal.off(MODAL_TRIGGER, handler);
    };
  }, [state.close]);

  useEffect(() => {
    composition ? state.open() : state.close();
  }, [composition, state]);

  useEffect(() => {
    if (!state.isOpen) {
      setComposition(null);
    }
  }, [state.isOpen]);

  if (!state.isOpen || !composition?.component) {
    return null;
  }

  const { component: Modal, props } = composition;
  console.log(props);
  return (
    <OverlayProvider>
      <OverlayContainer>
        <Modal {...props} />
      </OverlayContainer>
    </OverlayProvider>
  );
};
