import type { ThemeProps } from '@rjsf/core';
import type {
  ArrayFieldDescriptionProps,
  ArrayFieldTemplateProps,
  BaseInputTemplateProps,
  FieldTemplateProps,
  ObjectFieldTemplateProps,
  RegistryWidgetsType,
  TitleFieldProps,
  WidgetProps,
} from '@rjsf/utils';

// Base input classes for consistency
const baseInputClasses =
  'w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:italic focus:outline-none focus:ring-1 focus:ring-[--hl-md]';
const labelClasses = 'text-sm font-medium text-[--color-font] mb-1 block';
const errorClasses = 'text-red-500 text-xs mt-1';
const descriptionClasses = 'text-[--hl] text-xs mb-2';

// ===== WIDGETS =====

// Text input widget
const CustomTextWidget = (props: WidgetProps) => {
  const { id, value, onChange, onBlur, onFocus, placeholder, disabled, readonly, required } = props;

  return (
    <input
      id={id}
      type="text"
      className={baseInputClasses}
      value={value || ''}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readonly}
      required={required}
      onChange={e => onChange(e.target.value)}
      onBlur={e => onBlur && onBlur(id, e.target.value)}
      onFocus={e => onFocus && onFocus(id, e.target.value)}
    />
  );
};

// Textarea widget
const CustomTextareaWidget = (props: WidgetProps) => {
  const { id, value, onChange, onBlur, onFocus, placeholder, disabled, readonly, required } = props;

  return (
    <textarea
      id={id}
      className={`${baseInputClasses} min-h-[80px] resize-y`}
      value={value || ''}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readonly}
      required={required}
      onChange={e => onChange(e.target.value)}
      onBlur={e => onBlur && onBlur(id, e.target.value)}
      onFocus={e => onFocus && onFocus(id, e.target.value)}
    />
  );
};

// Number input widget
const CustomNumberWidget = (props: WidgetProps) => {
  const { id, value, onChange, onBlur, onFocus, placeholder, disabled, readonly, required, schema } = props;

  return (
    <input
      id={id}
      type="number"
      className={baseInputClasses}
      value={value || ''}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readonly}
      required={required}
      min={schema.minimum}
      max={schema.maximum}
      step={schema.multipleOf || (schema.type === 'integer' ? 1 : 'any')}
      onChange={e => {
        const val = e.target.value;
        onChange(val === '' ? undefined : schema.type === 'integer' ? parseInt(val) : parseFloat(val));
      }}
      onBlur={e => onBlur && onBlur(id, e.target.value)}
      onFocus={e => onFocus && onFocus(id, e.target.value)}
    />
  );
};

// Checkbox widget for boolean values
const CustomCheckboxWidget = (props: WidgetProps) => {
  const { id, value, onChange, onBlur, onFocus, disabled, readonly, required, label } = props;

  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        id={id}
        type="checkbox"
        className="rounded border-[--hl-sm] bg-[--color-bg] text-[--color-surprise] focus:ring-[--hl-md]"
        checked={value || false}
        disabled={disabled}
        readOnly={readonly}
        required={required}
        onChange={e => onChange(e.target.checked)}
        onBlur={() => onBlur && onBlur(id, value)}
        onFocus={() => onFocus && onFocus(id, value)}
      />
      <span className="text-sm text-[--color-font]">{label}</span>
    </label>
  );
};

// Select widget for enums
const CustomSelectWidget = (props: WidgetProps) => {
  const { id, value, onChange, onBlur, onFocus, disabled, required, options } = props;
  const { enumOptions } = options;

  return (
    <select
      id={id}
      className={baseInputClasses}
      value={value || ''}
      disabled={disabled}
      required={required}
      onChange={e => onChange(e.target.value)}
      onBlur={e => onBlur && onBlur(id, e.target.value)}
      onFocus={e => onFocus && onFocus(id, e.target.value)}
    >
      <option value="">请选择...</option>
      {enumOptions?.map(option => (
        <option key={`${option.value}`} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

// Radio widget for small enums
const CustomRadioWidget = (props: WidgetProps) => {
  const { id, value, onChange, onBlur, onFocus, disabled, readonly, required, options } = props;
  const { enumOptions } = options;

  return (
    <div className="flex flex-col gap-2">
      {enumOptions?.map(option => (
        <label key={`${option.value}`} className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name={id}
            value={option.value}
            checked={value === option.value}
            disabled={disabled}
            readOnly={readonly}
            required={required}
            onChange={() => onChange(option.value)}
            onBlur={() => onBlur && onBlur(id, option.value)}
            onFocus={() => onFocus && onFocus(id, option.value)}
            className="text-[--color-surprise] focus:ring-[--hl-md]"
          />
          <span className="text-sm text-[--color-font]">{option.label}</span>
        </label>
      ))}
    </div>
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
    type,
    rawErrors,
  } = props;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val === '' ? options.emptyValue || '' : val);
  };

  const hasError = rawErrors && rawErrors.length > 0;

  return (
    <input
      id={id}
      type={type || 'text'}
      className={`${baseInputClasses} ${hasError ? 'border-red-500' : ''}`}
      value={value || ''}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readonly}
      required={required}
      autoFocus={autofocus}
      onChange={onChangeOverride || handleChange}
      onBlur={e => onBlur && onBlur(id, e.target.value)}
      onFocus={e => onFocus && onFocus(id, e.target.value)}
    />
  );
};

// Field Template - controls the layout of each field
const FieldTemplate = (props: FieldTemplateProps) => {
  const { id, classNames, style, label, help, required, description, errors, children, displayLabel, hidden } = props;

  if (hidden) {
    return <div style={{ display: 'none' }}>{children}</div>;
  }

  return (
    <div className={`mb-4 ${classNames || ''}`} style={style}>
      {displayLabel && label && (
        <label htmlFor={id} className={labelClasses}>
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}
      {description && <div className={descriptionClasses}>{description}</div>}
      {children}
      {errors && <div className={errorClasses}>{errors}</div>}
      {help && <div className="mt-1 text-xs text-[--hl]">{help}</div>}
    </div>
  );
};

// Title Field Template
const TitleFieldTemplate = (props: TitleFieldProps) => {
  const { id, title, required } = props;

  if (!title) return null;

  return (
    <h3 id={id} className="mb-2 text-lg font-semibold text-[--color-font]">
      {title}
      {required && <span className="ml-1 text-red-500">*</span>}
    </h3>
  );
};

// Description Field Template
const DescriptionFieldTemplate = (props: ArrayFieldDescriptionProps) => {
  const { description } = props;

  if (!description) return null;

  return <div className={descriptionClasses}>{description}</div>;
};

// Object Field Template
const ObjectFieldTemplate = (props: ObjectFieldTemplateProps) => {
  const { title, description, properties } = props;

  return (
    <div className="rounded-md border border-[--hl-sm] bg-[--color-bg] p-4">
      {title && <h4 className="text-md mb-2 font-medium text-[--color-font]">{title}</h4>}
      {description && <div className={descriptionClasses}>{description}</div>}
      <div className="space-y-4">
        {properties.map(prop => (
          <div key={prop.name} className={prop.hidden ? 'hidden' : ''}>
            {prop.content}
          </div>
        ))}
      </div>
    </div>
  );
};

// Array Field Template
const ArrayFieldTemplate = (props: ArrayFieldTemplateProps) => {
  const { title, items, canAdd, onAddClick, disabled, readonly } = props;

  return (
    <div className="rounded-md border border-[--hl-sm] bg-[--color-bg] p-4">
      {title && <h4 className="text-md mb-2 font-medium text-[--color-font]">{title}</h4>}

      <div className="space-y-2">
        {items.map(item => (
          <div key={item.key} className="flex items-start gap-2 rounded border border-[--hl-xs] p-2">
            <div className="flex-1">{item.children}</div>
            <div className="flex gap-1">
              {/* Simplified array controls - just remove button */}
              <button
                type="button"
                className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
                onClick={() => {
                  // Simple remove - we'll need to access the proper callback from registry
                  console.log('Remove item at index:', item.index);
                }}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {canAdd && (
        <button
          type="button"
          className="mt-2 rounded bg-[--color-surprise] px-3 py-1 text-sm text-white hover:bg-[--color-surprise-dark]"
          onClick={onAddClick}
          disabled={disabled || readonly}
        >
          + 添加项目
        </button>
      )}
    </div>
  );
};

// ===== REGISTRY =====

const themeWidgets: RegistryWidgetsType = {
  TextWidget: CustomTextWidget,
  TextareaWidget: CustomTextareaWidget,
  NumberWidget: CustomNumberWidget,
  CheckboxWidget: CustomCheckboxWidget,
  SelectWidget: CustomSelectWidget,
  RadioWidget: CustomRadioWidget,
  // Add aliases for other types
  EmailWidget: CustomTextWidget,
  URLWidget: CustomTextWidget,
  PasswordWidget: (props: WidgetProps) => <CustomTextWidget {...props} type="password" />,
  DateWidget: (props: WidgetProps) => <CustomTextWidget {...props} type="date" />,
  DateTimeWidget: (props: WidgetProps) => <CustomTextWidget {...props} type="datetime-local" />,
  TimeWidget: (props: WidgetProps) => <CustomTextWidget {...props} type="time" />,
  ColorWidget: (props: WidgetProps) => <CustomTextWidget {...props} type="color" />,
  RangeWidget: (props: WidgetProps) => <CustomTextWidget {...props} type="range" />,
};

const themeTemplates = {
  BaseInputTemplate,
  FieldTemplate,
  TitleFieldTemplate,
  DescriptionFieldTemplate,
  ObjectFieldTemplate,
  ArrayFieldTemplate,
};

const ThemeObject: ThemeProps = {
  widgets: themeWidgets,
  templates: themeTemplates,
};

export default ThemeObject;
