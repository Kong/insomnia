import React, { useEffect, useMemo, useRef, useState } from 'react';
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

import { generateId } from '../../../../common/misc';
import {
  decryptSecretValue,
  encryptSecretValue,
  type EnvironmentKvPairData,
  EnvironmentKvPairDataType,
} from '../../../../models/environment';
import { base64decode } from '../../../../utils/vault';
import { PromptButton } from '../../base/prompt-button';
import { OneLineEditor } from '../../codemirror/one-line-editor';
import { Icon } from '../../icon';
import { showModal } from '../../modals';
import { AskModal } from '../../modals/ask-modal';
import { CodePromptModal, type CodePromptModalHandle } from '../../modals/code-prompt-modal';
import { Tooltip } from '../../tooltip';
import { checkNestedKeys, ensureKeyIsValid } from '../environment-utils';
import { PasswordInput } from './password-input';

interface EditorProps {
  data: EnvironmentKvPairData[];
  onChange: (newPair: EnvironmentKvPairData[]) => void;
  vaultKey?: string;
  isPrivate?: boolean;
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
  });

  return <Button {...restProps} ref={btnRef} />;
};

export const EnvironmentKVEditor = ({ data, onChange, vaultKey = '', isPrivate = false }: EditorProps) => {
  const kvPairs: EnvironmentKvPairData[] = useMemo(
    () => (data.length > 0 ? [...data] : [createNewPair()]),
    // Ensure same array data will not generate different kvPairs to avoid flash issue
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(data)],
  );
  const codeModalRef = useRef<CodePromptModalHandle>(null);
  const [kvPairError, setKvPairError] = useState<{ id: string; error: string }[]>([]);
  const symmetricKey = vaultKey === '' ? {} : base64decode(vaultKey, true);

  const commonItemTypes = [
    {
      id: EnvironmentKvPairDataType.STRING,
      name: 'Text',
    },
    {
      id: EnvironmentKvPairDataType.JSON,
      name: 'JSON',
    },
  ];
  const secretItemType = [{ id: EnvironmentKvPairDataType.SECRET, name: 'Secret' }];
  // Use private environment to store vault secrets if vault key is available
  const kvPairItemTypes = isPrivate && !!vaultKey ? commonItemTypes.concat(secretItemType) : commonItemTypes;

  const repositionInArray = (moveItems: string[], targetIndex: number) => {
    const removed = kvPairs.filter(pair => pair.id !== moveItems[0]);
    const itemToMove = kvPairs.find(pair => pair.id === moveItems[0]);
    if (itemToMove) {
      return [...removed.slice(0, targetIndex), itemToMove, ...removed.slice(targetIndex)];
    }
    return kvPairs;
  };

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: keys => [...keys].map(key => ({ 'text/plain': key.toString() })),
    onReorder(e) {
      const moveItems = [...e.keys].map(key => key.toString());
      const targetIndex = kvPairs.findIndex(pair => pair.id === e.target.key.toString());
      onChange(repositionInArray(moveItems, targetIndex));
    },
    renderDragPreview(items) {
      const pair = kvPairs.find(pair => pair.id === items[0]['text/plain']) || createNewPair();
      const element = document.querySelector(`[data-key="${pair.id}"]`);

      return (
        <div
          className="flex h-[--line-height-sm] bg-[--color-bg] outline-none"
          style={{
            width: element?.clientWidth,
          }}
        >
          {renderPairItem(pair)}
        </div>
      );
    },
    renderDropIndicator(target) {
      return <DropIndicator target={target} className="!border-none outline outline-1 outline-[--color-surprise]" />;
    },
  });

  const handleItemChange = <K extends keyof EnvironmentKvPairData>(
    id: string,
    changedPropertyName: K,
    newValue: EnvironmentKvPairData[K],
  ) => {
    const changedItemIdx = kvPairs.findIndex(p => p.id === id);
    if (changedItemIdx !== -1) {
      const changedItem = kvPairs[changedItemIdx];
      // enable item since user modifies the item unless manual disbale it
      changedItem['enabled'] = true;
      changedItem[changedPropertyName] = newValue;
      // update value to emptfy object json string when switch to json type and current value is empty string
      if (newValue === EnvironmentKvPairDataType.JSON && changedItem.value.trim() === '') {
        changedItem.value = JSON.stringify({});
      }
    }
    onChange(kvPairs);
  };

  const handleItemTypeChange = (id: string, newType: EnvironmentKvPairDataType) => {
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
              handleItemChange(id, 'value', decryptSecretValue(originValue, symmetricKey));
            }
          },
        });
      } else if (newType === EnvironmentKvPairDataType.SECRET) {
        // encrypt value if set to secret type
        handleItemChange(id, 'value', encryptSecretValue(originValue, symmetricKey));
        handleItemChange(id, 'type', newType);
      } else {
        handleItemChange(id, 'type', newType);
      }
    }
  };

  const handleAddItem = (id?: string) => {
    const newPair = createNewPair();
    const insertIdx = id ? kvPairs.findIndex(d => d.id === id) : kvPairs.length - 1;
    kvPairs.splice(insertIdx === -1 ? 0 : insertIdx + 1, 0, newPair);
    onChange(kvPairs);
  };

  const handleDeleteItem = (id: string) => {
    const filteredPairs = kvPairs.filter(d => d.id !== id);
    onChange(filteredPairs);
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
    const itemIndex = kvPairs.findIndex(pair => pair.id === id);
    const itemError = kvPairError.find(p => p.id === id);
    const hasItemWithSameNameAfter =
      name !== '' && kvPairs.slice(itemIndex + 1).some(pair => pair.name.trim() === name.trim() && pair.enabled);
    const isValidJSONString = checkValidJSONString(value);
    return (
      <>
        <div
          slot="drag"
          className={`${cellCommonStyle} flex w-6 flex-shrink-0 items-center justify-end border-l border-r-0`}
          style={{ padding: 0 }}
        >
          <Icon icon="grip-vertical" className="mr-1 cursor-grab" />
        </div>
        <div className={`${cellCommonStyle} relative flex h-full w-[30%] flex-grow pl-1`}>
          <OneLineEditor
            id={`environment-kv-editor-name-${id}`}
            placeholder={'Input Name'}
            defaultValue={name}
            readOnly={!enabled}
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
              <i className="fa fa-exclamation-circle text-[--color-danger]" />
            </Tooltip>
          )}
          {hasItemWithSameNameAfter && (
            <Tooltip message={`Duplicate name: ${name}. Only the last item with same name will be used.`} delay={200}>
              <i className="fa fa-exclamation-circle text-[--color-warning]" />
            </Tooltip>
          )}
        </div>
        <div className={`${cellCommonStyle} relative w-[50%]`}>
          {type === EnvironmentKvPairDataType.STRING && (
            <OneLineEditor
              id={`environment-kv-editor-value-${id}`}
              placeholder={'Input Value'}
              defaultValue={value.toString()}
              readOnly={!enabled}
              onChange={newValue => handleItemChange(id, 'value', newValue)}
            />
          )}
          {type === EnvironmentKvPairDataType.JSON && (
            <ItemButton
              className="flex w-full flex-1 items-center justify-center gap-2 overflow-hidden rounded-sm px-2 py-1 text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
              tabIndex={-1}
              isDisabled={!enabled}
              onPress={() => {
                if (codeModalRef.current) {
                  const modalRef = codeModalRef.current;
                  modalRef.setError('');
                  modalRef.show({
                    submitName: 'Done',
                    title: `Edit ${name} value`,
                    enableRender: true,
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
              enabled={enabled}
              placeholder="Input Secret"
              value={decryptSecretValue(value, symmetricKey)}
              onChange={newValue => {
                const encryptedValue = encryptSecretValue(newValue, symmetricKey);
                handleItemChange(id, 'value', encryptedValue);
              }}
            />
          )}
        </div>
        <div className={`${cellCommonStyle} w-32`}>
          <MenuTrigger>
            <ItemButton
              className="flex w-full flex-1 items-center justify-between rounded-sm px-[--padding-sm] py-1 text-sm font-bold text-[--color-font] hover:bg-[--hl-xs] aria-pressed:bg-[--hl-sm]"
              tabIndex={-1}
              aria-label="Type Selection"
            >
              <span className="flex items-center justify-center gap-2 truncate">
                {kvPairItemTypes.find(t => t.id === type)?.name}
              </span>
              <Icon icon="caret-down" />
            </ItemButton>
            <Popover className="border-solid border-[--hl-sm] bg-[--color-bg] shadow-lg">
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
                    className="text-md react-aria-ListBoxItem flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap bg-transparent pl-[--padding-sm] pr-[--padding-xl] text-sm text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none aria-disabled:cursor-not-allowed aria-disabled:bg-transparent aria-disabled:text-[--hl-lg] aria-selected:font-bold"
                    aria-label={item.name}
                    onAction={() => handleItemTypeChange(id, item.id)}
                  >
                    {({ isSelected }) => (
                      <>
                        <span>{item.name}</span>
                        {isSelected && <Icon icon="check" className="justify-self-end text-[--color-success]" />}
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
            className="flex aspect-square h-7 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md]"
            tabIndex={-1}
            aria-label={enabled ? 'Disable Row' : 'Enable Row'}
            onPress={() => handleItemChange(id, 'enabled', !enabled)}
          >
            <Icon icon={enabled ? 'check-square' : 'square'} />
          </ItemButton>
          <PromptButton
            className="flex aspect-square h-7 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] disabled:opacity-50 aria-pressed:bg-[--hl-sm]"
            fullWidth
            confirmMessage=""
            doneMessage=""
            ariaLabel="Delete Row"
            tabIndex={-1}
            onClick={() => handleDeleteItem(id)}
          >
            <Icon icon="trash-can" />
          </PromptButton>
        </div>
      </>
    );
  };

  return (
    <div className="flex h-full min-w-max flex-col overflow-hidden">
      <Toolbar className="content-box z-10 flex h-[var(--line-height-sm)] flex-shrink-0 bg-[var(--color-bg)] text-[var(--font-size-sm)]">
        <Button
          className="flex h-full items-center justify-center gap-2 px-4 py-1 text-xs text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
          aria-label="Add Row"
          onPress={() => {
            handleAddItem();
          }}
        >
          <Icon icon="plus" /> Add
        </Button>
        <PromptButton
          disabled={kvPairs.length === 0}
          onClick={() => {
            onChange([]);
          }}
          ariaLabel="Delete All"
          className="flex h-full items-center justify-center gap-2 px-4 py-1 text-xs text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
        >
          <Icon icon="trash-can" />
          <span>Delete all</span>
        </PromptButton>
      </Toolbar>
      <ListBox
        aria-label="Environment Key Value Pair"
        selectionMode="none"
        dragAndDropHooks={dragAndDropHooks}
        dependencies={[kvPairError, data, symmetricKey]}
        className="h-full w-full overflow-y-auto p-[--padding-sm]"
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
              className={'flex h-[--line-height-sm] w-full focus:outline-none'}
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
