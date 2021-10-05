import { configure, addDecorator } from '@storybook/react';
import { withContexts } from '@storybook/addon-contexts/react';
import { contexts } from './configs/contexts';
import { withInfo } from '@storybook/addon-info';

addDecorator(withContexts(contexts));
addDecorator(withInfo({ inline: true }));

configure(require.context('../src', true, /\.stories\.tsx?$/), module);
