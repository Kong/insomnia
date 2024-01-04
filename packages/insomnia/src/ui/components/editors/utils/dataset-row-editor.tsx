import React, { FC, useCallback, useEffect, useState } from 'react';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';
import styled from 'styled-components';

import { getCommonHeaderNames, getCommonHeaderValues } from '../../../../common/common-headers';
import { DEFAULT_PANE_WIDTH } from '../../../../common/constants';
import { metaSortKeySort } from '../../../../common/sorting';
import * as models from '../../../../models';
import { Environment } from '../../../../models/environment';
import { isEventStreamRequest } from '../../../../models/request';
import { REQUEST_DATASET_SETTING_COLLAPSE, RequestDataSet } from '../../../../models/request-dataset';
import { tryToInterpolateRequestOrShowRenderErrorModal } from '../../../../utils/try-interpolate';
import { buildQueryStringFromParams, joinUrlAndQueryString } from '../../../../utils/url/querystring';
import { SegmentEvent } from '../../../analytics';
import { Button } from '../../../components/themed-button';
import { ConnectActionParams, RequestLoaderData, SendActionParams } from '../../../routes/request';
import { useRootLoaderData } from '../../../routes/root';
import { WorkspaceLoaderData } from '../../../routes/workspace';
import { Editable } from '../../base/editable';
import { PromptButton } from '../../base/prompt-button';
import { KeyValueEditor } from '../../key-value-editor/key-value-editor';
import { showAlert } from '../../modals';
import { SvgIcon } from '../../svg-icon';
import { ChooseEnvironmentsDropdown } from './choose-environments-dropdown';

interface Props {
  dataset: RequestDataSet;
  isBaseDataset: boolean;
  onChanged: (dataset: RequestDataSet) => void;
  onDeleteDataset?: (dataset: RequestDataSet) => void;
  onPromoteToDefault?: (dataset: RequestDataSet) => void;
  onDuplicate?: (dataset: RequestDataSet) => void;
  onGenerateCodeWithDataset?: (dataset: RequestDataSet) => void;
  onToggleChanged?: (dataset: RequestDataSet, toggle: boolean) => void;
  setLoading: (l: boolean) => void;
}

const StyledResultListItem = styled.li`
  padding: 0 var(--padding-sm);
  list-style-type: none;

  > div:first-of-type {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr) auto auto auto auto auto auto;
    padding: var(--padding-xs) 0;
  }

  svg {
    fill: var(--hl-xl);
  }

  h2 {
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-normal);
    margin: 0px;
    padding-top: 5px;
  }

  button {
    padding: 0px var(--padding-xs);
  }
`;

const StyledKeyPairSpliterContainer = styled.div`
  position: relative;
  > .spliter {
    position: absolute;
    top: 15px;
    bottom: calc(
      var(--padding-md) + var(--padding-sm) + var(--padding-sm) +
        var(--line-height-xs)
    );
    border-left: 2px solid var(--hl-md);
    overflow: visible;
    cursor: ew-resize;
    z-index: 9;
    width: var(--drag-width);

    > i {
      position: absolute;
      top: -23px;
      left: -12.5px;
      color: var(--hl-md);
      cursor: pointer;
      padding: var(--padding-xs);
    }
  }
  .width-evaluater {
    position: absolute;
    height: 0;
    width: calc(
      100% - var(--line-height-sm) - 1.1rem - (var(--padding-xs) * 2) -
        var(--padding-sm)
    );
    left: var(--line-height-sm);
  }
`;

const datasetPaneWidth = DEFAULT_PANE_WIDTH; // temporarily hardcode

const DatasetRowEditor: FC<Props> = ({
  dataset,
  onChanged,
  isBaseDataset,
  onToggleChanged,
  onDeleteDataset,
  onGenerateCodeWithDataset,
  onPromoteToDefault,
  onDuplicate,
  setLoading,
}) => {
  const { activeWorkspace, baseEnvironment, subEnvironments } =
    useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const { activeRequest } = useRouteLoaderData(
    'request/:requestId'
  ) as RequestLoaderData;
  const { settings } = useRootLoaderData();
  const [datasetName, setDatasetName] = useState('');
  const [datasetKey, setDatasetKey] = useState(0);
  const [baseDataset, setBaseDataset] = useState<
    {
      id: string;
      metaSortKey: number;
      name: string;
      value: string;
      description: string;
      multiline: boolean;
      type: string;
    }[]
  >();
  const environments = [baseEnvironment, ...subEnvironments];
  const [activeEnvironment, setActiveEnvironment] = useState<
    Environment | undefined
  >(environments.find(e => e._id === dataset.applyEnv)); // define active environment for each dataset, not active environment in workspace
  const isOpenDataset: boolean =
    dataset.settings?.[REQUEST_DATASET_SETTING_COLLAPSE] || false;
  const fetcher = useFetcher();

  const toggleIconRotation = -90;
  // const isPercentageType = datasetPaneWidthType === DATASET_WIDTH_TYPE_PERCENTAGE;
  // const isFixedType = datasetPaneWidthType === DATASET_WIDTH_TYPE_FIX_LEFT;
  const isPercentageType = true;
  // const isFixedType = true;

  const spliterStyle: React.CSSProperties = {};
  if (isPercentageType) {
    spliterStyle.left = `calc((100% - var(--line-height-sm) - 3.4rem - (var(--padding-xs) * 2) - var(--padding-sm)) * ${datasetPaneWidth} + var(--line-height-sm))`;
  } else {
    spliterStyle.left = `calc(${datasetPaneWidth}px + var(--line-height-sm))`;
  }

  // TODO: unpick this loading hack
  useEffect(() => {
    if (fetcher.state !== 'idle') {
      setLoading(true);
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.state]);
  const { organizationId, projectId, workspaceId, requestId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    requestId: string;
  };
  const connect = useCallback(
    (connectParams: ConnectActionParams) => {
      fetcher.submit(JSON.stringify(connectParams), {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestId}/connect`,
        method: 'post',
        encType: 'application/json',
      });
    },
    [fetcher, organizationId, projectId, requestId, workspaceId]
  );
  const send = useCallback(
    (sendParams: SendActionParams) => {
      fetcher.submit(JSON.stringify(sendParams), {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestId}/send`,
        method: 'post',
        encType: 'application/json',
      });
    },
    [fetcher, organizationId, projectId, requestId, workspaceId]
  );

  const sendOrConnect = useCallback(
    async (
      shouldPromptForPathAfterResponse?: boolean,
      dataset?: RequestDataSet
    ) => {
      models.stats.incrementExecutedRequests();
      window.main.trackSegmentEvent({
        event: SegmentEvent.requestExecute,
        properties: {
          preferredHttpVersion: settings.preferredHttpVersion,
          authenticationType: activeRequest.authentication?.type,
          mimeType: activeRequest.body.mimeType,
        },
      });

      if (!dataset) {
        dataset = await models.requestDataset.getOrCreateForRequest(
          activeRequest
        );
      }

      if (isEventStreamRequest(activeRequest)) {
        const startListening = async () => {
          const environmentId = activeEnvironment?._id || '';
          const workspaceId = activeWorkspace._id;
          // Render any nunjucks tags in the url/headers/authentication settings/cookies
          const workspaceCookieJar =
            await models.cookieJar.getOrCreateForParentId(workspaceId);
          const rendered = await tryToInterpolateRequestOrShowRenderErrorModal({
            request: activeRequest,
            environmentId,
            payload: {
              url: activeRequest.url,
              headers: activeRequest.headers,
              authentication: activeRequest.authentication,
              parameters: activeRequest.parameters.filter(p => !p.disabled),
              workspaceCookieJar,
            },
          });
          rendered &&
            connect({
              url: joinUrlAndQueryString(
                rendered.url,
                buildQueryStringFromParams(rendered.parameters)
              ),
              headers: rendered.headers,
              authentication: rendered.authentication,
              cookieJar: rendered.workspaceCookieJar,
              suppressUserAgent: rendered.suppressUserAgent,
            });
        };
        startListening();
        return;
      }

      try {
        send({
          requestId,
          shouldPromptForPathAfterResponse,
          datasetId: dataset._id,
        });
      } catch (err) {
        showAlert({
          title: 'Unexpected Request Failure',
          message: (
            <div>
              <p>The request failed due to an unhandled error:</p>
              <code className="wide selectable">
                <pre>{err.message}</pre>
              </code>
            </div>
          ),
        });
      }
    },
    [
      activeEnvironment?._id,
      activeRequest,
      activeWorkspace._id,
      connect,
      requestId,
      send,
      settings.preferredHttpVersion,
    ]
  );

  useEffect(() => {
    const datasetList = Object.keys(dataset.environment)
      .map(k => ({
        _id: k,
        id: k,
        name: dataset.environment[k].name,
        metaSortKey: dataset.environment[k].metaSortKey,
        value: dataset.environment[k].value,
        description: dataset.environment[k].description,
        multiline: dataset.environment[k].multiline,
        type: 'text',
      }))
      .sort(metaSortKeySort);
    setBaseDataset(datasetList);
    setDatasetName(dataset.name);
    setActiveEnvironment(activeEnvironment);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isBaseDataset && (dataset as any).new) {
      const datasetList = Object.keys(dataset.environment)
        .map(k => ({
          _id: k,
          id: k,
          name: dataset.environment[k].name,
          metaSortKey: dataset.environment[k].metaSortKey,
          value: dataset.environment[k].value,
          description: dataset.environment[k].description,
          multiline: dataset.environment[k].multiline,
          type: 'text',
        }))
        .sort(metaSortKeySort);
      setBaseDataset(datasetList);
      setDatasetName(dataset.name);
      setDatasetKey(prevDatasetKey => prevDatasetKey + 1);
    }
  }, [dataset, isBaseDataset]);

  const handleKeyValueUpdate = (datasetList: any[]) => {
    dataset.environment = datasetList.reduce((obj, ds, i) => {
      ds.metaSortKey = i;
      obj[ds.id] = {
        name: ds.name,
        description: ds.description,
        value: ds.value,
        metaSortKey: ds.metaSortKey,
        multiline: ds.multiline,
      };
      return obj;
    }, {});
    onChanged(dataset);
    setBaseDataset(datasetList);
  };

  const toggle = () => {
    onToggleChanged && onToggleChanged(dataset, !isOpenDataset);
  };

  const handleOnDeleteDataset = () => {
    if (onDeleteDataset) {
      onDeleteDataset(dataset);
    }
  };

  const prepareDataset = (): RequestDataSet => {
    return Object.assign({}, dataset, {
      name: datasetName,
      environment: baseDataset?.reduce((obj, ds, i) => {
        ds.metaSortKey = i;
        obj[ds.id] = {
          name: ds.name,
          description: ds.description,
          value: ds.value,
          metaSortKey: ds.metaSortKey,
          multiline: ds.multiline,
        };
        return obj;
      }, {}),
    });
  };

  const handleOnSendWithDataset = () => {
    const thisDataset = prepareDataset();
    sendOrConnect(undefined, thisDataset);
  };

  const handleOnGenerateCode = () => {
    const thisDataset = prepareDataset();
    if (onGenerateCodeWithDataset) {
      onGenerateCodeWithDataset(thisDataset);
    }
  };

  const changeDatasetName = (newName: string) => {
    dataset.name = newName;
    onChanged(dataset);
    setDatasetName(newName);
  };

  const handleChangeEnvironment = (environmentId: string) => {
    dataset.applyEnv = environmentId;
    onChanged(dataset);
    setActiveEnvironment(environments.find(e => e._id === environmentId));
  };

  const handleOnSetDefaultDataset = () => {
   onPromoteToDefault && onPromoteToDefault(dataset);
  };

  const handleOnDuplicate = () => {
    if (onDuplicate) {
      onDuplicate(dataset);
    }
  };

  if (isBaseDataset) {
    return (
      <StyledKeyPairSpliterContainer>
        {/* <div className="width-evaluater" ref={handleSetRequestDatasetPaneRef} />
          <div
            className="spliter"
            onMouseDown={handleStartDragDatasetPaneHorizontal}
            onDoubleClick={handleResetDragDatasetPaneHorizontal}
            style={spliterStyle}
          >
            <i
              className={classnames('fa', { 'fa-arrows-h': isPercentageType }, { 'fa-arrow-right': isFixedType })}
              // @ts-expect-error -- TSCONVERSION
              onClick={handleToggleDatasetResizeType}
            />
          </div> */}
        {baseDataset && (
          <KeyValueEditor
            namePlaceholder="data key"
            valuePlaceholder="data value"
            descriptionPlaceholder="description"
            pairs={baseDataset}
            handleGetAutocompleteNameConstants={getCommonHeaderNames}
            handleGetAutocompleteValueConstants={getCommonHeaderValues}
            onChange={handleKeyValueUpdate}
          />
        )}
      </StyledKeyPairSpliterContainer>
    );
  }

  return (
    <StyledResultListItem>
      <div>
        <Button
          onClick={toggle}
          variant="text"
          style={
            isOpenDataset
              ? {}
              : { transform: `rotate(${toggleIconRotation}deg)` }
          }
        >
          <SvgIcon icon="chevron-down" />
        </Button>
        <Button variant="text" disabled>
          <SvgIcon icon="file" />
        </Button>
        <h2>
          <Editable
            className="block"
            onSubmit={changeDatasetName}
            value={datasetName}
          />
        </h2>
        {activeWorkspace && (
          <ChooseEnvironmentsDropdown
            handleChangeEnvironment={handleChangeEnvironment}
            activeEnvironment={activeEnvironment}
            environments={environments}
            workspace={activeWorkspace}
          />
        )}
        <PromptButton
          key={Math.random()}
          tabIndex={-1}
          confirmMessage="Click to confirm"
          onClick={handleOnSetDefaultDataset}
          title="Set as default dataset"
        >
          <i className="fa fa-certificate" />
        </PromptButton>

        <Button variant="text" onClick={handleOnDuplicate}>
          <i className="fa fa-files-o" />
        </Button>
        <Button variant="text" onClick={handleOnGenerateCode}>
          <i className="fa fa-code" />
        </Button>
        <PromptButton
          key={Math.random()}
          tabIndex={-1}
          confirmMessage="Click to confirm"
          onClick={handleOnDeleteDataset}
          title="Delete dataset"
        >
          <i className="fa fa-trash-o" />
        </PromptButton>

        <Button variant="text" onClick={handleOnSendWithDataset}>
          <SvgIcon icon="play" />
        </Button>
      </div>

      {isOpenDataset && (
        <div>
          {baseDataset?.length && (
            <KeyValueEditor
              key={datasetKey}
              namePlaceholder="data key"
              valuePlaceholder="data value"
              descriptionPlaceholder="description"
              pairs={baseDataset}
              allowMultiline
              handleGetAutocompleteNameConstants={getCommonHeaderNames}
              handleGetAutocompleteValueConstants={getCommonHeaderValues}
              onChange={handleKeyValueUpdate}
            />
          )}
          {!baseDataset?.length && <span>Update base dataset first</span>}
        </div>
      )}
    </StyledResultListItem>
  );
};

export default DatasetRowEditor;
