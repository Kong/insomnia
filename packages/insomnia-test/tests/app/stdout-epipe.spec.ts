import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

test("Verify Main Process Survives An Async EPIPE Error On stdout", async ({
  user,
}) => {
  const { appFlow } = user.flowManager;

  const listenerCountBefore = await appFlow.getStdoutListenerCount("error");
  await appFlow.emitStdoutEpipeError();
  const alive = await appFlow.isAlive();

  expect(listenerCountBefore).toBeGreaterThan(0);
  expect(alive).toBe(true);
});
