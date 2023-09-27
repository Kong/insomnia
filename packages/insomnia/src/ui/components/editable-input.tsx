import React, { useEffect, useState } from 'react';
import { FocusScope } from 'react-aria';
import { Button, Input } from 'react-aria-components';

export const EditableInput = ({
  value = 'Untitled',
  ariaLabel,
  name,
  onChange,
}: {
  value: string;
  ariaLabel?: string;
  name?: string;
  onChange: (value: string) => void;
}) => {
  const [isEditable, setIsEditable] = useState(false);

  useEffect(() => {
    if (!isEditable) {
      return;
    }

    const keysToLock = [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Tab',
      ' ',
    ];

    function lockKeyDownToInput(e: KeyboardEvent) {
      if (keysToLock.includes(e.key)) {
        e.stopPropagation();
      }
    }

    window.addEventListener('keydown', lockKeyDownToInput, { capture: true });

    return () => {
      window.removeEventListener('keydown', lockKeyDownToInput, {
        capture: true,
      });
    };
  }, [isEditable]);

  return (
    <>
      <Button
        className={`items-center truncate justify-center px-2 data-[pressed]:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all ${
          isEditable ? 'hidden' : ''
        }`}
        onPress={() => {
          setIsEditable(true);
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
            className="px-2 truncate"
            name={name}
            aria-label={ariaLabel}
            defaultValue={value}
            onKeyDown={e => {
              const value = e.currentTarget.value;
              if (e.key === 'Enter') {
                e.stopPropagation();
                onChange(value);
                setIsEditable(false);
              }

              if (e.key === 'Escape') {
                e.stopPropagation();
                setIsEditable(false);
              }
            }}
            onBlur={e => {
              const value = e.currentTarget.value;
              onChange(value);
              setIsEditable(false);
            }}
          />
        </FocusScope>
      )}
    </>
  );
};
