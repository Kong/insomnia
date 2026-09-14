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
  // This state is used to keep track of the value while submitting when parent component value is not updated
  const [pendingValue, setPendingValue] = useState<string | null>(null);
  const editableRef = useRef<HTMLDivElement>(null);
  // Removing the focused Input from the DOM (on Enter/Escape) fires a native blur
  // synchronously, which would otherwise run onSubmit a second time (or commit after an
  // Escape cancel) and race with the next double-click's FocusScope mount.
  const settledRef = useRef(false);

  useEffect(() => {
    // set pending value to null if parent value is changed
    setPendingValue(null);
  }, [value]);

  useEffect(() => {
    setIsEditable(editable);
  }, [editable]);

  useEffect(() => {
    if (isEditable) {
      settledRef.current = false;
    }
  }, [isEditable]);

  useEffect(() => {
    if (!isEditable) {
      return;
    }

    const keysToIgnore = ['Enter', 'Escape'];

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
        className={`items-center justify-center truncate rounded-xs ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset data-pressed:bg-(--hl-sm) ${isEditable ? 'hidden' : ''} ${className || 'px-2'} `}
        onDoubleClick={onDoubleClick}
        data-editable
        aria-label={ariaLabel}
      >
        <span className="truncate">{pendingValue ?? value}</span>
      </div>
      {isEditable && (
        // No `restoreFocus`: on commit the input unmounts while the Enter keypress is
        // still in flight, and restoring focus here races the RAC collection correction,
        // landing DOM focus on a draggable row (e.g. the KV editor's trailing row) before
        // the keyup fires. RAC then reads that keyup as a keyboard drag release and
        // starts a drag session that aria-hides the whole page (frozen UI until Escape).
        // Letting focus settle on the body keeps the collection unfocused, so the drag
        // can never be armed.
        <FocusScope contain autoFocus>
          <Input
            ref={el => el?.select()}
            className={`truncate ${className || 'px-2'}`}
            name={name}
            aria-label={ariaLabel}
            defaultValue={value}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.stopPropagation();
                if (settledRef.current) {
                  return;
                }
                settledRef.current = true;
                const value = e.currentTarget.value;
                setPendingValue(value);
                onSubmit(value);
                setIsEditable(false);
                onEditableChange?.(false);
              }

              if (e.key === 'Escape') {
                e.stopPropagation();
                settledRef.current = true;
                setIsEditable(false);
                onEditableChange?.(false);
              }
            }}
            onBlur={e => {
              if (settledRef.current) {
                return;
              }
              settledRef.current = true;
              const value = e.currentTarget.value;
              setPendingValue(value);
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
