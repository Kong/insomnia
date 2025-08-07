import { create } from 'zustand';

type Store = ReturnType<ReturnType<typeof create<State>>>;
let store: Store | null = null;

interface State {
  filter: string;
  setFilter: (filter: string) => void;
}

export function useStore<T>(selector: (state: State) => T): [T, Store];
export function useStore(): [State, Store];
export function useStore<T>(selector?: (state: State) => T): [T | State, Store] {
  if (!store) {
    store = create<State>()(set => {
      return {
        filter: '',
        setFilter: filter => {
          set({ filter });
        },
      };
    });
  }
  const value = selector ? store!(selector) : store!();
  // expose the store for static usages like `store.getState()` in event handlers or useEffect...
  return [value, store];
}
