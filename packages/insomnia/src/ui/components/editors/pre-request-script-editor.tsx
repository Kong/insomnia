import React, { FC, Fragment, useRef } from 'react';

import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown';
import { CodeEditor, CodeEditorHandle } from '../codemirror/code-editor';

interface Props {
  onChange: (value: string) => void;
  defaultValue: string;
  uniquenessKey: string;
  className?: string;
}

const getEnvVar = 'insomnia.environment.get("variable_name");\n';
// const getGlbVar = 'insomnia.globals.get("variable_name");\n';
const getVar = 'insomnia.variables.get("variable_name");\n';
const getCollectionVar = 'insomnia.collectionVariables.get("variable_name");\n';
const setEnvVar = 'insomnia.environment.set("variable_name", "variable_value");\n';
// const setGlbVar = 'insomnia.globals.set("variable_name", "variable_value");\n';
const setVar = 'insomnia.variables.set("variable_name", "variable_value");\n';
const setCollectionVar = 'insomnia.collectionVariables.set("variable_name", "variable_value");\n';
const unsetEnvVar = 'insomnia.environment.unset("variable_name");\n';
// const unsetGlbVar = 'insomnia.globals.unset("variable_name");\n';
const unsetCollectionVar = 'insomnia.collectionVariables.unset("variable_name");\n';
const sendReq =
  `const resp = await new Promise((resolve, reject) => {
  insomnia.sendRequest(
    'https://httpbin.org/anything',
    (err, resp) => {
      err != null ? reject(err) : resolve(resp);
    }
  );
});\n`;
const logValue = 'console.log("log", variableName);\n';

const lintOptions = {
  globals: {
    // https://jshint.com/docs/options/
    insomnia: true,
    pm: true,
    require: true,
    console: true,
  },
  asi: true,
  // Don't require semicolons
  undef: true,
  // Prevent undefined usages
  node: true,
  esversion: 8, // ES8 syntax (async/await, etc)
};

export const PreRequestScriptEditor: FC<Props> = ({
  className,
  defaultValue,
  onChange,
  uniquenessKey,
}) => {
  const editorRef = useRef<CodeEditorHandle>(null);

  // Inserts at the line below the cursor and moves to the line beneath
  const addSnippet = (snippet: string) => {
    const cursorRow = editorRef.current?.getCursor()?.line || 0;
    const nextRow = cursorRow + 1;
    const value = editorRef.current?.getValue() || '';

    editorRef.current?.setValue([
      ...value.split('\n').slice(0, nextRow),
      snippet,
      ...value.split('\n').slice(nextRow),
    ].join('\n'));

    editorRef.current?.focus();
    editorRef.current?.setCursorLine(cursorRow + snippet.split('\n').length);
  };

  return (
    <Fragment>
      <div className="h-[calc(100%-var(--line-height-xs))]">
        <CodeEditor
          key={uniquenessKey}
          id="pre-request-script-editor"
          showPrettifyButton={true}
          uniquenessKey={uniquenessKey}
          defaultValue={defaultValue}
          className={className}
          //   enableNunjucks
          onChange={onChange}
          mode='text/javascript'
          placeholder="..."
          lintOptions={lintOptions}
          ref={editorRef}
        />
      </div>
      <div className="h-[calc(var(--line-height-xs))] border-solid border-t border-[var(--hl-md)] text-[var(--font-size-sm)] p-[var(--padding-xs)]">
        <Dropdown
          aria-label='Snippets'
          placement='top left'
          triggerButton={
            <DropdownButton>
              <ItemContent
                icon="code"
                label='Add Snippets'
                onClick={() => addSnippet(getEnvVar)}
              />
            </DropdownButton>
          }
        >
          <DropdownItem textValue='Get an environment variable' arial-label={'Get an environment variable'}>
            <ItemContent
              icon="sliders"
              label='Get an environment variable'
              onClick={() => addSnippet(getEnvVar)}
            />
          </DropdownItem>
          {/* <DropdownItem textValue='Get a global variable' arial-label={'Get a global variable'}>
            <ItemContent
              icon="sliders"
              label='Get a global variable'
              onClick={() => addSnippet(getGlbVar)}
            />
          </DropdownItem> */}
          <DropdownItem textValue='Get a variable' arial-label={'Get a variable'}>
            <ItemContent
              icon="sliders"
              label='Get a variable'
              onClick={() => addSnippet(getVar)}
            />
          </DropdownItem>
          <DropdownItem textValue='Get a collection variable' arial-label={'Get a collection variable'}>
            <ItemContent
              icon="sliders"
              label='Get a collection variable'
              onClick={() => addSnippet(getCollectionVar)}
            />
          </DropdownItem>
          <DropdownItem textValue='Set an environment variable' arial-label={'Set an environment variable'}>
            <ItemContent
              icon="plus"
              label='Set an environment variable'
              onClick={() => addSnippet(setEnvVar)}
            />
          </DropdownItem>
          {/* <DropdownItem textValue='Set a global variable' arial-label={'Set a global variable'}>
            <ItemContent
              icon="plus"
              label='Set a global variable'
              onClick={() => addSnippet(setGlbVar)}
            />
          </DropdownItem> */}
          <DropdownItem textValue='Set a variable' arial-label={'Set a variable'}>
            <ItemContent
              icon="plus"
              label='Set a variable'
              onClick={() => addSnippet(setVar)}
            />
          </DropdownItem>
          <DropdownItem textValue='Set a collection variable' arial-label={'Set a collection variable'}>
            <ItemContent
              icon="plus"
              label='Set a collection variable'
              onClick={() => addSnippet(setCollectionVar)}
            />
          </DropdownItem>
          <DropdownItem textValue='Clear an environment variable' arial-label={'Clear an environment variable'}>
            <ItemContent
              icon="minus"
              label='Clear an environment variable'
              onClick={() => addSnippet(unsetEnvVar)}
            />
          </DropdownItem>
          {/* <DropdownItem textValue='Clear a global variable' arial-label={'Clear a global variable'}>
            <ItemContent
              icon="minus"
              label='Clear a global variable'
              onClick={() => addSnippet(unsetGlbVar)}
            />
          </DropdownItem> */}
          <DropdownItem textValue='Clear a collection variable' arial-label={'Clear a collection variable'}>
            <ItemContent
              icon="minus"
              label='Clear a collection variable'
              onClick={() => addSnippet(unsetCollectionVar)}
            />
          </DropdownItem>
          <DropdownItem textValue='Send a request' arial-label={'Send a request'}>
            <ItemContent
              icon="circle-play"
              label='Send a request'
              onClick={() => addSnippet(sendReq)}
            />
          </DropdownItem>
          <DropdownItem textValue='Print log' arial-label={'Print log'}>
            <ItemContent
              icon="print"
              label='Print log'
              onClick={() => addSnippet(logValue)}
            />
          </DropdownItem>
        </Dropdown>
      </div>
    </Fragment>
  );
};
