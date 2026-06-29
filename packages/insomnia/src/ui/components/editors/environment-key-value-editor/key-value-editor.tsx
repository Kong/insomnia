import type { EnvironmentKvPairData } from 'insomnia-data';
import { EnvironmentKvPairDataType } from 'insomnia-data';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  type ButtonProps,
  DropIndicator,
  ListBox,
  ListBoxItem,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Toolbar,
  useDragAndDrop,
} from 'react-aria-components';

import { checkNestedKeys, ensureKeyIsValid } from '~/common/utils/environment-utils';
import { base64decode } from '~/common/utils/vault';
import { getRuntime } from '~/runtimes';
import { OneLineEditor, type OneLineEditorHandle } from '~/ui/components/.client/codemirror/one-line-editor';

import { generateId } from '../../../../common/misc';
import { PromptButton } from '../../base/prompt-button';
import { Icon } from '../../icon';
import { showModal } from '../../modals';
import { AskModal } from '../../modals/ask-modal';
import { CodePromptModal, type CodePromptModalHandle } from '../../modals/code-prompt-modal';
import { Tooltip } from '../../tooltip';
import { PasswordInput } from './password-input';

interface EditorProps {
  data: EnvironmentKvPairData[];
  onChange: (newPair: EnvironmentKvPairData[]) => void;
  vaultKey?: string;
  isPrivate?: boolean;
  textOnly?: boolean;
  disabled?: boolean;
}
const cellCommonStyle = 'h-full px-2 flex items-center';

const createNewPair = (enabled = true): EnvironmentKvPairData => ({
  id: generateId('envPair'),
  name: '',
  value: '',
  type: EnvironmentKvPairDataType.STRING,
  enabled,
});

// Add tab index -1 to button so that user can use tab navigation to editors
const ItemButton = (props: ButtonProps & { tabIndex?: number }) => {
  const { tabIndex, ...restProps } = props;
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (btnRef.current && typeof tabIndex === 'number') {
      // add tab index
      btnRef.current.tabIndex = tabIndex;
    }
  }, [tabIndex]);

  return <Button {...restProps} ref={btnRef} />;
};

export const EnvironmentKVEditor = ({
  data,
  onChange,
  vaultKey = '',
  isPrivate = false,
  textOnly = false,
  disabled = false,
}: EditorProps) => {
  // The persisted pairs (everything that lives in the data model and shows up in diffs).
  const persistedPairs: EnvironmentKvPairData[] = useMemo(
    () => [...data],
    // Ensure same array data will not generate different kvPairs to avoid flash issue
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(data)],
  );
  const blankNameEditorRef = useRef<OneLineEditorHandle>(null);
  // The id for the trailing blank row is derived from the persisted pairs (rather than
  // held in state) so it only changes when the data actually changes. This keeps it in
  // sync with the async data updates - if it flipped eagerly the row the user just typed
  // into would briefly belong to no list and flicker.
  const blankId = useMemo(() => {
    let n = 0;
    while (persistedPairs.some(p => p.id === `envPair-blank-${n}`)) {
      n++;
    }
    return `envPair-blank-${n}`;
  }, [persistedPairs]);
  const blankPair: EnvironmentKvPairData = useMemo(
    () => ({ id: blankId, name: '', value: '', type: EnvironmentKvPairDataType.STRING, enabled: true }),
    [blankId],
  );
  // The blank row is purely visual - it is not persisted (so it never shows up in
  // diffs) until the user starts typing in it.
  const kvPairs: EnvironmentKvPairData[] = useMemo(() => [...persistedPairs, blankPair], [persistedPairs, blankPair]);
  const codeModalRef = useRef<CodePromptModalHandle>(null);
  const [kvPairError, setKvPairError] = useState<{ id: string; error: string }[]>([]);
  const [decryptedValues, setDecryptedValues] = useState<Record<string, string>>({});
  const symmetricKey = useMemo(() => (vaultKey === '' ? {} : base64decode(vaultKey, true)), [vaultKey]);

  const secretPairsKey = useMemo(
    () =>
      JSON.stringify(
        kvPairs.filter(p => p.type === EnvironmentKvPairDataType.SECRET).map(p => ({ id: p.id, value: p.value })),
      ),
    [kvPairs],
  );

  useEffect(() => {
    const secretPairs = kvPairs.filter(p => p.type === EnvironmentKvPairDataType.SECRET);
    if (secretPairs.length === 0 || Object.keys(symmetricKey).length === 0) {
      setDecryptedValues({});
      return;
    }
    let cancelled = false;
    Promise.all(
      secretPairs.map(async p => ({
        id: p.id,
        value: await getRuntime().crypto.decryptSecretValue(p.value, symmetricKey as JsonWebKey),
      })),
    )
      .then(results => {
        if (!cancelled) {
          setDecryptedValues(Object.fromEntries(results.map(r => [r.id, r.value])));
        }
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [secretPairsKey, symmetricKey, kvPairs]);

  const commonItemTypes = [
    {
      id: EnvironmentKvPairDataType.STRING,
      name: 'Text',
    },
  ];
  if (!textOnly) {
    commonItemTypes.push({
      id: EnvironmentKvPairDataType.JSON,
      name: 'JSON',
    });
  }
  const secretItemType = [{ id: EnvironmentKvPairDataType.SECRET, name: 'Secret' }];
  // Use private environment to store vault secrets if vault key is available
  const kvPairItemTypes = isPrivate && !!vaultKey ? commonItemTypes.concat(secretItemType) : commonItemTypes;

  const repositionInArray = (moveItems: string[], targetIndex: number) => {
    const removed = persistedPairs.filter(pair => pair.id !== moveItems[0]);
    const itemToMove = persistedPairs.find(pair => pair.id === moveItems[0]);
    if (itemToMove) {
      return [...removed.slice(0, targetIndex), itemToMove, ...removed.slice(targetIndex)];
    }
    return persistedPairs;
  };

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: keys => [...keys].map(key => ({ 'text/plain': key.toString() })),
    onReorder(e) {
      const moveItems = [...e.keys].map(key => key.toString());
      // The blank row is not a real pair, so it can't be reordered.
      if (moveItems.includes(blankId)) {
        return;
      }
      const targetIndex = persistedPairs.findIndex(pair => pair.id === e.target.key.toString());
      onChange(repositionInArray(moveItems, targetIndex === -1 ? persistedPairs.length : targetIndex));
    },
    renderDragPreview(items) {
      const pair = kvPairs.find(pair => pair.id === items[0]['text/plain']) || createNewPair();
      const element = document.querySelector(`[data-key="${pair.id}"]`);

      return (
        <div
          className="flex h-(--line-height-sm) bg-(--color-bg) outline-hidden"
          style={{
            width: element?.clientWidth,
          }}
        >
          {renderPairItem(pair)}
        </div>
      );
    },
    renderDropIndicator(target) {
      return (
        <DropIndicator target={target} className="border-none! outline-1 outline-(--color-surprise) outline-solid" />
      );
    },
  });

  const handleItemChange = <K extends keyof EnvironmentKvPairData>(
    id: string,
    changedPropertyName: K,
    newValue: EnvironmentKvPairData[K],
  ) => {
    // Editing the blank row commits it as a real pair. A fresh blank row appears on the
    // next render once the persisted data updates (blankId is derived from it).
    if (id === blankId) {
      const newPair: EnvironmentKvPairData = { ...blankPair, enabled: true, [changedPropertyName]: newValue };
      if (newValue === EnvironmentKvPairDataType.JSON && newPair.value.trim() === '') {
        newPair.value = JSON.stringify({});
      }
      onChange([...persistedPairs, newPair]);
      return;
    }
    // Mutate the persisted working copy in place so sequential calls (e.g. the secret
    // type switch, which changes value then type) accumulate onto the same item.
    const changedItemIdx = persistedPairs.findIndex(p => p.id === id);
    if (changedItemIdx !== -1) {
      const changedItem = persistedPairs[changedItemIdx];
      // enable item since user modifies the item unless manual disable it
      changedItem['enabled'] = true;
      changedItem[changedPropertyName] = newValue;
      // update value to empty object json string when switch to json type and current value is empty string
      if (newValue === EnvironmentKvPairDataType.JSON && changedItem.value.trim() === '') {
        changedItem.value = JSON.stringify({});
      }
    }
    onChange(persistedPairs);
  };

  const handleItemTypeChange = async (id: string, newType: EnvironmentKvPairDataType) => {
    const targetItem = kvPairs.find(pair => pair.id === id);
    if (targetItem) {
      const { type: originType, value: originValue } = targetItem;
      if (originType === newType) {
        return;
      }
      if (originType === EnvironmentKvPairDataType.SECRET) {
        const newTypeDisplayText = kvPairItemTypes.find(item => item.id === newType)?.name;
        // need confirm if user changes from secret type which will decrypt and reveal value;
        showModal(AskModal, {
          title: `Change from Secret to ${newTypeDisplayText}`,
          message:
            'This will make the value unmasked and unencrypted. Besides, none-secret item will not be wrapped with vault namespace when using as environment variable.',
          yesText: 'Change',
          noText: 'Cancel',
          onDone: async (yes: boolean) => {
            if (yes) {
              handleItemChange(id, 'type', newType);
              // decrypt and save the value
              handleItemChange(
                id,
                'value',
                await getRuntime().crypto.decryptSecretValue(originValue, symmetricKey as JsonWebKey),
              );
            }
          },
        });
      } else if (newType === EnvironmentKvPairDataType.SECRET) {
        // encrypt value if set to secret type
        handleItemChange(
          id,
          'value',
          await getRuntime().crypto.encryptSecretValue(originValue, symmetricKey as JsonWebKey),
        );
        handleItemChange(id, 'type', newType);
      } else {
        handleItemChange(id, 'type', newType);
      }
    }
  };

  const handleAddItem = (id?: string) => {
    const newPair = createNewPair();
    const insertIdx = id ? persistedPairs.findIndex(d => d.id === id) : persistedPairs.length - 1;
    const next = [...persistedPairs];
    next.splice(insertIdx === -1 ? next.length : insertIdx + 1, 0, newPair);
    onChange(next);
  };

  const handleDeleteItem = (id: string) => {
    onChange(persistedPairs.filter(d => d.id !== id));
  };

  const checkValidJSONString = (input: string) => {
    try {
      JSON.parse(input);
      return true;
    } catch {
      return false;
    }
  };

  const renderPairItem = (kvPair: EnvironmentKvPairData) => {
    const { id, name, value, type, enabled = false } = kvPair;
    const isBlank = id === blankId;
    const itemIndex = kvPairs.findIndex(pair => pair.id === id);
    const itemError = kvPairError.find(p => p.id === id);
    const hasItemWithSameNameAfter =
      name !== '' && kvPairs.slice(itemIndex + 1).some(pair => pair.name.trim() === name.trim() && pair.enabled);
    const isValidJSONString = checkValidJSONString(value);
    return (
      <>
        {!disabled && (
          <div
            slot="drag"
            className={`${cellCommonStyle} flex w-6 shrink-0 items-center justify-end border-r-0 border-l`}
            style={{ padding: 0 }}
          >
            <Icon icon="grip-vertical" className={`mr-1 ${isBlank ? 'invisible' : 'cursor-grab'}`} />
          </div>
        )}
        <div className={`${cellCommonStyle} relative flex h-full w-[30%] grow pl-1`}>
          <OneLineEditor
            ref={isBlank ? blankNameEditorRef : undefined}
            id={`environment-kv-editor-name-${id}`}
            placeholder={'Input Name'}
            defaultValue={name}
            readOnly={!enabled || disabled}
            onChange={newName => {
              // check filed names for invalid '$' for '.' sign
              const error = ensureKeyIsValid(newName, true);
              if (error) {
                if (itemError) {
                  setKvPairError(kvPairError.map(p => (p.id === id ? { id, error } : p)));
                } else {
                  setKvPairError([...kvPairError, { id, error }]);
                }
              } else {
                if (itemError) {
                  setKvPairError(kvPairError.filter(p => p.id !== id));
                }
                handleItemChange(id, 'name', newName);
              }
            }}
          />
          {itemError && (
            <Tooltip message={itemError.error} delay={200}>
              <i className="fa fa-exclamation-circle text-(--color-danger)" />
            </Tooltip>
          )}
          {hasItemWithSameNameAfter && (
            <Tooltip message={`Duplicate name: ${name}. Only the last item with same name will be used.`} delay={200}>
              <i className="fa fa-exclamation-circle text-(--color-warning)" />
            </Tooltip>
          )}
        </div>
        <div className={`${cellCommonStyle} relative w-[50%]`}>
          {type === EnvironmentKvPairDataType.STRING && (
            <OneLineEditor
              id={`environment-kv-editor-value-${id}`}
              placeholder={'Input Value'}
              defaultValue={value.toString()}
              readOnly={!enabled || disabled}
              onChange={newValue => handleItemChange(id, 'value', newValue)}
            />
          )}
          {type === EnvironmentKvPairDataType.JSON && (
            <ItemButton
              className="flex w-full flex-1 items-center justify-center gap-2 overflow-hidden rounded-xs px-2 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
              tabIndex={-1}
              isDisabled={!enabled || disabled}
              onPress={() => {
                if (codeModalRef.current) {
                  const modalRef = codeModalRef.current;
                  modalRef.setError('');
                  modalRef.show({
                    submitName: 'Done',
                    title: `Edit ${name} value`,
                    defaultValue: value.toString(),
                    mode: 'application/json',
                    onChange: (value: string) => {
                      modalRef.setError('');
                      try {
                        const err = checkNestedKeys(JSON.parse(value));
                        if (err) {
                          modalRef.setError(err);
                        } else {
                          handleItemChange(id, 'value', value);
                        }
                      } catch (error) {
                        modalRef.setError(error.message);
                      }
                    },
                    hideMode: true,
                  });
                }
              }}
            >
              <i className="fa fa-pencil-square-o space-right" aria-label="Edit JSON" />
              Click to Edit
            </ItemButton>
          )}
          {type === EnvironmentKvPairDataType.SECRET && (
            <PasswordInput
              itemId={id}
              enabled={enabled && !disabled}
              placeholder="Input Secret"
              value={decryptedValues[id] ?? ''}
              onChange={async newValue => {
                const encryptedValue = await getRuntime().crypto.encryptSecretValue(
                  newValue,
                  symmetricKey as JsonWebKey,
                );
                handleItemChange(id, 'value', encryptedValue);
              }}
            />
          )}
        </div>
        <div className={`${cellCommonStyle} w-32`}>
          <MenuTrigger>
            <ItemButton
              className="flex w-full flex-1 items-center justify-between rounded-xs px-(--padding-sm) py-1 text-sm font-bold text-(--color-font) hover:bg-(--hl-xs) aria-pressed:bg-(--hl-sm)"
              tabIndex={-1}
              aria-label="Type Selection"
              isDisabled={disabled}
            >
              <span className="flex items-center justify-center gap-2 truncate">
                {kvPairItemTypes.find(t => t.id === type)?.name}
              </span>
              <Icon icon="caret-down" />
            </ItemButton>
            <Popover className="border-solid border-(--hl-sm) bg-(--color-bg) shadow-lg">
              <Menu
                aria-label="environment-kv-editor-type-selector"
                selectionMode="single"
                selectedKeys={[type]}
                // Only valid json string or empty string allowed to convert to JSON type
                disabledKeys={isValidJSONString || value.trim() === '' ? [] : [EnvironmentKvPairDataType.JSON]}
                items={kvPairItemTypes}
              >
                {item => (
                  <MenuItem
                    key={item.id}
                    id={item.id}
                    className="react-aria-ListBoxItem flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent pr-(--padding-xl) pl-(--padding-sm) text-sm whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden aria-disabled:cursor-not-allowed aria-disabled:bg-transparent aria-disabled:text-(--hl-lg) aria-selected:font-bold"
                    aria-label={item.name}
                    onAction={() => handleItemTypeChange(id, item.id)}
                  >
                    {({ isSelected }) => (
                      <>
                        <span>{item.name}</span>
                        {isSelected && <Icon icon="check" className="justify-self-end text-(--color-success)" />}
                      </>
                    )}
                  </MenuItem>
                )}
              </Menu>
            </Popover>
          </MenuTrigger>
        </div>
        <div className={`${cellCommonStyle} w-20`}>
          <ItemButton
            className="flex aspect-square h-7 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset"
            tabIndex={-1}
            aria-label={enabled ? 'Disable Row' : 'Enable Row'}
            isDisabled={disabled}
            onPress={() => handleItemChange(id, 'enabled', !enabled)}
          >
            <Icon icon={enabled ? 'check-square' : 'square'} />
          </ItemButton>
          <PromptButton
            className="flex aspect-square h-7 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset disabled:opacity-50 aria-pressed:bg-(--hl-sm)"
            fullWidth
            confirmMessage=""
            doneMessage=""
            ariaLabel="Delete Row"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => handleDeleteItem(id)}
          >
            <Icon icon="trash-can" />
          </PromptButton>
        </div>
      </>
    );
  };

  return (
    <div
      className="flex h-full min-w-max flex-col overflow-hidden"
      // Clicking anywhere on the blank row drops the cursor into its name editor so the
      // user can immediately start typing, unless they clicked directly on an editor or
      // control.
      onClick={event => {
        const target = event.target as HTMLElement;
        if (target.closest('.editor--single-line') || target.closest('button')) {
          return;
        }
        if ((target.closest('[data-key]') as HTMLElement | null)?.dataset.key === blankId) {
          blankNameEditorRef.current?.focusEnd();
        }
      }}
    >
      <Toolbar className="content-box z-10 flex h-(--line-height-sm) shrink-0 bg-(--color-bg) text-(--font-size-sm)">
        <Button
          className="flex h-full items-center justify-center gap-2 px-4 py-1 text-xs text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
          aria-label="Add Row"
          isDisabled={disabled}
          onPress={() => {
            handleAddItem();
          }}
        >
          <Icon icon="plus" /> Add
        </Button>
        <PromptButton
          disabled={disabled || persistedPairs.length === 0}
          onClick={() => {
            onChange([]);
          }}
          ariaLabel="Delete All"
          className="flex h-full items-center justify-center gap-2 px-4 py-1 text-xs text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
        >
          <Icon icon="trash-can" />
          <span>Delete all</span>
        </PromptButton>
      </Toolbar>
      <ListBox
        aria-label="Environment Key Value Pair"
        selectionMode="none"
        dragAndDropHooks={dragAndDropHooks}
        dependencies={[kvPairError, data, symmetricKey, blankId]}
        className="h-full w-full overflow-y-auto p-(--padding-sm)"
        items={kvPairs}
      >
        {kvPair => {
          const { id, name, enabled } = kvPair;
          return (
            <ListBoxItem
              key={id}
              id={id}
              textValue={`environment-item-${name || id}`}
              style={{ opacity: enabled ? '1' : '0.4' }}
              className={'flex h-(--line-height-sm) w-full focus:outline-hidden'}
            >
              {renderPairItem(kvPair)}
            </ListBoxItem>
          );
        }}
      </ListBox>
      <CodePromptModal ref={codeModalRef} />
    </div>
  );
};
EnvironmentKVEditor.displayName = 'EnvironmentKeyValueEditor';
