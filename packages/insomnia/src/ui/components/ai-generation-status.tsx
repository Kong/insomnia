import React from 'react';
import { useFetchers } from 'react-router-dom';

import { InsomniaAI } from './insomnia-ai-icon';
import { Tooltip } from './tooltip';

export const AIGenerationStatus = () => {
  const generations = useFetchers().filter(loader => loader.formAction?.includes('/ai/')).filter(loader => loader.state === 'submitting');

  if (generations.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--padding-xs)',
      }}
    >
      <InsomniaAI />
      <Tooltip
        message="AI is generating tests for your API"
      >
        <span>AI is generating</span>
      </Tooltip>
    </div>
  );
};
