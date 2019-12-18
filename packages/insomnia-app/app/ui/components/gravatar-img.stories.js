import React from 'react';
import '../../../.storybook/index.less';
import GravatarImg from './gravatar-img';

export default { title: 'Gravatar Image' };

export const _default = () => <GravatarImg email="support@insomnia.rest" size={200} />;
