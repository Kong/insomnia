import React, { FC, useEffect, useRef } from 'react';

interface Props {
  el: HTMLElement;
  onUnmount?: () => void;
}

/**
 * This component provides an easy way to place a raw DOM node inside a React application.
 * This was created to facilitate the layer between UI plugins and the Insomnia application.
 */
export const HtmlElementWrapper: FC<Props> = ({ el, onUnmount }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = '';
      ref.current.appendChild(el);
    }
    return () => {
      onUnmount && onUnmount();
    };
  });
  return <div ref={ref} />;
};
