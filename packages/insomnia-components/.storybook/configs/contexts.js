import * as React from 'react';

const ThemeProvider = props => {
  // Apply theme later because storybook adds its own `<body theme="...">` attribute too.
  // TODO: Eventually change ours to `insomnia-theme` or something more specific.
  setTimeout(() => document.body.setAttribute('theme', props.theme), 500);

  return props.children;
};

export const contexts = [
  {
    icon: 'box', // a icon displayed in the Storybook toolbar to control contextual props
    title: 'Themes', // an unique name of a contextual environment
    components: [
      ThemeProvider,
    ],
    params: [
      { name: 'Designer Light', props: { theme: 'studio-light' }, default: true },
      { name: 'Designer Dark', props: { theme: 'studio-colorful' } },
    ],
    options: {
      deep: true, // pass the `props` deeply into all wrapping components
      disable: false, // disable this contextual environment completely
      cancelable: false, // allow this contextual environment to be opt-out optionally in toolbar
    },
  },
];
