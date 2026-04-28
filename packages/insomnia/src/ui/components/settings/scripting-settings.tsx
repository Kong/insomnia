import { Switch } from 'react-aria-components';

import { useRootLoaderData } from '~/root';

import { type ASTRule, blockedPropertyRules, blockedRootRules, maskRules, type ThreatRule } from '../../../scripting/script-security-policy';
import { useSettingsPatcher } from '../../hooks/use-request';

const DISABLED_TOOLTIP = 'Enable the script sandbox to configure individual rules';

const RuleToggle = ({
  name,
  description,
  isEnabled,
  isDisabled,
  onChange,
}: {
  name?: string;
  description: string;
  isEnabled: boolean;
  isDisabled: boolean;
  onChange: (enabled: boolean) => void;
}) => (
  <div className="flex items-center justify-between">
    <div className="flex flex-col gap-1">
      {name && <span className="font-mono text-sm font-medium text-(--color-font)">{name}</span>}
      <p className="text-xs text-(--hl)">{description}</p>
    </div>
    <span className="group/tooltip relative inline-flex h-6 w-11 shrink-0">
      <Switch
        isSelected={isEnabled}
        onChange={onChange}
        isDisabled={isDisabled}
        className="group/switch flex items-center gap-2"
      >
        <div className="flex h-6 w-11 cursor-pointer items-center rounded-full border-2 border-solid border-transparent bg-(--hl-md) transition-colors group-data-disabled/switch:cursor-not-allowed group-data-disabled/switch:opacity-50 group-data-selected/switch:bg-(--color-surprise)">
          <span className="h-5 w-5 translate-x-0 rounded-full bg-white transition-transform group-data-selected/switch:translate-x-5" />
        </div>
      </Switch>
      {isDisabled && (
        <div className="pointer-events-none absolute top-full right-0 z-50 mt-1 hidden max-w-[300px] min-w-[180px] rounded border border-(--hl-sm) bg-(--color-bg) px-2 py-1 text-center text-sm wrap-break-word whitespace-normal text-(--color-font) group-hover/tooltip:block">
          {DISABLED_TOOLTIP}
        </div>
      )}
    </span>
  </div>
);

interface RuleGroup {
  title: string;
  description: string;
  rules: (ThreatRule | ASTRule)[];
}

const RuleCard = ({
  title,
  description,
  rules,
  standaloneRules,
  groups,
  disabledNames,
  sandboxEnabled,
  onToggle,
}: {
  title: string;
  description: string;
  rules?: (ThreatRule | ASTRule)[];
  standaloneRules?: (ThreatRule | ASTRule)[];
  groups?: RuleGroup[];
  disabledNames: string[];
  sandboxEnabled: boolean;
  onToggle: (names: string[], enabled: boolean) => void;
}) => (
  <div className="rounded-md border border-solid border-(--hl-sm) bg-(--hl-xs) p-4">
    <div className="mb-4">
      <h3 className="text-lg font-semibold text-(--color-font)">{title}</h3>
      <p className="text-sm text-(--hl)">{description}</p>
    </div>
    <div className="flex flex-col gap-4">
      {rules?.map(rule => (
        <RuleToggle
          key={rule.name}
          name={rule.name}
          description={rule.description}
          isEnabled={!disabledNames.includes(rule.name)}
          isDisabled={!sandboxEnabled}
          onChange={enabled => onToggle([rule.name], enabled)}
        />
      ))}
      {standaloneRules && standaloneRules.length > 0 && (
        <div className="ml-2 flex flex-col gap-4 border-l-2 border-solid border-(--hl-sm) pl-3">
          {standaloneRules.map(rule => (
            <RuleToggle
              key={rule.name}
              name={rule.name}
              description={rule.description}
              isEnabled={!disabledNames.includes(rule.name)}
              isDisabled={!sandboxEnabled}
              onChange={enabled => onToggle([rule.name], enabled)}
            />
          ))}
        </div>
      )}
      {groups?.map(group => {
        const groupNames = group.rules.map(r => r.name);
        const allEnabled = groupNames.every(n => !disabledNames.includes(n));
        return (
          <div key={group.title} className="flex flex-col gap-3">
            <h4 className="border-b border-solid border-(--hl-sm) pb-1 text-xs font-semibold uppercase tracking-wide text-(--color-font)">{group.title}</h4>
            <RuleToggle
              description={group.description}
              isEnabled={allEnabled}
              isDisabled={!sandboxEnabled}
              onChange={enabled => onToggle(groupNames, enabled)}
            />
            <div className="flex flex-wrap gap-1 pl-0.5">
              {group.rules.map(r => (
                <span key={r.name} className="rounded border border-solid border-(--hl-sm) bg-(--color-bg) px-1.5 py-0.5 font-mono text-xs text-(--hl)">
                  {r.name}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

export const ScriptingSettings = () => {
  const { settings } = useRootLoaderData()!;
  const patchSettings = useSettingsPatcher();

  const sandboxEnabled = settings.scriptSandboxEnabled !== false;
  const strictModeEnabled = settings.scriptStrictModeEnabled !== false;
  const disabledRules = settings.disabledSecurityRules ?? [];
  const disabledProperties = settings.disabledBlockedProperties ?? [];
  const disabledRoots = settings.disabledBlockedRoots ?? [];

  const GROUPED_MASK_NAMES = new Set([
    'globalThis', 'global', 'process',
    'setImmediate', 'queueMicrotask',
    'Proxy', 'Reflect',
    'Function', 'WebAssembly',
  ]);

  const maskRuleGroups: RuleGroup[] = [
    {
      title: 'Global & Node.js Internals',
      description: 'References to the global scope and Node.js process information such as environment variables and runtime state.',
      rules: maskRules.filter(r => ['globalThis', 'global', 'process'].includes(r.name)),
    },
    {
      title: 'Async Scheduling',
      description: 'Schedule callbacks to run asynchronously after the current operation completes.',
      rules: maskRules.filter(r => ['setImmediate', 'queueMicrotask'].includes(r.name)),
    },
    {
      title: 'Runtime APIs',
      description: 'Used for meta-programming (Proxy, Reflect), creating functions dynamically from strings (Function), and running compiled binary modules (WebAssembly).',
      rules: maskRules.filter(r => ['Proxy', 'Reflect', 'Function', 'WebAssembly'].includes(r.name)),
    },
  ];

  const ungroupedMaskRules = maskRules.filter(r => !GROUPED_MASK_NAMES.has(r.name));

  const STANDALONE_PROPERTY_NAMES = new Set(['mainModule', 'constructor']);

  const GROUPED_PROPERTY_NAMES = new Set([
    'prototype', '__proto__', 'getPrototypeOf', 'setPrototypeOf',
    'getFunction', 'getThis', 'prepareStackTrace', 'captureStackTrace',
    '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__',
    'defineProperty', 'defineProperties', 'getOwnPropertyDescriptor', 'getOwnPropertyDescriptors',
  ]);

  const blockedPropertyGroups: RuleGroup[] = [
    {
      title: 'Prototype Mutation',
      description: 'Used to access and modify an object\'s prototype chain.',
      rules: blockedPropertyRules.filter(r => ['prototype', '__proto__', 'getPrototypeOf', 'setPrototypeOf'].includes(r.name)),
    },
    {
      title: 'Stack Inspection',
      description: 'Used to inspect and format JavaScript call stack information.',
      rules: blockedPropertyRules.filter(r => ['prepareStackTrace', 'captureStackTrace', 'getFunction', 'getThis'].includes(r.name)),
    },
    {
      title: 'Accessor Helpers',
      description: 'Legacy methods for defining and looking up getter and setter functions on objects.',
      rules: blockedPropertyRules.filter(r => ['__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__', 'defineProperty', 'defineProperties', 'getOwnPropertyDescriptor', 'getOwnPropertyDescriptors'].includes(r.name)),
    },
  ];

  const standaloneBlockedPropertyRules = blockedPropertyRules.filter(r => STANDALONE_PROPERTY_NAMES.has(r.name));
  const ungroupedBlockedPropertyRules = blockedPropertyRules.filter(r => !GROUPED_PROPERTY_NAMES.has(r.name) && !STANDALONE_PROPERTY_NAMES.has(r.name));

  const GROUPED_ROOT_NAMES = new Set([
    'globalThis', 'global', 'window', 'self', 'frames',
    'process', 'module', 'exports', 'Buffer',
    'this', 'constructor', 'arguments',
  ]);

  const blockedRootGroups: RuleGroup[] = [
    {
      title: 'Global Object Aliases',
      description: 'Different ways to reference the global object depending on the JavaScript environment (browser, Node.js, Web Worker).',
      rules: blockedRootRules.filter(r => ['globalThis', 'global', 'window', 'self', 'frames'].includes(r.name)),
    },
    {
      title: 'Node.js Internals',
      description: 'Core Node.js globals for managing the current process, module system, and binary data.',
      rules: blockedRootRules.filter(r => ['process', 'module', 'exports', 'Buffer'].includes(r.name)),
    },
    {
      title: 'Scopes',
      description: 'Built-in references to the current execution context, function constructor, and call arguments.',
      rules: blockedRootRules.filter(r => ['this', 'constructor', 'arguments'].includes(r.name)),
    },
  ];

  const ungroupedBlockedRootRules = blockedRootRules.filter(r => !GROUPED_ROOT_NAMES.has(r.name));

  const makeToggler = (field: 'disabledSecurityRules' | 'disabledBlockedProperties' | 'disabledBlockedRoots', current: string[]) =>
    (names: string[], enabled: boolean) => {
      const nameSet = new Set(names);
      const next = enabled ? current.filter(n => !nameSet.has(n)) : [...new Set([...current, ...names])];
      patchSettings({ [field]: next });
    };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-solid border-(--hl-sm) bg-(--hl-xs) p-4">
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-semibold text-(--color-font)">Script Sandbox</h3>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-(--color-font)">Enable script sandbox</span>
              <p className="text-xs text-(--hl)">
                Pre/post-request scripts run inside a security sandbox that restricts access to dangerous APIs.
              </p>
            </div>
            <Switch
              isSelected={sandboxEnabled}
              onChange={enabled => patchSettings({ scriptSandboxEnabled: enabled })}
              className="group flex items-center gap-2"
            >
              <div className="flex h-6 w-11 cursor-pointer items-center rounded-full border-2 border-solid border-transparent bg-(--hl-md) transition-colors group-data-selected:bg-(--color-surprise)">
                <span className="h-5 w-5 translate-x-0 rounded-full bg-white transition-transform group-data-selected:translate-x-5" />
              </div>
            </Switch>
          </div>
          <div className="ml-2 border-l-2 border-solid border-(--hl-sm) pl-3">
            <RuleToggle
              name="use strict"
              description="Wraps scripts with 'use strict' preventing the accidental creation of global variables and blocking restricted features."
              isEnabled={strictModeEnabled}
              isDisabled={!sandboxEnabled}
              onChange={enabled => patchSettings({ scriptStrictModeEnabled: enabled })}
            />
          </div>
        </div>
      </div>

      <RuleCard
        title="Mask Rules"
        description="Overwrites specific global variables with undefined so scripts cannot access them."
        rules={ungroupedMaskRules}
        groups={maskRuleGroups}
        disabledNames={disabledRules}
        sandboxEnabled={sandboxEnabled}
        onToggle={makeToggler('disabledSecurityRules', disabledRules)}
      />

      <RuleCard
        title="Blocked Properties"
        description="Prevents specific properties from being accessed on any object."
        rules={ungroupedBlockedPropertyRules}
        standaloneRules={standaloneBlockedPropertyRules}
        groups={blockedPropertyGroups}
        disabledNames={disabledProperties}
        sandboxEnabled={sandboxEnabled}
        onToggle={makeToggler('disabledBlockedProperties', disabledProperties)}
      />

      <RuleCard
        title="Blocked Roots"
        description="Prevents specific global identifiers from being referenced."
        rules={ungroupedBlockedRootRules}
        groups={blockedRootGroups}
        disabledNames={disabledRoots}
        sandboxEnabled={sandboxEnabled}
        onToggle={makeToggler('disabledBlockedRoots', disabledRoots)}
      />
    </div>
  );
};
