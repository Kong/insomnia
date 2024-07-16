import React, { useEffect, useRef, useState } from 'react';
import { FocusScope } from 'react-aria';
import { Button, Input } from 'react-aria-components';

export const EditableInput = ({
  value = 'Untitled',
  ariaLabel,
  editable = false,
  name,
  className,
  onSubmit,
  onSingleClick,
  onEditableChange,
}: {
  value: string;
  ariaLabel?: string;
    editable?: boolean;
    onEditableChange?: (editable: boolean) => void;
  name?: string;
    className?: string;
    onSubmit: (value: string) => void;
    onSingleClick?: () => void;
}) => {
  const [isEditable, setIsEditable] = useState(editable);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setIsEditable(editable);
  }
    , [editable]);

  useEffect(() => {
    if (!isEditable) {
      return;
    }

    const keysToIgnore = [
      'Enter',
      'Escape',
    ];

    function lockKeyDownToInput(e: KeyboardEvent) {
      if (keysToIgnore.includes(e.key)) {
        return;
      }
      e.stopPropagation();
    }

    window.addEventListener('keydown', lockKeyDownToInput, { capture: true });

    return () => {
      window.removeEventListener('keydown', lockKeyDownToInput, {
        capture: true,
      });
    };
  }, [isEditable]);

  useEffect(() => {
    const button = buttonRef.current;
    if (button) {
      let clickTimeout: ReturnType<typeof setTimeout> | null = null;
      function onClick(e: MouseEvent) {
        e.stopPropagation();
        e.preventDefault();
        if (clickTimeout !== null) {
          clearTimeout(clickTimeout);
        }
        // If timeout passes fire the single click
        // else prevent the single click and fire the double click
        clickTimeout = setTimeout(() => {
          onSingleClick?.();
        }, 200);
      }
      button.addEventListener('click', onClick);

      function onDoubleClick(e: MouseEvent) {
        e.stopPropagation();
        e.preventDefault();
        if (clickTimeout !== null) {
          clearTimeout(clickTimeout);
          clickTimeout = null;
        }
        setIsEditable(true);
        onEditableChange?.(true);
      }

      button.addEventListener('dblclick', onDoubleClick);

      return () => {
        button.removeEventListener('click', onClick);
        button.removeEventListener('dblclick', onDoubleClick);
      };
    }

    return () => { };
  }, [onEditableChange, onSingleClick]);

  return (
    <>
      <Button
        ref={buttonRef}
        className={
          `items-center truncate justify-center data-[pressed]:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all
            ${isEditable ? 'hidden' : ''}
            ${className || 'px-2'}
          `
        }
        onPress={e => {
          if (e.pointerType !== 'mouse') {
            setIsEditable(true);
            onEditableChange?.(true);
          }
        }}
        name={name}
        aria-label={ariaLabel}
        value={value}
      >
        <span className="truncate">{value}</span>
      </Button>
      {isEditable && (
        <FocusScope contain restoreFocus autoFocus>
          <Input
            className={`truncate ${className || 'px-2'}`}
            name={name}
            aria-label={ariaLabel}
            defaultValue={value}
            onKeyDown={e => {
              const value = e.currentTarget.value;
              if (e.key === 'Enter') {
                e.stopPropagation();
                onSubmit(value);
                setIsEditable(false);
                onEditableChange?.(false);
              }

              if (e.key === 'Escape') {
                e.stopPropagation();
                setIsEditable(false);
                onEditableChange?.(false);
              }
            }}
            onBlur={e => {
              const value = e.currentTarget.value;
              onSubmit(value);
              setIsEditable(false);
              onEditableChange?.(false);
            }}
          />
        </FocusScope>
      )}
    </>
  );
};
