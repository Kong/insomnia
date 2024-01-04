import React, { useEffect, useState } from 'react';
import { useRouteLoaderData } from 'react-router-dom';
import styled from 'styled-components';

import {
  create,
  findByParentId,
  remove,
  RequestSetter,
  SetterEventType,
  update,
} from '../../../../models/request-setter';
import { STATIC_CONTEXT_SOURCE_NAME } from '../../../../templating';
import { useNunjucks } from '../../../context/nunjucks/use-nunjucks';
import { RequestLoaderData } from '../../../routes/request';
import { Button } from '../../themed-button';
import SetterEventRowEditor from './setter-event-row-editor';

interface RenderKey {
  name: string;
  value: any;
  meta?: {
    name: string;
    type: string;
    id: string;
  };
}

const StyledHeaderContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: stretch;
  margin-bottom: var(--padding-sm);
  > h4 {
    width: 100%;
    padding-top: var(--padding-sm);
  }
  > .btn {
    width: auto;
  }
`;
export const RequestEventSetterEditor = () => {
  const { handleGetRenderContext } = useNunjucks();
  const [setters, setSetters] = useState({
    [SetterEventType.AFTER_RECEIVED_RESPONSE]: [],
    [SetterEventType.BEFORE_SEND_REQUEST]: [],
    [SetterEventType.DURING_SEND_REQUEST]: [],
  });
  const [variables, setVariables] = useState([]);

  const { activeRequest } = useRouteLoaderData(
    'request/:requestId'
  ) as RequestLoaderData;

  const loadData = async () => {
    const settersData = (await findByParentId(activeRequest._id)) || [];
    const context = await handleGetRenderContext();
    const variablesData: RenderKey[] = context.keys.sort((a, b) => {
      if (a.meta?.type < b.meta?.type) {
        return -1;
      } else if (a.meta?.type > b.meta?.type) {
        return 1;
      } else {
        if (a.meta?.name < b.meta?.name) {
          return -1;
        } else if (a.meta?.name > b.meta?.name) {
          return 1;
        } else {
          return a.name < b.name ? -1 : 1;
        }
      }
    });

    setSetters({
      ...setters,
      [SetterEventType.AFTER_RECEIVED_RESPONSE]: settersData.filter(
        (s) => s.event === SetterEventType.AFTER_RECEIVED_RESPONSE
      ),
      [SetterEventType.BEFORE_SEND_REQUEST]: settersData.filter(
        (s) => s.event === SetterEventType.BEFORE_SEND_REQUEST
      ),
      [SetterEventType.DURING_SEND_REQUEST]: settersData.filter(
        (s) => s.event === SetterEventType.DURING_SEND_REQUEST
      ),
    });

    setVariables(
      variablesData.filter((v) => v.meta?.type !== STATIC_CONTEXT_SOURCE_NAME)
    );
  };

  useEffect(() => {
    loadData();
  }, []);

  const _handleUpdateSetter = async (
    setter: RequestSetter,
    patch: Partial<RequestSetter>
  ) => {
    try {
      await update(setter, patch);
      await loadData();
    } catch (err) {
      console.log(err);
    }
  };

  const _handleCreateNewSetter = async (type: SetterEventType) => {
    try {
      await create({
        parentId: activeRequest._id,
        event: type,
      });
      await loadData();
    } catch (err) {
      console.log(err);
    }
  };

  const _handleDeleteSetter = async (setter: RequestSetter) => {
    await remove(setter);
    await loadData();
  };

  const _handleDeleteAllSetter = async (type: SetterEventType) => {
    const newSetterPrms = setters[type].map((setter) => remove(setter));
    await Promise.all(newSetterPrms);

    setSetters((prevSetters) => ({
      ...prevSetters,
      [type]: [],
    }));

    await loadData();
  };

  return (
    <div className='pad'>
      <div className='scrollable'>
        <StyledHeaderContainer>
          <h4>Request Data Setters by Events</h4>
          <Button onClick={loadData} className='btn btn--clicky'>
            <i className='fa fa-refresh' /> Reload variables
          </Button>
        </StyledHeaderContainer>
        <SetterEventRowEditor
          eventName={'Before send request'}
          eventType={SetterEventType.BEFORE_SEND_REQUEST}
          onChange={_handleUpdateSetter}
          pairs={setters[SetterEventType.BEFORE_SEND_REQUEST]}
          variables={variables}
          onCreate={_handleCreateNewSetter}
          onDelete={_handleDeleteSetter}
          onDeleteAll={_handleDeleteAllSetter}
        />
        <SetterEventRowEditor
          eventName={'During send request'}
          eventType={SetterEventType.DURING_SEND_REQUEST}
          onChange={_handleUpdateSetter}
          pairs={setters[SetterEventType.DURING_SEND_REQUEST]}
          variables={variables}
          onCreate={_handleCreateNewSetter}
          onDelete={_handleDeleteSetter}
          onDeleteAll={_handleDeleteAllSetter}
        />
        <SetterEventRowEditor
          eventName={'After received response'}
          eventType={SetterEventType.AFTER_RECEIVED_RESPONSE}
          onChange={_handleUpdateSetter}
          pairs={setters[SetterEventType.AFTER_RECEIVED_RESPONSE]}
          variables={variables}
          onCreate={_handleCreateNewSetter}
          onDelete={_handleDeleteSetter}
          onDeleteAll={_handleDeleteAllSetter}
        />
      </div>
    </div>
  );
};
