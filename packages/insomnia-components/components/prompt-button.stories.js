import React from 'react';
import PromptButton from './prompt-button';

export default { title: 'Buttons | Prompt Button' };

export const _default = () => <PromptButton onClick={e => alert('Confirmed...')}>Do Something</PromptButton>;
