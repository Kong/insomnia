import React from 'react';
import GravatarImg from './gravatar-img';

export default { title: 'Iconography | Gravatar' };

export const _default = () => <GravatarImg email="support@insomnia.rest" size={200} />;

export const _rounded = () => <GravatarImg rounded email="support@insomnia.rest" size={200} />;
