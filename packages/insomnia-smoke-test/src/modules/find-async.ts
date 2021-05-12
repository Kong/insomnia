export async function findAsync<Input, Result>(
  arr: Input[],
  asyncCallback: (value: Input, index: number, array: Input[]) => Promise<Result>,
) {
  const promises = arr.map<Promise<Result>>(asyncCallback);
  const results = await Promise.all(promises);
  const index = results.findIndex(result => result);
  return arr[index];
}
