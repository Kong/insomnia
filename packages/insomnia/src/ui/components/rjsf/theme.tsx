import type { ThemeProps } from '@rjsf/core';
import {
  ADDITIONAL_PROPERTY_FLAG,
  type ArrayFieldTemplateProps,
  type BaseInputTemplateProps,
  type FieldTemplateProps,
  getInputProps,
  type MultiSchemaFieldTemplateProps,
  type ObjectFieldTemplateProps,
  type RegistryWidgetsType,
  type WidgetProps,
  type WrapIfAdditionalTemplateProps,
} from '@rjsf/utils';
import cn from 'classnames';
import { Input, Label, TextField } from 'react-aria-components';

import { Checkbox, CheckboxGroup } from '~/ui/components/base/checkbox';
import { Select } from '~/ui/components/base/select';
import { Icon } from '~/ui/components/icon';
import { Button } from '~/ui/components/themed-button';

// Base input classes for consistency
const baseInputClasses =
  'w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 px-2 text-[--color-font] transition-colors placeholder:italic focus:outline-none focus:ring-1 focus:ring-[--hl-md]';
const labelClasses = 'text-sm font-medium text-[--color-font] mb-1 block';
const errorClasses = 'text-red-500 text-xs mt-1';
const descriptionClasses = 'text-[--hl] text-xs mb-2';

// ===== WIDGETS =====

// Checkbox widget for boolean values
const CustomCheckboxWidget = (props: WidgetProps) => {
  const { id, value, onChange, disabled, readonly, required, label, schema } = props;

  return (
    <Checkbox
      aria-label="rjsf-checkbox"
      id={id}
      isSelected={value || false}
      onChange={onChange}
      isDisabled={disabled}
      isReadOnly={readonly}
      isRequired={required}
    >
      <span className="text-sm text-[--color-font]">{schema?.description || label}</span>
    </Checkbox>
  );
};

// Select widget for enums
const CustomSelectWidget = (props: WidgetProps) => {
  const { id, value, onChange, disabled, required, readonly, options, multiple } = props;
  const { enumOptions } = options;

  if (multiple) {
    return (
      <CheckboxGroup
        isDisabled={disabled}
        isRequired={required}
        isReadOnly={readonly}
        options={enumOptions || []}
        value={value || []}
        onChange={onChange}
        className="flex flex-col gap-1"
      />
    );
  }

  return (
    <Select
      aria-label="rjsf-select"
      id={id}
      isDisabled={disabled}
      isRequired={required}
      options={enumOptions || []}
      value={value}
      onChange={onChange}
      className="w-full"
    />
  );
};

// ===== TEMPLATES =====

// Base Input Template - used by most input widgets
const BaseInputTemplate = (props: BaseInputTemplateProps) => {
  const {
    id,
    value,
    onChange,
    onChangeOverride,
    onBlur,
    onFocus,
    options,
    required,
    disabled,
    readonly,
    autofocus,
    placeholder,
    rawErrors,
    schema,
    type,
  } = props;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChangeOverride) {
      onChangeOverride(e);
    } else {
      const val = e.target.value;
      onChange(val === '' ? options.emptyValue || '' : val);
    }
  };

  const hasError = rawErrors && rawErrors.length > 0;
  const inputProps = getInputProps(schema, type, options);

  return (
    <TextField
      aria-label="rjsf-input"
      value={value}
      isDisabled={disabled}
      isReadOnly={readonly}
      isRequired={required}
      autoFocus={autofocus}
      onBlur={e => onBlur && onBlur(id, e.target.value)}
      onFocus={e => onFocus && onFocus(id, e.target.value)}
    >
      <Input
        className={cn(`${baseInputClasses}`, {
          'border-red-500': hasError,
          'border-[--hl-xs]': disabled,
        })}
        id={id}
        placeholder={placeholder}
        onChange={handleChange}
        {...inputProps}
      />
    </TextField>
  );
};

const WrapIfAdditionalTemplate = (props: WrapIfAdditionalTemplateProps) => {
  const { id, label, onKeyChange, onDropPropertyClick, schema, children, classNames, style } = props;
  const additional = ADDITIONAL_PROPERTY_FLAG in schema;

  if (!additional) {
    return (
      <div className={classNames} style={style}>
        {children}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', classNames)} style={style}>
      <TextField
        className="flex-grow"
        aria-label="rjsf-input"
        onBlur={e => onKeyChange(e.currentTarget.value)}
        defaultValue={label}
      >
        <Label className={labelClasses}>{label}</Label>
        <Input className={cn(`${baseInputClasses}`, {})} id={id} />
      </TextField>
      <div className="flex-grow">{children}</div>
      <div className="flex-shrink-0 basis-[50px] self-end">
        <Button
          size="small"
          bg="default"
          variant="contained"
          className="border-none"
          onClick={onDropPropertyClick(label)}
        >
          <Icon icon="trash" />
        </Button>
      </div>
    </div>
  );
};

const MultiSchemaFieldTemplate = (props: MultiSchemaFieldTemplateProps) => {
  const { optionSchemaField, selector } = props;

  return (
    <div>
      <div>{selector}</div>
      {optionSchemaField}
    </div>
  );
};

// Field Template - controls the layout of each field
const FieldTemplate = (props: FieldTemplateProps) => {
  const {
    id,
    classNames,
    style,
    label,
    help,
    required,
    description,
    rawDescription,
    errors,
    children,
    displayLabel,
    hidden,
    schema,
    registry,
    rawErrors,
    rawHelp,
  } = props;

  if (hidden) {
    return <div style={{ display: 'none' }}>{children}</div>;
  }

  const displayDescription = schema?.type !== 'boolean' && description && rawDescription;
  // always show label for boolean fields
  const comDisplayLabel = schema?.type === 'boolean' || displayLabel;

  const WrapIfAdditionalTemplate = registry.templates.WrapIfAdditionalTemplate;

  return (
    <div className={cn('mb-2', classNames)} style={{ ...style }}>
      <WrapIfAdditionalTemplate {...props}>
        {comDisplayLabel && label && (
          <>
            <label htmlFor={id} className={labelClasses}>
              {label}
              {required && <span className="ml-1 text-red-500">*</span>}
              <span className="text-[--hl]">: {schema.type}</span>
            </label>
            {displayDescription && <div className={descriptionClasses}>{description}</div>}
          </>
        )}
        {children}
        {rawErrors && <div className={errorClasses}>{errors}</div>}
        {rawHelp && <div className="mt-1 text-xs text-[--hl]">{help}</div>}
      </WrapIfAdditionalTemplate>
    </div>
  );
};

const ObjectFieldTemplate = (props: ObjectFieldTemplateProps) => {
  const { title, description, properties, required, schema, idSchema, onAddClick } = props;

  const level = idSchema.$id.split('_').length;

  const canExpand = schema.additionalItems || schema.additionalProperties;

  return (
    <div>
      {title && (
        <label className={labelClasses}>
          <span className="mb-2 font-medium text-[--color-font]">{title}</span>
          {required && <span className="ml-1 text-red-500">*</span>}
          <span className="text-[--hl]">: {schema.type}</span>
        </label>
      )}
      {description && <div className={descriptionClasses}>{description}</div>}
      <div
        className={cn('space-y-4', {
          'border-l border-solid border-[--hl-sm]': level > 1,
          'pl-4': level > 1,
        })}
      >
        {properties.map(prop => (
          <div key={prop.name} className={prop.hidden ? 'hidden' : ''}>
            {prop.content}
          </div>
        ))}
      </div>
      {canExpand && (
        <div className="px-4">
          <Button bg="surprise" variant="contained" onClick={onAddClick(schema)}>
            + Add Item
          </Button>
        </div>
      )}
    </div>
  );
};

const ArrayFieldTemplate = (props: ArrayFieldTemplateProps) => {
  const { title, items, canAdd, onAddClick, disabled, readonly, required, schema } = props;

  return (
    <div className="rounded-md bg-[--color-bg]">
      {title && (
        <label className={labelClasses}>
          <span className="mb-2 font-medium text-[--color-font]">{title}</span>
          {required && <span className="ml-1 text-red-500">*</span>}
          <span className="text-[--hl]">: {schema.type}</span>
        </label>
      )}
      {schema.description && <div className={descriptionClasses}>{schema.description}</div>}

      <div className="space-y-2 rounded border border-solid border-[--hl-sm] py-2">
        {items.map(item => (
          <div
            key={item.key}
            className={cn('flex items-start gap-4 rounded px-4', {
              'border-b border-solid border-[--hl-sm]': item.index < items.length - 1,
            })}
          >
            <div className="flex-1">{item.children}</div>
            <div className="flex gap-1">
              <Button
                size="small"
                bg="default"
                variant="contained"
                className="border-none"
                disabled={disabled || readonly}
                onClick={item.buttonsProps.onDropIndexClick(item.index)}
              >
                <Icon icon="trash" />
              </Button>
            </div>
          </div>
        ))}
        {canAdd && (
          <div className="px-4">
            <Button bg="surprise" variant="contained" onClick={onAddClick}>
              + Add Item
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

// ===== REGISTRY =====

const themeWidgets: RegistryWidgetsType = {
  CheckboxWidget: CustomCheckboxWidget,
  SelectWidget: CustomSelectWidget,
};

const themeTemplates = {
  BaseInputTemplate,
  FieldTemplate,
  ObjectFieldTemplate,
  ArrayFieldTemplate,
  WrapIfAdditionalTemplate,
  MultiSchemaFieldTemplate,
};

const ThemeObject: ThemeProps = {
  widgets: themeWidgets,
  templates: themeTemplates,
};

export default ThemeObject;
