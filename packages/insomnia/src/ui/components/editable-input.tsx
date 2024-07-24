import React, { useEffect, useRef, useState } from 'react';
import { FocusScope } from 'react-aria';
import { Input } from 'react-aria-components';

export const EditableInput = ({
  value = 'Untitled',
  ariaLabel,
  editable = false,
  name,
  className,
  onSubmit,
  onEditableChange,
}: {
  value: string;
  ariaLabel?: string;
    editable?: boolean;
    onEditableChange?: (editable: boolean) => void;
  name?: string;
    className?: string;
    onSubmit: (value: string) => void;
}) => {
  const [isEditable, setIsEditable] = useState(editable);
  const editableRef = useRef<HTMLDivElement>(null);

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

  function onDoubleClick(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    e.stopPropagation();
    e.preventDefault();

    setIsEditable(true);
    onEditableChange?.(true);
  }

  return (
    <>
      <div
        ref={editableRef}
        className={
          `items-center truncate justify-center data-[pressed]:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all
            ${isEditable ? 'hidden' : ''}
            ${className || 'px-2'}
          `
        }
        onDoubleClick={onDoubleClick}
        data-editable
        aria-label={ariaLabel}
      >
        <span className="truncate">{value}</span>
      </div>
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
