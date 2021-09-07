# The Plan for Modals

## Where we are

1. We're trying to move the entire codebase to hooks.  With the possible exception of one component (ErrorBoundary) there should be no component in the codebase that must be a class.
1. Right now, all modals are classes.  One core reason for this is that `showModal` in `app/ui/components/modals/index.ts` directly calls `show` on the modal instance of a registered modal.

## Where we're going (TBC, but this is an initial plan)

1. Modal lifecycle state (hiding, showing, loading) will be managed with redux actions.  This will eliminate the current blocker for moving to hooks.
1. All modals will be hooks.
    1. Modals will thereby do their part in the larger mission of dropping the class-autobind-decorator dependency.
1. Modals will use portals.
1. Modals will not have to be singletons, making them more easily composable in the app's flows.
    1. For an example of why singleton modals cause issues, see the regression that was resolved in [#3970](https://github.com/Kong/insomnia/pull/3970)
1. Modals will not have to be loaded into the react tree at all times.

## How we're going to get there

1. refactoring all modals to use as little in the way of class-stuff as possible.  For example:
    1. using `createRef` means that transition to `useRef` will be much simpler since the semantics are the same between the two (but slightly different from the manual approach we often take).
    1. reducing the number of class members as much as possible
    1. removing usages of class-autobind-decorator
1. As a middle step to getting to redux, we may opt to move to passing the `show` callback in to `showModal` as a callback (rather than calling it directly on an instance).
