import * as React from 'react';

const ThemeProvider = props => {
  return (
    <div theme={props.theme} id="theme-provider">
      {props.children}
    </div>
  );
};

export const contexts = [
  {
    icon: 'box', // a icon displayed in the Storybook toolbar to control contextual props
    title: 'Themes', // an unique name of a contextual environment
    components: [
      ThemeProvider,
    ],
    params: [
      { name: 'Studio Light', props: { theme: 'studio-light' }, default: true },
      { name: 'Studio Dark', props: { theme: 'studio-colorful' } },
    ],
    options: {
      deep: true, // pass the `props` deeply into all wrapping components
      disable: false, // disable this contextual environment completely
      cancelable: false, // allow this contextual environment to be opt-out optionally in toolbar
    },
  },
];
