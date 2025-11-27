import React, { Fragment, type FunctionComponent } from 'react';
import {
  Button,
  Header,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  Popover,
  Select,
  SelectValue,
} from 'react-aria-components';

import type { GrpcMethodInfo, GrpcMethodType } from '../../../../main/ipc/grpc';
import { Icon } from '../../icon';

interface Props {
  disabled?: boolean;
  methods: GrpcMethodInfo[];
  selectedMethod?: GrpcMethodInfo;
  handleChange: (arg0: string) => void;
}
const PROTO_PATH_REGEX = /^\/(?:(?<package>[\w.]+)\.)?(?<service>\w+)\/(?<method>\w+)$/;

export const NO_PACKAGE_KEY = 'no-package';

const GrpcMethodTypeAcronym = {
  unary: 'U',
  server: 'SS',
  client: 'CS',
  bidi: 'BD',
} as const;

function groupBy(list: {}[], keyGetter: (item: any) => string): Record<string, any[]> {
  const map = new Map();
  list.forEach(item => {
    const key = keyGetter(item);
    const collection = map.get(key);
    if (!collection) {
      map.set(key, [item]);
    } else {
      collection.push(item);
    }
  });
  return Object.fromEntries(map);
}

export const groupGrpcMethodsByPackage = (methodInfoList: GrpcMethodInfo[]): Record<string, GrpcMethodInfo[]> => {
  return groupBy(methodInfoList, ({ fullPath }) => PROTO_PATH_REGEX.exec(fullPath)?.groups?.package || NO_PACKAGE_KEY);
};

// If all segments are found, return a shorter path, otherwise the original path
export const getShortGrpcPath = (fullPath: string): string => {
  const result = PROTO_PATH_REGEX.exec(fullPath);
  const packageName = result?.groups?.package;
  const serviceName = result?.groups?.service;
  const methodName = result?.groups?.method;
  return packageName && serviceName && methodName ? `/${serviceName}/${methodName}` : fullPath;
};

export const GrpcMethodDropdown: FunctionComponent<Props> = ({ disabled, methods, selectedMethod, handleChange }) => {
  const groupedByPkg = groupGrpcMethodsByPackage(methods);
  const sections = Object.entries(groupedByPkg).map(([name, pkg]) => ({
    id: name,
    name: name !== NO_PACKAGE_KEY ? `pkg: ${name}` : 'No package',
    display_name: name !== NO_PACKAGE_KEY ? `pkg: ${name}` : 'No package',
    items: pkg.map(({ type, fullPath, example }) => ({
      id: fullPath,
      fullPath,
      display_name: getShortGrpcPath(fullPath),
      type,
      example,
      isDisabled: disabled,
    })),
  }));
  const selectedPath = selectedMethod?.fullPath;

  return (
    <Select
      aria-label="Select gRPC method"
      name="method"
      onSelectionChange={key => {
        key && handleChange(key.toString());
      }}
      className="h-full"
      selectedKey={selectedPath}
      isDisabled={methods.length === 0}
    >
      <Button className="flex h-full items-center justify-center gap-2 rounded-xs px-4 py-1 text-sm font-semibold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset disabled:cursor-not-allowed disabled:bg-(--hl-xs) aria-pressed:bg-(--hl-sm) data-pressed:bg-(--hl-xs)">
        <SelectValue<{
          id: string;
          fullPath: string;
          display_name: string;
          type: GrpcMethodType;
          example: Record<string, any> | undefined;
        }> className="flex items-center justify-center gap-2 truncate">
          {({ selectedItem }) => {
            if (!selectedItem) {
              return (
                <Fragment>
                  <span>{selectedPath ? getShortGrpcPath(selectedPath) : 'Select Method'}</span>
                </Fragment>
              );
            }

            return <Fragment>{selectedItem.display_name}</Fragment>;
          }}
        </SelectValue>
        <Icon icon="caret-down" />
      </Button>
      <Popover className="flex max-w-xs min-w-max flex-col overflow-y-hidden">
        <ListBox
          items={sections}
          className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
        >
          {section => (
            <ListBoxSection key={section.id}>
              <Header className="flex items-center gap-2 px-(--padding-md) text-(--hl-md)">
                <span>{section.display_name}</span>
                <span className="h-px flex-1 bg-(--hl-md)" />
              </Header>
              {section.items.map(grpcMethod => (
                <ListBoxItem
                  id={grpcMethod.id}
                  key={grpcMethod.id}
                  className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                  aria-label={grpcMethod.display_name}
                  textValue={grpcMethod.display_name}
                  value={grpcMethod}
                >
                  {({ isSelected }) => (
                    <Fragment>
                      <em>{GrpcMethodTypeAcronym[grpcMethod.type]}</em>
                      {grpcMethod.display_name}
                      {isSelected && <Icon icon="check" className="justify-self-end text-(--color-success)" />}
                    </Fragment>
                  )}
                </ListBoxItem>
              ))}
            </ListBoxSection>
          )}
        </ListBox>
      </Popover>
    </Select>
  );
};
