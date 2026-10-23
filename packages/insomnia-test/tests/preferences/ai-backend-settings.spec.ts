import { faker } from "@faker-js/faker";

import { expect, MOCK_LLM_SERVER,test } from "../../misc/fixtures";

test("Verify an LLM backend's config persists and can be activated then deactivated in AI Settings", async ({
  user,
}) => {
  const { preferencesFlow } = user.flowManager;

  const config = {
    url: MOCK_LLM_SERVER,
    model: "mock-llm-model-1",
    apiKey: faker.string.alphanumeric(24),
    temperature: 0.7,
    topP: 0.95,
    maxTokens: 4096,
  };
  const afterActivate = await preferencesFlow.set({ aiUrlBackend: config });
  const afterDeactivate = await preferencesFlow.set({ aiUrlBackend: null });

  expect(afterActivate.aiUrlBackend?.url).toBe(config.url);
  expect(afterActivate.aiUrlBackend?.model).toBe(config.model);
  expect(afterActivate.aiUrlBackend?.apiKey).toBe(config.apiKey);
  expect(afterActivate.aiUrlBackend?.temperature).toBe(config.temperature);
  expect(afterActivate.aiUrlBackend?.topP).toBe(config.topP);
  expect(afterActivate.aiUrlBackend?.maxTokens).toBe(config.maxTokens);
  expect(afterActivate.aiUrlBackend?.isActive).toBe(true);
  expect(afterDeactivate.aiUrlBackend).toEqual({
    ...afterActivate.aiUrlBackend,
    isActive: false,
  });
});
