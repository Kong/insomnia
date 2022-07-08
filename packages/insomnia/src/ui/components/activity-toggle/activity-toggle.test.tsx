import { describe } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { ACTIVITY_DEBUG, GlobalActivity } from '../../../common/constants';
import { Workspace } from '../../../models/workspace';
import { ActivityToggle } from './activity-toggle';

const mockWorkspace: Workspace = {
  _id: 'wrk_fddff92a88ce4cd2b05bf00506384321',
  type: 'Workspace',
  parentId: 'proj_default-project',
  modified: 1655301684731,
  created: 1655301684731,
  name: 'testing',
  description: '',
  scope: 'design',
  isPrivate: false,
};

describe('<ActivityToggle />', () => {
  test('renders without exploding', async () => {
    render(
      <MemoryRouter>
        <ActivityToggle
          activity={ACTIVITY_DEBUG}
          workspace={mockWorkspace}
          handleActivityChange={async () => {}}
        />
      </MemoryRouter>
    );
    const debug = screen.getByText('Debug');
    expect(debug).toBeDefined();
    expect(debug).toHaveClass('active');
    expect(screen.getByText('Test')).toBeDefined();
    expect(screen.getByText('Design')).toBeDefined();
  });

  test('toggles to a different activity', async () => {
    let activity = ACTIVITY_DEBUG;

    const user = userEvent.setup();
    const handleActivityChange = async ({ nextActivity }: { nextActivity: GlobalActivity }) => {
      activity = nextActivity;
    };

    const { rerender } = render(
      <MemoryRouter>
        <ActivityToggle
          activity={activity}
          workspace={mockWorkspace}
          handleActivityChange={handleActivityChange}
        />
      </MemoryRouter>
    );

    const debug = screen.getByText('Debug');
    expect(debug).toBeDefined();
    expect(debug).toHaveClass('active');

    const test = screen.getByText('Test');
    expect(test).toBeDefined();

    const design = screen.getByText('Design');
    expect(design).toBeDefined();

    await user.click(test);

    rerender(
      <MemoryRouter>
        <ActivityToggle
          activity={activity}
          workspace={mockWorkspace}
          handleActivityChange={handleActivityChange}
        />
      </MemoryRouter>
    );

    expect(debug).not.toHaveClass('active');
    expect(test).toHaveClass('active');

    await user.click(design);

    rerender(
      <MemoryRouter>
        <ActivityToggle
          activity={activity}
          workspace={mockWorkspace}
          handleActivityChange={handleActivityChange}
        />
      </MemoryRouter>
    );

    expect(test).not.toHaveClass('active');
    expect(debug).not.toHaveClass('active');
    expect(design).toHaveClass('active');
  });
});
