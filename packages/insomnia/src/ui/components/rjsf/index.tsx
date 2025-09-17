import type Form from '@rjsf/core';
import { type FormProps, type IChangeEvent, withTheme } from '@rjsf/core';
import { getDefaultFormState } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useLatest } from 'react-use';

import theme from './theme';

const ThemedForm = withTheme(theme);

export interface InsomniaRjsfFormProps extends Omit<FormProps, 'onChange' | 'validator'> {
  onChange?: (formData: any) => void;
  renderSubmitButton?: boolean;
}

export interface InsomniaRjsfFormHandle {
  validate: () => void;
}

export const InsomniaRjsfForm = forwardRef<InsomniaRjsfFormHandle, InsomniaRjsfFormProps>(
  ({ onChange, schema, uiSchema = {}, renderSubmitButton, ...rest }, ref) => {
    const onChangeRef = useLatest(onChange);
    const formRef = useRef<Form>(null);
    useEffect(() => {
      if (schema) {
        const formDataWithDefaults = getDefaultFormState(validator, schema, {}, schema, true);
        onChangeRef?.current?.(formDataWithDefaults);
      }
    }, [onChangeRef, schema]);

    const mergedUiSchema = {
      'ui:submitButtonOptions': {
        norender: !renderSubmitButton,
      },
      ...uiSchema,
    };

    const handleRjsfChange = (e: IChangeEvent) => {
      onChange?.(e.formData);
    };

    useImperativeHandle(ref, () => ({
      validate: () => {
        formRef.current?.validateForm();
      },
    }));

    return (
      <ThemedForm
        ref={formRef}
        onChange={handleRjsfChange}
        schema={schema}
        validator={validator}
        uiSchema={mergedUiSchema}
        {...rest}
      />
    );
  },
);
