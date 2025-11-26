import { resolve } from 'node:path';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Button, Input, Text } from 'react-aria-components';
import z from 'zod/v4';

import type { LLMBackend, LLMConfig } from '~/main/llm-config-service';
import { Icon } from '~/ui/components/icon';

const modelParametersSchema = z.object({
  temperature: z.number().min(0).max(2),
  topP: z.number().min(0).max(1),
  topK: z.number().min(0).max(100),
  seed: z.boolean(),
  repeatPenalty: z.number().min(0).max(10),
});

const DEFAULT_MODEL_PARAMETERS = {
  temperature: 0.6,
  topP: 0.9,
  topK: 40,
  seed: true,
  repeatPenalty: 1.1,
};

const LLMS_FOLDER_NAME = 'llms';

export const GGUF = ({
  saveLLMSettings,
  configuredLLMs,
  currentLLM,
  deactivateCurrentLLM,
}: {
  currentLLM: LLMConfig | null;
  saveLLMSettings: (setCurrent: boolean, backend: LLMBackend, extras?: Partial<LLMConfig>) => void;
  deactivateCurrentLLM: () => Promise<void>;
  configuredLLMs: LLMConfig[];
}) => {
  const [modelParameters, setModelParameters] = useState<z.infer<typeof modelParametersSchema>>({
    ...DEFAULT_MODEL_PARAMETERS,
  });
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  const userDataPath = resolve(window.app.getPath('userData'));
  const llmsFolder = resolve(userDataPath, LLMS_FOLDER_NAME);
  const [availableLLMs, setAvailableLLMs] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const refreshModelsDirectory = useCallback(() => {
    window.main
      .readOrCreateDataDir({ folder: LLMS_FOLDER_NAME })
      .then(models => {
        const currentlyAvailableLLMs = models
          .filter(model => model.type === 'file' && model.name.toLowerCase().endsWith('.gguf'))
          .map(model => model.name);

        setAvailableLLMs(currentlyAvailableLLMs);
      })
      .catch(() => {
        setAvailableLLMs([]);
      });
  }, []);

  useEffect(() => {
    if (configuredLLMs.length === 1) {
      const config = configuredLLMs[0];
      setSelectedModel(config.model);

      setModelParameters({
        temperature: config.temperature ?? DEFAULT_MODEL_PARAMETERS.temperature,
        topP: config.topP ?? DEFAULT_MODEL_PARAMETERS.topP,
        topK: config.topK ?? DEFAULT_MODEL_PARAMETERS.topK,
        seed: config.seed ?? DEFAULT_MODEL_PARAMETERS.seed,
        repeatPenalty: config.repeatPenalty ?? DEFAULT_MODEL_PARAMETERS.repeatPenalty,
      });
    }
  }, [configuredLLMs]);

  useEffect(() => {
    refreshModelsDirectory();
  }, [refreshModelsDirectory]);

  const hasChanges = useMemo(() => {
    const tempChanged =
      modelParameters.temperature !== (currentLLM?.temperature ?? DEFAULT_MODEL_PARAMETERS.temperature);
    const topPChanged = modelParameters.topP !== (currentLLM?.topP ?? DEFAULT_MODEL_PARAMETERS.topP);
    const topKChanged = modelParameters.topK !== (currentLLM?.topK ?? DEFAULT_MODEL_PARAMETERS.topK);
    const seedChanged = modelParameters.seed !== (currentLLM?.seed ?? DEFAULT_MODEL_PARAMETERS.seed);
    const repeatPenaltyChanged =
      modelParameters.repeatPenalty !== (currentLLM?.repeatPenalty ?? DEFAULT_MODEL_PARAMETERS.repeatPenalty);

    return (
      selectedModel !== currentLLM?.model ||
      tempChanged ||
      topPChanged ||
      topKChanged ||
      seedChanged ||
      repeatPenaltyChanged
    );
  }, [selectedModel, currentLLM, modelParameters]);

  const modelId = useId();
  const temperatureId = useId();
  const topPId = useId();
  const topKId = useId();
  const repeatPenaltyId = useId();
  const seedId = useId();
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="form-control form-control--outlined">
        <label htmlFor={modelId}>Model:</label>
        <div className="flex flex-row gap-2">
          <select
            id={modelId}
            className=""
            onChange={e => {
              setSelectedModel(e.target.value);
            }}
            value={selectedModel}
          >
            <option value="">Select a model</option>
            {availableLLMs.map(model => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
          <Button
            className="border-md rounded-md border border-solid border-(--hl-md) px-2 py-1 text-base text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) aria-selected:bg-(--hl-sm)"
            onClick={() => {
              refreshModelsDirectory();
              setSelectedModel('');
            }}
          >
            <Icon icon="refresh" />
          </Button>
        </div>
      </div>
      <Text className="text-xs">
        You can add more models by placing GGUF files in{' '}
        <Button className="underline" onClick={() => window.shell.openPath(llmsFolder)}>
          the LLMs folder
        </Button>
      </Text>
      {selectedModel && (
        <div className="mt-4">
          <Button
            className="flex w-full items-center justify-between rounded-md border border-(--hl-md) bg-(--color-bg) px-4 py-3 text-left text-(--color-font) transition-all hover:bg-(--hl-xs)"
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
          >
            <Text className="font-medium">Advanced Options</Text>
            <Icon icon={showAdvancedOptions ? 'chevron-up' : 'chevron-down'} />
          </Button>

          {showAdvancedOptions && (
            <div className="mt-3 rounded-md border border-(--hl-md) bg-(--hl-xs) p-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="form-control form-control--outlined">
                  <label htmlFor={temperatureId}>Temperature (0-2):</label>
                  <Input
                    id={temperatureId}
                    type="number"
                    value={modelParameters.temperature.toString()}
                    onChange={e => {
                      const value = parseFloat(e.target.value);
                      if (!Number.isNaN(value) && value >= 0 && value <= 2) {
                        setModelParameters(prev => ({ ...prev, temperature: value }));
                      }
                    }}
                    step="0.1"
                    min={modelParametersSchema.shape.temperature.min.toString()}
                    max={modelParametersSchema.shape.temperature.max.toString()}
                  />
                </div>

                <div className="form-control form-control--outlined">
                  <label htmlFor={topPId}>Top P (0-1):</label>
                  <Input
                    id={topPId}
                    type="number"
                    value={modelParameters.topP.toString()}
                    onChange={e => {
                      const value = parseFloat(e.target.value);
                      if (!Number.isNaN(value) && value >= 0 && value <= 1) {
                        setModelParameters(prev => ({ ...prev, topP: value }));
                      }
                    }}
                    step="0.01"
                    min={modelParametersSchema.shape.topP.min.toString()}
                    max={modelParametersSchema.shape.topP.max.toString()}
                  />
                </div>

                <div className="form-control form-control--outlined">
                  <label htmlFor={topKId}>Top K (0-100):</label>
                  <Input
                    id={topKId}
                    type="number"
                    value={modelParameters.topK.toString()}
                    onChange={e => {
                      const value = parseInt(e.target.value, 10);
                      if (!Number.isNaN(value) && value >= 0 && value <= 100) {
                        setModelParameters(prev => ({ ...prev, topK: value }));
                      }
                    }}
                    step="1"
                    min={modelParametersSchema.shape.topK.min.toString()}
                    max={modelParametersSchema.shape.topK.max.toString()}
                  />
                </div>

                <div className="form-control form-control--outlined">
                  <label htmlFor={repeatPenaltyId}>Repeat Penalty (0-10):</label>
                  <Input
                    id={repeatPenaltyId}
                    type="number"
                    value={modelParameters.repeatPenalty.toString()}
                    onChange={e => {
                      const value = parseFloat(e.target.value);
                      if (!Number.isNaN(value) && value >= 0 && value <= 10) {
                        setModelParameters(prev => ({ ...prev, repeatPenalty: value }));
                      }
                    }}
                    step="0.1"
                    min={modelParametersSchema.shape.repeatPenalty.min.toString()}
                    max={modelParametersSchema.shape.repeatPenalty.max.toString()}
                  />
                </div>
              </div>

              <div className="form-control form-control--outlined mt-4">
                <label htmlFor={seedId}>
                  <input
                    id={seedId}
                    type="checkbox"
                    checked={modelParameters.seed}
                    onChange={e => setModelParameters(prev => ({ ...prev, seed: e.target.checked }))}
                  />
                  <Text className="text-md relative top-[8px]">Use Random Seed</Text>
                </label>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="mt-4 flex flex-row justify-between gap-2">
        <Button
          isDisabled={currentLLM?.backend !== 'gguf'}
          onClick={deactivateCurrentLLM}
          className="rounded-md border border-solid border-red-500 bg-(--color-bg) px-4 py-2 text-base text-red-500 ring-1 ring-transparent transition-all hover:border-red-600 hover:bg-(--hl-xs) focus:ring-red-300 focus:ring-inset"
        >
          Deactivate
        </Button>
        <Button
          isDisabled={!hasChanges || !selectedModel}
          onClick={() => {
            const validationResult = modelParametersSchema.safeParse(modelParameters);

            if (validationResult.success) {
              const paramsToSave = {
                model: selectedModel,
                temperature: modelParameters.temperature,
                topP: modelParameters.topP,
                topK: modelParameters.topK,
                seed: modelParameters.seed,
                repeatPenalty: modelParameters.repeatPenalty,
              };
              saveLLMSettings(true, 'gguf', paramsToSave);
            } else {
              console.error('Validation failed:', validationResult.error);
            }
          }}
          className="border-md rounded-md border border-solid border-(--hl-md) px-4 py-1 text-base text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) aria-selected:bg-(--hl-sm)"
        >
          Activate
        </Button>
      </div>
    </div>
  );
};
