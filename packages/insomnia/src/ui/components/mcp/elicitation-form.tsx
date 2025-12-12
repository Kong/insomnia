import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { useRef, useState } from 'react';
import { Button, Toolbar } from 'react-aria-components';

import { InsomniaRjsfForm, type InsomniaRjsfFormHandle } from '~/ui/components/rjsf';

interface ElicitationFormProps {
  requestId: string;
  serverRequestId: string;
  schema: RJSFSchema;
}

const uiSchema: UiSchema = {
  'ui:submitButtonOptions': {
    norender: true,
  },
};

export const ElicitationForm = ({ requestId, serverRequestId, schema }: ElicitationFormProps) => {
  const rjsfFormRef = useRef<InsomniaRjsfFormHandle>(null);
  const [formData, setFormData] = useState({});

  const handleRjsfFormChange = (formData: any) => {
    setFormData(formData);
  };

  return (
    <div className="flex grow flex-col overflow-hidden">
      <div className="h-[calc(100%-var(--line-height-sm))] overflow-auto bg-inherit px-5 py-1">
        <InsomniaRjsfForm
          formData={formData}
          onChange={handleRjsfFormChange}
          schema={schema}
          uiSchema={uiSchema}
          ref={rjsfFormRef}
          showErrorList={false}
          focusOnFirstError
        />
      </div>
      <Toolbar className="content-box sticky bottom-0 z-10 flex h-(--line-height-sm) shrink-0 gap-3 border-b border-(--hl-md) bg-(--color-bg) px-5 py-2 text-(--font-size-sm)">
        <Button
          onPress={() => {
            if (rjsfFormRef.current?.validate()) {
              window.main.mcp.client.responseElicitationRequest({
                requestId,
                serverRequestId,
                type: 'submit',
                content: formData,
              });
            }
          }}
          className="rounded-sm bg-(--color-surprise) px-(--padding-md) text-center text-(--color-font-surprise) hover:brightness-75"
        >
          Submit
        </Button>
        <Button
          onPress={() =>
            window.main.mcp.client.responseElicitationRequest({
              requestId,
              serverRequestId,
              type: 'decline',
            })
          }
          className="rounded-md border border-solid border-(--hl-lg) bg-(--color-bg) px-(--padding-md) text-center"
        >
          Decline
        </Button>
        <Button
          onPress={() =>
            window.main.mcp.client.responseElicitationRequest({
              requestId,
              serverRequestId,
              type: 'cancel',
            })
          }
          className="rounded-md border border-solid border-(--hl-lg) bg-(--color-bg) px-(--padding-md) text-center"
        >
          Cancel
        </Button>
      </Toolbar>
    </div>
  );
};
