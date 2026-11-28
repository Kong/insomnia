import React, { type FC, useEffect, useRef } from 'react';

interface Props {
  // A live element from this renderer, or the HTML a plugin-window dialog serialized over IPC.
  el?: HTMLElement | string;
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
      ref.current.replaceChildren();
      if (typeof el === 'string') {
        // Markup a plugin serialized in the plugin window, so it is trusted at the same level as the
        // plugin itself (which runs with Node access).
        ref.current.innerHTML = el;
      } else if (el) {
        ref.current.append(el);
      }
    }
    return () => {
      onUnmount && onUnmount();
    };
  });
  return <div ref={ref} />;
};
