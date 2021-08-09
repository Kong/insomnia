export const invokeAsyncSynchronously = (callback: () => Promise<void>) => {
  async function func() {
    await callback();
  }
  func();
};
