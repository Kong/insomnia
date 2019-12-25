import React from 'react';
import '../../../../.storybook/index.less';
import PromptButton from './prompt-button';

export default { title: 'Prompt Button' };

export const _default = () => <PromptButton className="btn btn--clicky">Do Something</PromptButton>;
