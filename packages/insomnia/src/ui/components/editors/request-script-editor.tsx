import type { Snippet } from 'codemirror';
import React, { type FC, useRef } from 'react';
import {
  Button,
  Collection,
  Header,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Popover,
  Toolbar,
} from 'react-aria-components';

import { translateHandlersInScript } from '~/main/importers/importers/translate-postman-script';
import { CodeEditor, type CodeEditorHandle } from '~/ui/components/.client/codemirror/code-editor';

import autocompleteSnippets from '../../../../../insomnia-scripting-environment/src/autocomplete-snippets.json';
import { Icon } from '../icon';

interface Props {
  onChange: (value: string) => void;
  defaultValue: string;
  uniquenessKey: string;
  className?: string;
  onSnippetAdded?: (snippetName: string) => void;
}

const getEnvVar = 'insomnia.environment.get("variable_name");';
const getGlbVar = 'insomnia.globals.get("variable_name");';
const getVar = 'insomnia.variables.get("variable_name");';
const getCollectionVar = 'insomnia.collectionVariables.get("variable_name");';
const setEnvVar = 'insomnia.environment.set("variable_name", "variable_value");';
const setGlbVar = 'insomnia.globals.set("variable_name", "variable_value");';
const setVar = 'insomnia.variables.set("variable_name", "variable_value");';
const setCollectionVar = 'insomnia.collectionVariables.set("variable_name", "variable_value");';
const unsetEnvVar = 'insomnia.environment.unset("variable_name");';
const unsetGlbVar = 'insomnia.globals.unset("variable_name");';
const unsetCollectionVar = 'insomnia.collectionVariables.unset("variable_name");';
const sendReq = `const resp = await insomnia.sendRequest(
	'https://insomnia.rest/',
	(err, resp) => {
		if (err != null) {
			throw err;
		}
	}
);`;

const logValue = 'console.log("log", variableName);';
const addHeader = "insomnia.request.addHeader({key: 'X-Header-Name', value: 'header_value' });";
const removeHeader = "insomnia.request.removeHeader('X-Header-Name');";
const setMethod = "insomnia.request.method = 'GET';";
const addQueryParams = "insomnia.request.url.addQueryParams('k1=v1');";
const updateRequestBody = `insomnia.request.body.update({
  mode: 'raw',
  raw: 'rawContent',
});`;

const updateRequestAuth = `insomnia.request.auth.update(
  {
      type: 'bearer',
      bearer: [
              {key: 'token', value: 'tokenValue'},
      ],
  },
  'bearer'
);`;
const requireAModule = "const atob = require('atob');";
const delay = 'await new Promise((resolve) => setTimeout(resolve, 1000));';

const getStatusCode = 'const statusCode = insomnia.response.code;';
const getStatusMsg = 'const status = insomnia.response.status;';
const getRespTime = 'const responseTime = insomnia.response.responseTime;';
const getJsonBody = 'const jsonBody = insomnia.response.json();';
const getTextBody = 'const textBody = insomnia.response.text();';
const findHeader = `const header = insomnia.response.headers.find(
    header => header.key === 'Content-Type',
    {},
);`;
const getCookies = 'const cookies = insomnia.response.cookies.toObject();';
const skipRequest = 'insomnia.execution.skipRequest();';
const setNextRequest = 'insomnia.execution.setNextRequest("ADD_REQUEST_NAME_OR_ID_HERE");';
const activeReqPath = 'console.log(insomnia.execution.location);';
const activeReqItem = 'console.log(insomnia.execution.location.current);';
const activeReqInfo = 'console.log(insomnia.info);';

const checkStatus200 = `insomnia.test('Check if status is 200', () => {
    insomnia.expect(insomnia.response.code).to.eql(200);
});`;

const expectToEqual = 'insomnia.expect(200).to.eql(200);';
const expectToBeA = "insomnia.expect('uname').to.be.a('string');";
const expectToHaveLength = "insomnia.expect('a').to.have.lengthOf(1);";
const expectToInclude = "insomnia.expect('xxx_customer_id_yyy').to.include('customer_id');";
const expectToBeOneOf = 'insomnia.expect(201).to.be.oneOf([201,202]);';
const expectToBeBelow = 'insomnia.expect(199).to.be.below(200);';

const expectToHaveAllKeys = "insomnia.expect({a: 1, b: 2}).to.have.all.keys('a', 'b');";
const expectToHaveAnyKeys = "insomnia.expect({a: 1, b: 2}).to.have.any.keys('a', 'b');";
const expectToNotHaveAnyKeys = "insomnia.expect({a: 1, b: 2}).to.not.have.any.keys('c', 'd');";
const expectToHaveProperty = "insomnia.expect({a: 1}).to.have.property('a');";
const expectToBeAnObjectThatHasAllKeys =
  "insomnia.expect({a: 1, b: 2}).to.be.an('object').that.has.all.keys('a', 'b');";

const findFolderEnvValue = `const myEnv = insomnia.parentFolders.findValue('envKey');
console.log(myEnv);`;
const getFolderEnvValue = `const myFolder = insomnia.parentFolders.get('folderName');
if (myFolder === undefined) {
	throw Error('myFolder not found');
}
console.log(myFolder.environment.get('val'));`;
const setFolderEnvValue = `const myFolder = insomnia.parentFolders.get('myFolder');
if (myFolder === undefined) {
	throw Error('myFolder not found');
}
myFolder.environment.set('newEnvKey', 'newEnvValue');`;

const lintOptions = {
  globals: {
    // https://jshint.com/docs/options/
    insomnia: true,
    pm: true,
    require: true,
    console: true,
    _: true,
  },
  asi: true,
  // Don't require semicolons
  undef: true,
  // Prevent undefined usages
  node: true,
  // https://jshint.com/docs/options/#esversion
  esversion: 11,
};

interface SnippetMenuItem {
  id: string;
  name: string;
  items: (
    | {
        id: string;
        name: string;
        snippet: string;
      }
    | {
        id: string;
        name: string;
        items: {
          id: string;
          name: string;
          snippet: string;
        }[];
      }
  )[];
}

const variableSnippetsMenu: SnippetMenuItem = {
  id: 'variable-snippets',
  name: 'Variable Snippets',
  items: [
    {
      id: 'get-values',
      name: 'Get values',
      items: [
        {
          id: 'get-env-var',
          name: 'Get an environment variable',
          snippet: getEnvVar,
        },
        {
          id: 'get-glb-var',
          name: 'Get a global variable',
          snippet: getGlbVar,
        },
        {
          id: 'get-var',
          name: 'Get a variable',
          snippet: getVar,
        },
        {
          id: 'get-collection-var',
          name: 'Get a collection variable',
          snippet: getCollectionVar,
        },
        {
          id: 'get-folder-var',
          name: 'Get a folder-level variable',
          snippet: getFolderEnvValue,
        },
        {
          id: 'find-folder-var',
          name: 'Find a folder-level variable',
          snippet: findFolderEnvValue,
        },
      ],
    },
    {
      id: 'set-values',
      name: 'Set values',
      items: [
        {
          id: 'set-env-var',
          name: 'Set an environment variable',
          snippet: setEnvVar,
        },
        {
          id: 'set-glb-var',
          name: 'Set a global variable',
          snippet: setGlbVar,
        },
        {
          id: 'set-var',
          name: 'Set a variable',
          snippet: setVar,
        },
        {
          id: 'set-collection-var',
          name: 'Set a collection variable',
          snippet: setCollectionVar,
        },
        {
          id: 'set-folder-var',
          name: 'Set a folder-level variable',
          snippet: setFolderEnvValue,
        },
      ],
    },
    {
      id: 'clear-values',
      name: 'Clear values',
      items: [
        {
          id: 'unset-env-var',
          name: 'Clear an environment variable',
          snippet: unsetEnvVar,
        },
        {
          id: 'unset-glb-var',
          name: 'Clear a global variable',
          snippet: unsetGlbVar,
        },
        {
          id: 'unset-collection-var',
          name: 'Clear a collection variable',
          snippet: unsetCollectionVar,
        },
      ],
    },
  ],
};

const requestManipulationMenu: SnippetMenuItem = {
  id: 'request-manipulation',
  name: 'Request Manipulation',
  items: [
    {
      id: 'add-query-param',
      name: 'Add query param',
      snippet: addQueryParams,
    },
    {
      id: 'set-method',
      name: 'Set method',
      snippet: setMethod,
    },
    {
      id: 'add-header',
      name: 'Add a header',
      snippet: addHeader,
    },
    {
      id: 'remove-header',
      name: 'Remove header',
      snippet: removeHeader,
    },
    {
      id: 'update-body-raw',
      name: 'Update body as raw',
      snippet: updateRequestBody,
    },
    {
      id: 'update-auth-method',
      name: 'Update auth method',
      snippet: updateRequestAuth,
    },
  ],
};

const responseHandlingMenu: SnippetMenuItem = {
  id: 'response-handling',
  name: 'Response Handling',
  items: [
    {
      id: 'get-status-code',
      name: 'Get status code',
      snippet: getStatusCode,
    },
    {
      id: 'get-status-message',
      name: 'Get status message',
      snippet: getStatusMsg,
    },
    {
      id: 'get-response-time',
      name: 'Get response time',
      snippet: getRespTime,
    },
    {
      id: 'get-body-json',
      name: 'Get body as JSON',
      snippet: getJsonBody,
    },
    {
      id: 'get-body-text',
      name: 'Get body as text',
      snippet: getTextBody,
    },
    {
      id: 'find-header',
      name: 'Find a header by name',
      snippet: findHeader,
    },
    {
      id: 'get-cookies',
      name: 'Get cookies',
      snippet: getCookies,
    },
  ],
};

const miscMenu: SnippetMenuItem = {
  id: 'misc',
  name: 'Misc',
  items: [
    {
      id: 'send-request',
      name: 'Send a request',
      snippet: sendReq,
    },
    {
      id: 'print-log',
      name: 'Print log',
      snippet: logValue,
    },
    {
      id: 'require-module',
      name: 'Require a module',
      snippet: requireAModule,
    },
    {
      id: 'delay',
      name: 'Delay',
      snippet: delay,
    },
    {
      id: 'skip-request',
      name: 'Skip request',
      snippet: skipRequest,
    },
    {
      id: 'set-next-request',
      name: 'Set next request (in Runner)',
      snippet: setNextRequest,
    },
    {
      id: 'active-request-info',
      name: 'Active request info',
      snippet: activeReqInfo,
    },
    {
      id: 'active-request-path',
      name: 'Active request path',
      snippet: activeReqPath,
    },
    {
      id: 'active-request-item',
      name: 'Active request item',
      snippet: activeReqItem,
    },
  ],
};

const testMenu: SnippetMenuItem = {
  id: 'test-snippets',
  name: 'Test Utils',
  items: [
    {
      id: 'test-examples',
      name: 'Test Examples',
      items: [
        {
          id: 'check-status-200',
          name: 'Check if status is 200',
          snippet: checkStatus200,
        },
      ],
    },
    {
      id: 'expect-examples',
      name: 'Expect Examples',
      items: [
        {
          id: 'expect-to-equal',
          name: 'expectToEqual',
          snippet: expectToEqual,
        },
        {
          id: 'expect-to-be-a',
          name: 'expectToBeA',
          snippet: expectToBeA,
        },
        {
          id: 'expect-to-have-length',
          name: 'expectToHaveLength',
          snippet: expectToHaveLength,
        },
        {
          id: 'expect-to-include',
          name: 'expectToInclude',
          snippet: expectToInclude,
        },
        {
          id: 'expect-to-be-one-of',
          name: 'expectToBeOneOf',
          snippet: expectToBeOneOf,
        },
        {
          id: 'expect-to-be-below',
          name: 'expectToBeBelow',
          snippet: expectToBeBelow,
        },
        {
          id: 'expect-to-have-all-keys',
          name: 'expectToHaveAllKeys',
          snippet: expectToHaveAllKeys,
        },
        {
          id: 'expect-to-have-any-keys',
          name: 'expectToHaveAnyKeys',
          snippet: expectToHaveAnyKeys,
        },
        {
          id: 'expect-to-not-have-any-keys',
          name: 'expectToNotHaveAnyKeys',
          snippet: expectToNotHaveAnyKeys,
        },
        {
          id: 'expect-to-have-property',
          name: 'expectToHaveProperty',
          snippet: expectToHaveProperty,
        },
        {
          id: 'expect-to-be-an-object-that-has-all-keys',
          name: 'expectToBeAnObjectThatHasAllKeys',
          snippet: expectToBeAnObjectThatHasAllKeys,
        },
      ],
    },
  ],
};

const snippetsMenus: SnippetMenuItem[] = [
  variableSnippetsMenu,
  requestManipulationMenu,
  responseHandlingMenu,
  testMenu,
  miscMenu,
];

export const RequestScriptEditor: FC<Props> = ({
  className,
  defaultValue,
  onChange,
  uniquenessKey,
  onSnippetAdded,
}) => {
  const editorRef = useRef<CodeEditorHandle>(null);

  // Inserts at the line below the cursor and moves to the line beneath
  const addSnippet = (snippet: string) => {
    const cursorRow = editorRef.current?.getCursor()?.line || 0;
    const nextRow = cursorRow + 1;
    const value = editorRef.current?.getValue() || '';

    editorRef.current?.setValue(
      [...value.split('\n').slice(0, nextRow), snippet, '\n', ...value.split('\n').slice(nextRow)].join('\n'),
    );

    editorRef.current?.focus();
    editorRef.current?.setCursorLine(cursorRow + snippet.split('\n').length);
    onSnippetAdded?.(snippet);
  };

  const requestScriptSnippets = autocompleteSnippets as Snippet[];

  return (
    <div className="flex h-full flex-col divide-y divide-solid divide-(--hl-md)">
      <CodeEditor
        id={`script-editor-${uniquenessKey}`}
        key={uniquenessKey}
        showPrettifyButton={true}
        uniquenessKey={uniquenessKey}
        defaultValue={defaultValue}
        className={className}
        onChange={onChange}
        mode="text/javascript"
        placeholder="..."
        lintOptions={lintOptions}
        ref={editorRef}
        getAutocompleteSnippets={() => requestScriptSnippets}
        onPaste={translateHandlersInScript}
      />
      <Toolbar className="box-border flex h-(--line-height-sm) shrink-0 flex-row items-center overflow-x-auto text-(--font-size-sm)">
        {snippetsMenus.map(menu => (
          <MenuTrigger key={menu.id}>
            <Button className="flex h-full items-center justify-center gap-2 px-2 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)">
              <Icon icon="code" />
              {menu.name}
            </Button>
            <Popover className="flex min-w-max flex-col overflow-y-hidden">
              <Menu
                aria-label="Create a new request"
                selectionMode="single"
                className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
                items={menu.items}
              >
                {section => {
                  if ('items' in section) {
                    return (
                      <MenuSection>
                        <Header className="py-1 pl-2 text-xs text-(--hl) uppercase">{section.name}</Header>
                        <Collection items={section.items}>
                          {item => (
                            <MenuItem
                              onAction={() => addSnippet(item.snippet)}
                              className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                              key={item.name}
                            >
                              {item.name}
                            </MenuItem>
                          )}
                        </Collection>
                      </MenuSection>
                    );
                  }

                  return (
                    <MenuItem
                      onAction={() => addSnippet(section.snippet)}
                      className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                      key={section.name}
                    >
                      {section.name}
                    </MenuItem>
                  );
                }}
              </Menu>
            </Popover>
          </MenuTrigger>
        ))}
      </Toolbar>
    </div>
  );
};
