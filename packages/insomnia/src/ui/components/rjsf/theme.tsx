import type { ThemeProps } from '@rjsf/core';
import {
  type ArrayFieldTemplateProps,
  type BaseInputTemplateProps,
  type FieldTemplateProps,
  getInputProps,
  type ObjectFieldTemplateProps,
  type RegistryWidgetsType,
  type WidgetProps,
} from '@rjsf/utils';
import cn from 'classnames';
import { Input, TextField } from 'react-aria-components';

import { Checkbox } from '~/ui/components/base/checkbox';
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
  const { id, value, onChange, disabled, required, options } = props;
  const { enumOptions } = options;

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
    ...rest
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
  const inputProps = { ...rest, ...getInputProps(schema, type, options) };

  return (
    <TextField
      aria-label="rjsf-input"
      className={cn(`${baseInputClasses}`, {
        'border-red-500': hasError,
        'border-[--hl-xs]': disabled,
      })}
      value={value}
      isDisabled={disabled}
      isReadOnly={readonly}
      isRequired={required}
      autoFocus={autofocus}
      onBlur={e => onBlur && onBlur(id, e.target.value)}
      onFocus={e => onFocus && onFocus(id, e.target.value)}
    >
      <Input className="w-full" id={id} placeholder={placeholder} onChange={handleChange} {...inputProps} />
    </TextField>
  );
};

// Field Template - controls the layout of each field
const FieldTemplate = (props: FieldTemplateProps) => {
  const { id, classNames, style, label, help, required, description, errors, children, displayLabel, hidden, schema } =
    props;

  if (hidden) {
    return <div style={{ display: 'none' }}>{children}</div>;
  }

  const displayDescription = schema?.type !== 'boolean' && description;
  // always show label for boolean fields
  const comDisplayLabel = schema?.type === 'boolean' || displayLabel;

  return (
    <div className={cn('mb-4', classNames)} style={{ ...style }}>
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
      {errors && <div className={errorClasses}>{errors}</div>}
      {help && <div className="mt-1 text-xs text-[--hl]">{help}</div>}
    </div>
  );
};

const ObjectFieldTemplate = (props: ObjectFieldTemplateProps) => {
  const { title, description, properties, required, schema, idSchema } = props;

  const level = idSchema.$id.split('_').length;

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
};

const ThemeObject: ThemeProps = {
  widgets: themeWidgets,
  templates: themeTemplates,
};

export default ThemeObject;
