import React, { FC, useEffect, useState } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import * as models from '../../../../models';
import { Environment } from '../../../../models/environment';
import { Request } from '../../../../models/request';
import { REQUEST_DATASET_SETTING_COLLAPSE, RequestDataSet } from '../../../../models/request-dataset';
import { RequestLoaderData } from '../../../routes/request';
import { WorkspaceLoaderData } from '../../../routes/workspace';
import { showModal } from '../../modals';
import { GenerateCodeModal } from '../../modals/generate-code-modal';
import DatasetRowEditor from './dataset-row-editor';

interface Props {
  setLoading: (l: boolean) => void;
}

export const RequestDatasetEditor: FC<Props> = ({ setLoading }) => {
  const [toggleIconRotation, setToggleIconRotation] = useState(-90);
  const [baseDataset, setBaseDataset] = useState<RequestDataSet>();
  const [otherDatasets, setOtherDatasets] = useState<RequestDataSet[]>([]);
  const [subEnvironments, setSubEnvironments] = useState<Environment[]>([]);
  const [toggleEnvironmentFilter, setToggleEnvironmentFilter] = useState<boolean>(false);
  const [renderCount, setRenderCount] = useState<number>(0);
  const { activeRequest } = useRouteLoaderData(
    'request/:requestId'
  ) as RequestLoaderData;
  const {
    activeWorkspace,
    activeEnvironment,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;

  const addNewDataSet = async () => {
    if (baseDataset) {
      const dataset = await models.requestDataset.create({
        parentId: baseDataset.parentId,
      });
      onChange(
        baseDataset,
        [
          ...otherDatasets,
          dataset,
        ],
      );
    }
  };

  const load = async () => {
    const rootEnvironment = await models.environment.getOrCreateForParentId(activeWorkspace._id);
    const subEnvironments = await models.environment.findByParentId(rootEnvironment._id);
    const baseDataset = await models.requestDataset.getOrCreateForRequest(activeRequest);
    let datasets = await models.requestDataset.findByParentId(activeRequest._id);
    datasets = datasets.filter(ds => ds._id !== baseDataset._id);
    setSubEnvironments(subEnvironments);
    setBaseDataset(baseDataset);
    setOtherDatasets(datasets);
  };

  const onBaseDatasetChanged = async (dataset: RequestDataSet) => {
    if (baseDataset) {
      const bdsKeys = Object.keys(dataset.environment);
      const updatedDataset = await models.requestDataset.update(baseDataset, {
        environment: dataset.environment,
      });
      const newDatasetResults = otherDatasets.map(ds => {
        const dsEnvironment = bdsKeys.reduce(
          (obj, key) => Object.assign(obj, {
            [key]: Object.assign({
              value: '',
              description: '',
            }, ds.environment[key], {
              id: key,
              name: dataset.environment[key].name,
              metaSortKey: dataset.environment[key].metaSortKey,
            }),
          }), {});
        (ds as any).new = true;
        return models.requestDataset.update(ds, {
          environment: dsEnvironment,
        });
      });
      let newDatasets = await Promise.all(newDatasetResults);
      newDatasets = newDatasets.map(ds => Object.assign(ds, { new: true }));
      onChange(updatedDataset, newDatasets);
    }
  };

  const onChange = (baseDataset: RequestDataSet, otherDatasets: RequestDataSet[], nextRenderCount?: number) => {
    if (nextRenderCount !== undefined) {
      setRenderCount(nextRenderCount);
    }
    setBaseDataset(baseDataset);
    setOtherDatasets(otherDatasets);
  };

  const onDatasetChanged = async (dataset: RequestDataSet) => {
    let updatingDataset = otherDatasets.filter(ds => ds._id === dataset._id)[0];
    if (updatingDataset && baseDataset) {
      updatingDataset = await models.requestDataset.update(updatingDataset, {
        environment: dataset.environment,
        name: dataset.name,
        description: dataset.description,
        applyEnv: dataset.applyEnv,
      });
      const newDatasets = otherDatasets.map(ds => ds._id === updatingDataset._id ? updatingDataset : ds);
     onChange(baseDataset, newDatasets);
    }
  };

  const onDeleteDataset = async (dataset: RequestDataSet) => {
    const deletingDataset = otherDatasets.filter(ds => ds._id === dataset._id)[0];
    if (deletingDataset && baseDataset) {
      await models.requestDataset.remove(deletingDataset);
      const newDatasets = otherDatasets.filter(ds => ds._id !== dataset._id);
      onChange(baseDataset, newDatasets);
    }
  };

  const onSendWithDataset = (dataset: RequestDataSet) => {
    onSendWithDataset(activeRequest, dataset);
  };

  const handleGenerateCode = (request: Request, dataset?: RequestDataSet) => {
    showModal(GenerateCodeModal, {
      request,
      dataset,
    });
  };

  const handleGenerateCodeWithDataset = (dataset: RequestDataSet) => {
    handleGenerateCode(activeRequest, dataset);
  };

  const handleDuplicate = async (dataset: RequestDataSet) => {
    if (baseDataset) {
      const duplicatingDataset = otherDatasets.filter(ds => ds._id === dataset._id)[0];
      const duplicatedDataset = await models.requestDataset.duplicate(
        duplicatingDataset,
        {
          parentId: baseDataset.parentId,
        }
      );
      onChange(
        baseDataset,
        [
          ...otherDatasets,
          duplicatedDataset,
        ],
      );
    }
  };

  const handlePromoteToDefault = async (dataset: RequestDataSet) => {
    let promotingDataset = otherDatasets.filter(ds => ds._id === dataset._id)[0];
    if (promotingDataset && baseDataset) {
      const promotingEnvironment = { ...promotingDataset.environment };
      const baseEnvironment = { ...baseDataset.environment };
      const baseDatasetFromModels = await models.requestDataset.update(baseDataset, {
        environment: promotingEnvironment,
      });
      setBaseDataset(baseDatasetFromModels);
      promotingDataset = await models.requestDataset.update(promotingDataset, {
        environment: baseEnvironment,
      });
      setOtherDatasets(otherDatasets.map(
        ds => ds._id === promotingDataset._id ? { ...promotingDataset } : ds
      ));
      if (baseDataset) {
        onChange(baseDataset, otherDatasets, renderCount + 1);
      }
    }
  };

  const updateToggleEnvironmentFilter = () => {
    models.request.update(activeRequest, {
      settingDatasetFilter: !toggleEnvironmentFilter,
    });
    setToggleEnvironmentFilter(!toggleEnvironmentFilter);
  };

  const handleToggleChanged = async (dataset: RequestDataSet, toggle: boolean) => {
    let updatingDataset = otherDatasets.filter(ds => ds._id === dataset._id)[0];
    if (baseDataset && updatingDataset) {
      updatingDataset = await models.requestDataset.update(updatingDataset, {
        settings: {
          ...(updatingDataset.settings || {}),
          [REQUEST_DATASET_SETTING_COLLAPSE]: toggle,
        },
      });
      const newDatasets = otherDatasets.map(ds => ds._id === updatingDataset._id ? updatingDataset : ds);
      onChange(baseDataset, newDatasets);
    }
  };

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pad">
      <div className="scrollable">
        <h4>Base dataset</h4>
        {baseDataset && <DatasetRowEditor
          dataset={baseDataset}
          isBaseDataset={true}
          onChanged={onBaseDatasetChanged}
          setLoading={setLoading}
        />}
        <hr />
        <button className="btn btn--clicky faint" onClick={addNewDataSet}>
          Add new dataset
        </button>
        {/* <ListGroup> */}
          {otherDatasets.map((dataset, i) => (
            <DatasetRowEditor
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              onGenerateCodeWithDataset={handleGenerateCodeWithDataset}
              dataset={dataset}
              isBaseDataset={false}
              onChanged={onDatasetChanged}
              onDeleteDataset={onDeleteDataset}
              onSendWithDataset={onSendWithDataset}
              setLoading={setLoading}
            />
          ))}
        {/* </ListGroup> */}
      </div>
    </div>
  );
};
