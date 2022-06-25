import React, { useRef, useState } from 'react';

import { KeydownBinder } from '../keydown-binder';

export const shouldSave = (oldValue: string, newValue: string | undefined, preventBlank = false) => {
  // Should not save if length = 0 and we want to prevent blank
  if (preventBlank && !newValue?.length) {
    return false;
  }

  // Should not save if old value and new value is the same
  if (oldValue === newValue) {
    return false;
  }

  // Should save
  return true;
};

interface Props {
  blankValue?: string;
  className?: string;
  fallbackValue?: string;
  onEditStart?: Function;
  onSubmit: (value?: string) => void;
  preventBlank?: boolean;
  renderReadView?: Function;
  singleClick?: boolean;
  value: string;
}

export const Editable: React.FC<Props> = ({
  blankValue,
  className,
  fallbackValue,
  onEditStart,
  onSubmit,
  preventBlank,
  renderReadView,
  singleClick,
  value,
  ...extra
}) => {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const _handleSingleClickEditStart = () => {
    if (singleClick) {
      _handleEditStart();
    }
  };

  const _handleEditStart = () => {
    setEditing(true);

    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    if (onEditStart) {
      onEditStart();
    }
  };

  const _handleEditEnd = () => {
    if (shouldSave(value, inputRef.current?.value.trim(), preventBlank)) {
      // Don't run onSubmit for values that haven't been changed
      onSubmit(inputRef.current?.value.trim());
    }

    // This timeout prevents the UI from showing the old value after submit.
    // It should give the UI enough time to redraw the new value.
    setTimeout(() => setEditing(false), 100);
  };

  const _handleEditKeyDown = (event: KeyboardEvent) => {
    if (event.keyCode === 13) {
      // Pressed Enter
      _handleEditEnd();
    }
    if (event.keyCode === 27) {
      // Pressed Escape
      // Prevent bubbling to modals and other escape listeners.
      event.stopPropagation();

      if (inputRef.current) {
        // Set the input to the original value
        inputRef.current.value = value;

        _handleEditEnd();
      }
    }
  };
  const initialValue = value || fallbackValue;
  if (editing) {
    return (
      // KeydownBinder must be used here to properly stop propagation
      // from reaching other scoped KeydownBinders
      <KeydownBinder onKeydown={_handleEditKeyDown} scoped>
        <input
          {...extra}
          className={`editable ${className || ''}`}
          type="text"
          ref={inputRef}
          defaultValue={initialValue}
          onBlur={_handleEditEnd}
        />
      </KeydownBinder>
    );
  }
  const readViewProps = {
    className: `editable ${className} ${!initialValue && 'empty'}`,
    title: singleClick ? 'Click to edit' : 'Double click to edit',
    onClick: _handleSingleClickEditStart,
    onDoubleClick: _handleEditStart,
    ...extra,
  };
  return renderReadView ?
    renderReadView(initialValue, readViewProps)
    : <span {...readViewProps}>{initialValue || blankValue}</span>;

};
