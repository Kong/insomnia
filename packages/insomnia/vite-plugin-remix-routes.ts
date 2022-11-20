import type { AppConfig } from '@remix-run/dev/dist/config';
import type {
  ConfigRoute,
  RouteManifest,
} from '@remix-run/dev/dist/config/routes';
import { defineRoutes } from '@remix-run/dev/dist/config/routes';
import { defineConventionalRoutes } from '@remix-run/dev/dist/config/routesConvention';
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

export type RemixOptions = Pick<
  AppConfig,
  'appDirectory' | 'routes' | 'ignoredRouteFiles'
>;

type GetRouteOptions = RequireOnly<RemixOptions, 'appDirectory'>;

/**
 * See `readConfig` in @remix-run/dev/config.ts
 */
export async function getRoutes(options: GetRouteOptions) {
  const {
    appDirectory,
    ignoredRouteFiles,
    routes,
  } = options;

  const routeManifest: RouteManifest = {
    root: { path: '', id: 'root', file: '' },
  };

  const conventionalRoutes = defineConventionalRoutes(
    appDirectory,
    ignoredRouteFiles
  );

  for (const key of Object.keys(conventionalRoutes)) {
    const route = conventionalRoutes[key];
    routeManifest[route.id] = {
      ...route,
      parentId: route.parentId || 'root',
    };
  }

  if (routes) {
    const manualRoutes = await routes(defineRoutes);
    for (const key of Object.keys(manualRoutes)) {
      const route = manualRoutes[key];
      routeManifest[route.id] = {
        ...route,
        parentId: route.parentId || 'root',
      };
    }
  }

  const routeConfig = createRoutes(routeManifest)[0].children;

  return routeConfig;
}

/**
 * See `createClientRoutes` in @remix-run/react/routes.tsx
 */
export function createRoutes(
  routeManifest: RouteManifest,
  parentId?: string
): Route[] {
  return Object.keys(routeManifest)
    .filter(key => routeManifest[key].parentId === parentId)
    .map(key => {
      const route = createRoute(routeManifest[key]);
      route.children = createRoutes(routeManifest, route.id);
      return route;
    });
}

/**
 * See `createClientRoute` in @remix-run/react/routes.tsx
 */
export function createRoute(route: ConfigRoute): Route {
  return {
    id: route.id,
    file: route.file,
    path: route.path || '',
    index: !!route.index,
    children: [],
  };
}

export interface Route {
  // custom properties
  id: string;
  file: string;

  // react-router route properties
  path: string;
  index: boolean;
  children: Route[];
}

export type RequireOnly<Object, Keys extends keyof Object> = Omit<
  Object,
  Keys
> &
  Required<Pick<Object, Keys>>;

export interface Context {
  prefix: string;
}

interface Components {
  sync: string[];
  async: string[];
}

export function stringifyRoutes(routes: Route[], context: Context) {
  const components: Components = { sync: [], async: [] };
  const routesString = routesToString(routes, context, components);

  return {
    routesString,
    componentsString: [...components.sync, ...components.async].join('\n'),
  };
}

function routesToString(
  routes: Route[],
  context: Context,
  components: Components
) {
  return (
    '[' +
    routes.map(route => routeToString(route, context, components)).join(',') +
    ']'
  );
}

function routeToString(
  route: Route,
  context: Context,
  components: Components
): string {
  const componentName = getRouteComponentName(route);
  const componentPath = `${context.prefix}${path.sep}${route.file}`
    .split(path.sep)
    .join(path.posix.sep);

  const props = new Map<string, string>();

  if (route.path !== '') {
    props.set('path', `'${route.path}'`);
  }

  components.sync.push(
    `import * as ${componentName} from '${componentPath}';`
  );

  props.set(
    'element',
    `${componentName}.default ? createElement(${componentName}.default) : undefined`
  );
  props.set('loader', `${componentName}.loader`);
  props.set('action', `${componentName}.action`);
  props.set(
    'errorElement',
    `${componentName}.ErrorBoundary ? createElement(${componentName}.ErrorBoundary) : undefined`
  );
  props.set('handle', `${componentName}.handle`);
  props.set('shouldRevalidate', `${componentName}.shouldRevalidate`);

  if (route.index === true) {
    props.set('index', 'true');
  }

  if (route.children.length) {
    const children = routesToString(route.children, context, components);
    props.set('children', children);
  }

  return (
    '{' + [...props.entries()].map(([k, v]) => `${k}:${v}`).join(',') + '}'
  );
}

function getRouteComponentName(route: Route) {
  return route.id
    .split(/[/.]/)
    .map(str => str.replace(/^\w/, c => c.toUpperCase()))
    .join('');
}

export interface Options extends RemixOptions {}

function plugin(options: Options = {}): Plugin {
  const virtualModuleId = 'virtual:remix-routes';

  const {
    appDirectory = 'app',
    routes,
    ignoredRouteFiles,
  } = options;

  const dir = path.resolve(process.cwd(), appDirectory);
  const prefix = `.${path.sep}${path.relative(process.cwd(), dir)}`;

  if (
    !fs.existsSync(path.join(dir, 'routes')) ||
    !fs.statSync(path.join(dir, 'routes')).isDirectory()
  ) {
    throw new Error(
      `[vite-plugin-remix-routes] routes directory not found in appDirectory: ${path.relative(
        process.cwd(),
        appDirectory
      )}`
    );
  }

  return {
    name: 'vite-plugin-remix-routes',

    resolveId(id) {
      if (id === virtualModuleId) {
        return id;
      }
      return;
    },

    async load(id) {
      if (id === virtualModuleId) {
        const generatedRoutes = await getRoutes({
          appDirectory: dir,
          routes,
          ignoredRouteFiles,
        });

        const { routesString, componentsString } = stringifyRoutes(
          generatedRoutes,
          { prefix }
        );

        return (
          'import { createElement, lazy, useEffect } from \'react\';\n' +
          `${componentsString}\n` +
          `export default ${routesString};\n`
        );
      }

      return;
    },
  };
}

export default plugin;
