// Wires concrete infrastructure adapters to the application-layer Insomnia facade. Per the
// architecture plan, this kind of wiring belongs only in each app's own bootstrap code, never
// scattered through routes/commands. Location here is provisional - where each app's bootstrap
// code should live is still an open decision; this file exists to have exactly one place doing
// this wiring today.
//
// The React Router context token (createContext) lives here rather than in `application`:
// react-router is a desktop-specific framework dependency, and `application` must stay usable by
// any app (apps/cli, future MCP/web apps) - only the Insomnia class itself belongs there.
import { Insomnia } from 'application';
import { nedbEnvironmentRepository, nedbWorkspaceRepository } from 'infrastructure';
import { createContext } from 'react-router';

export const insomnia = new Insomnia({
  workspaceRepository: nedbWorkspaceRepository,
  environmentRepository: nedbEnvironmentRepository,
});

export const InsomniaContext = createContext<Insomnia>();
