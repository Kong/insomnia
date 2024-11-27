export const scrollElementIntoView = (element: HTMLElement, options?: ScrollIntoViewOptions) => {
  if (element) {
    // @ts-expect-error -- scrollIntoViewIfNeeded is not a standard method
    element.scrollIntoViewIfNeeded ? element.scrollIntoViewIfNeeded() : element.scrollIntoView(options);
  }
};
