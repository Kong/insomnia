import { useEffect, useRef, useState } from 'react';
import { Toolbar } from 'react-aria-components';

import { PromptButton } from '~/ui/components/base/prompt-button';
import { Icon } from '~/ui/components/icon';
import { useDebouncedCallback } from '~/ui/hooks/use-debounced-callback';

interface Header {
  name: string;
  value: string;
}

interface Props {
  headers: Header[];
  onChange: (headers: Header[]) => void;
}

const EMPTY_HEADER: Header = { name: '', value: '' };

const isBlank = (header: Header) => !header.name && !header.value;

/** The last row is the "type a new header here" row, so it is never persisted. */
const withoutTrailingBlank = (rows: Header[]) =>
  rows.length > 0 && isBlank(rows[rows.length - 1]) ? rows.slice(0, -1) : rows;

const withTrailingBlank = (rows: Header[]): Header[] =>
  rows.length > 0 && isBlank(rows[rows.length - 1]) ? rows : [...rows, { ...EMPTY_HEADER }];

/**
 * Name/value editor for the example response snapshot.
 *
 * Not `KeyValueEditor`: a stored response is documentation, so the cells are
 * plain inputs (no templating, no autocomplete) and there is no reorder,
 * enable/disable or description affordance. Nothing but `{ name, value }` is
 * stored, and the editor keeps no row ids: rows are only appended and removed,
 * and the cells are controlled by the component's own row state, so a shifted
 * row simply re-renders with its own value.
 *
 * The trailing blank row is part of that state, so a new header is typed
 * straight into it — the same interaction as the request headers editor — and
 * the whole list is written once the typing pauses.
 */
export function ExampleResponseHeadersEditor({ headers, onChange }: Props) {
  const [rows, setRows] = useState(() => withTrailingBlank(headers));
  // Payloads handed to the parent that have not echoed back yet. A slow echo of
  // an earlier write can arrive after a newer one was sent, so remembering only
  // the latest payload would adopt that old echo as an external change.
  const inFlightRef = useRef(new Set([JSON.stringify(headers)]));
  const blankNameInputRef = useRef<HTMLInputElement>(null);

  const send = useDebouncedCallback((next: Header[]) => {
    const payload = withoutTrailingBlank(next);
    const serialised = JSON.stringify(payload);
    inFlightRef.current.add(serialised);
    if (inFlightRef.current.size > 10) {
      // Bounded: only recent writes can still be in flight.
      const [oldest] = inFlightRef.current;
      inFlightRef.current.delete(oldest);
    }
    onChange(payload);
  });

  // Adopt changes made elsewhere (a git pull, another window); ignore every echo
  // of a payload this editor sent. Matching must not consume the entry: one write
  // echoes more than once (optimistic patch, authoritative result, db change), and
  // an older echo arriving after newer typing would otherwise reset the rows.
  useEffect(() => {
    const incoming = JSON.stringify(headers);
    if (inFlightRef.current.has(incoming)) {
      return;
    }
    setRows(withTrailingBlank(headers));
  }, [headers]);

  const commit = (next: Header[]) => {
    const withBlank = withTrailingBlank(next);
    setRows(withBlank);
    send(withBlank);
  };

  const updateRow = (index: number, patch: Partial<Header>) => {
    commit(rows.map((row, current) => (current === index ? { ...row, ...patch } : row)));
  };

  return (
    <>
      <Toolbar className="content-box sticky top-0 z-10 flex h-(--line-height-sm) shrink-0 border-b border-(--hl-md) bg-(--color-bg) text-(--font-size-sm)">
        <PromptButton
          disabled={rows.length === 1}
          onClick={() => commit([])}
          className="flex h-full items-center justify-center gap-2 px-4 py-1 text-xs text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
        >
          <Icon icon="trash-can" />
          <span>Delete all</span>
        </PromptButton>
      </Toolbar>
      <div className="relative flex w-full flex-1 flex-col overflow-y-auto pt-1">
        {rows.map((header, index) => {
          const isTrailingBlank = index === rows.length - 1;
          return (
            <div
              // Rows are append/remove only, so the position is the identity.
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              onClick={event => {
                const target = event.target as HTMLElement;
                if (!isTrailingBlank || target.closest('input') || target.closest('button')) {
                  return;
                }
                blankNameInputRef.current?.focus();
              }}
              className="relative grid h-(--line-height-sm) shrink-0 grid-cols-[1fr_1fr_max-content] gap-2 bg-(--color-bg) px-2"
            >
              <input
                ref={isTrailingBlank ? blankNameInputRef : undefined}
                aria-label={`Header name ${index + 1}`}
                placeholder="header"
                // No typography or padding overrides: the global `input` rules
                // inherit the row's font and colour, and the focus outline is
                // suppressed so a cell looks like the request headers editor's.
                className="h-full w-full focus-visible:outline-hidden"
                value={header.name}
                onChange={event => updateRow(index, { name: event.currentTarget.value })}
              />
              <input
                aria-label={`Header value ${index + 1}`}
                placeholder="value"
                className="h-full w-full focus-visible:outline-hidden"
                value={header.value}
                onChange={event => updateRow(index, { value: event.currentTarget.value })}
              />
              <Toolbar className="flex items-center gap-1">
                <PromptButton
                  disabled={isTrailingBlank}
                  className="flex aspect-square h-7 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset disabled:opacity-50 aria-pressed:bg-(--hl-sm)"
                  confirmMessage=""
                  doneMessage=""
                  onClick={() => commit(rows.filter((_, current) => current !== index))}
                >
                  <Icon icon="trash-can" />
                </PromptButton>
              </Toolbar>
            </div>
          );
        })}
      </div>
    </>
  );
}
