import React from 'react';
import Sidebar from './';
import { withKnobs } from '@storybook/addon-knobs';
import { withDesign } from 'storybook-addon-designs';

export default {
  title: 'Navigation | Sidebar',
  decorators: [withKnobs, withDesign],
};

const apiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'A Kong Admin API',
    version: '1.3',
    contact: {
      name: 'Kong',
    },
    license: {
      name: 'Apache 2.0',
    },
    description: 'This is the description for my specification',
  },
  servers: [
    {
      url: 'https://dev.kongonghq.com/v1',
      description: 'Development server',
    },
    {
      url: 'https://staging.konghq.com/v1',
      description: 'Staging server',
    },
    {
      url: 'https://api.konghq.com/v1',
      description: 'Production server',
    },
  ],
  tags: [
    {
      name: 'Tags',
      description: '',
    },
  ],
  paths: {
    '/tags': {
      get: {
        summary: 'List Tags',
        tags: ['Tags'],
        responses: {
          '200': {
            description: 'List of Tags in the system',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TagsResponse',
                },
                examples: {
                  'Response Body': {
                    value: {
                      data: [
                        {
                          entity_name: 'services',
                          entity_id: 'acf60b10-125c-4c1a-bffe-6ed55daefba4',
                          tag: 's1',
                        },
                        {
                          entity_name: 'services',
                          entity_id: 'acf60b10-125c-4c1a-bffe-6ed55daefba4',
                          tag: 's2',
                        },
                        {
                          entity_name: 'routes',
                          entity_id: '60631e85-ba6d-4c59-bd28-e36dd90f6000',
                          tag: 's1',
                        },
                      ],
                      offset: 'c47139f3-d780-483d-8a97-17e9adc5a7ab',
                      next: '/tags?offset=c47139f3-d780-483d-8a97-17e9adc5a7ab',
                    },
                  },
                },
              },
            },
          },
        },
        description: 'Returns a paginated list of all the tags in the system.',
        operationId: 'list-tags',
        parameters: [],
      },
    },
    '/tags/{tag}': {
      get: {
        summary: 'List Tags by Tag Name',
        tags: ['Tags'],
        responses: {
          '200': {
            description: 'List of entities tagged with the specified tag',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TagsResponse',
                },
                examples: {
                  'Response Body': {
                    value: {
                      data: [
                        {
                          entity_name: 'services',
                          entity_id: 'acf60b10-125c-4c1a-bffe-6ed55daefba4',
                          tag: 's1',
                        },
                        {
                          entity_name: 'routes',
                          entity_id: '60631e85-ba6d-4c59-bd28-e36dd90f6000',
                          tag: 's1',
                        },
                      ],
                      offset: 'c47139f3-d780-483d-8a97-17e9adc5a7ab',
                      next: '/tags?offset=c47139f3-d780-483d-8a97-17e9adc5a7ab',
                    },
                  },
                },
              },
            },
          },
        },
        description: 'Returns the entities that have been tagged with the specified tag.',
        operationId: 'list-tags-by-name',
        parameters: [
          {
            schema: {
              type: 'string',
              pattern: '^[A-Za-z-_\\.~]+',
            },
            name: 'tag',
            in: 'path',
            required: true,
            description: 'Tag Value',
          },
        ],
      },
    },
    '/services': {
      get: {
        summary: 'List Services',
        tags: ['Services'],
        responses: {
          '200': {
            description: 'Paginated list of service entities',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ServicesResponse',
                },
                examples: {
                  'Response Body': {
                    value: {
                      data: [
                        {
                          id: '4e3ad2e4-0bc4-4638-8e34-c84a417ba39b',
                          created_at: 1422386534,
                          updated_at: 1422386534,
                          name: 'my-service',
                          retries: 5,
                          protocol: 'http',
                          host: 'example.com',
                          port: 80,
                          path: '/some_api',
                          connect_timeout: 60000,
                          write_timeout: 60000,
                          read_timeout: 60000,
                          tags: ['user-level', 'low-priority'],
                        },
                        {
                          id: 'a5fb8d9b-a99d-40e9-9d35-72d42a62d83a',
                          created_at: 1422386534,
                          updated_at: 1422386534,
                          name: 'my-service',
                          retries: 5,
                          protocol: 'http',
                          host: 'example.com',
                          port: 80,
                          path: '/another_api',
                          connect_timeout: 60000,
                          write_timeout: 60000,
                          read_timeout: 60000,
                          tags: ['admin', 'high-priority', 'critical'],
                        },
                      ],
                      next:
                        'http://localhost:8001/services?offset=6378122c-a0a1-438d-a5c6-efabae9fb969',
                    },
                  },
                },
              },
            },
          },
        },
        parameters: [
          {
            schema: {
              type: 'string',
            },
            in: 'query',
            name: 'offset',
            description: 'Cursor used for pagination',
          },
          {
            schema: {
              type: 'number',
              maximum: 1000,
              minimum: 1,
              default: '100',
              exclusiveMaximum: false,
            },
            in: 'query',
            name: 'size',
            description: 'A limit on the number of objects to be returned per page.',
          },
          {
            schema: {
              type: 'string',
            },
            in: 'query',
            name: 'tags',
            description:
              'List of tags to filter by. Comma separated. Or clause denoted by slash (example/admin) example or admin. Maximum of 5 operations per request (, or /).',
          },
        ],
        description: 'Returns a list of services',
        operationId: 'list-services',
      },
      post: {
        summary: 'Create Service',
        responses: {
          '201': {
            description: 'Service created',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Service',
                },
                examples: {
                  'Response Body': {
                    value: {
                      id: '9748f662-7711-4a90-8186-dc02f10eb0f5',
                      created_at: 1422386534,
                      updated_at: 1422386534,
                      name: 'my-service',
                      retries: 5,
                      protocol: 'http',
                      host: 'example.com',
                      port: 80,
                      path: '/some_api',
                      connect_timeout: 60000,
                      write_timeout: 60000,
                      read_timeout: 60000,
                      tags: ['user-level', 'low-priority'],
                    },
                  },
                },
              },
            },
          },
        },
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ServiceRequest',
              },
              examples: {
                'Request Body': {
                  value: {
                    name: 'my-service',
                    url: 'http://example.com/some_api',
                    tags: ['user-level', 'low-priority'],
                  },
                },
              },
            },
          },
          description: 'RB Description',
        },
        description: 'Create new service entity',
        operationId: 'create-service',
        tags: ['Services'],
        parameters: [],
      },
    },
    '/services/{service_name_or_id}': {
      parameters: [
        {
          schema: {
            type: 'string',
          },
          name: 'service_name_or_id',
          in: 'path',
          required: true,
          description:
            'The unique identifier or the name of the Service to view, modify, or delete.',
        },
      ],
      get: {
        summary: 'View Service',
        tags: ['Services'],
        responses: {
          '200': {
            description: 'Return specified service details',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Service',
                },
                examples: {
                  'Response Body': {
                    value: {
                      id: '9748f662-7711-4a90-8186-dc02f10eb0f5',
                      created_at: 1422386534,
                      updated_at: 1422386534,
                      name: 'my-service',
                      retries: 5,
                      protocol: 'http',
                      host: 'example.com',
                      port: 80,
                      path: '/some_api',
                      connect_timeout: 60000,
                      write_timeout: 60000,
                      read_timeout: 60000,
                      tags: ['user-level', 'low-priority'],
                    },
                  },
                },
              },
            },
          },
        },
        operationId: 'view-service',
        description: 'Returns specified service details',
      },
      put: {
        summary: 'Create or Update Service',
        tags: ['Services'],
        responses: {
          '200': {
            description: 'Service Updated',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Service',
                },
                examples: {
                  'Response Body': {
                    value: {
                      id: '9748f662-7711-4a90-8186-dc02f10eb0f5',
                      created_at: 1422386534,
                      updated_at: 1422386534,
                      name: 'my-service',
                      retries: 5,
                      protocol: 'http',
                      host: 'example.com',
                      port: 80,
                      path: '/some_api',
                      connect_timeout: 60000,
                      write_timeout: 60000,
                      read_timeout: 60000,
                      tags: ['user-level', 'low-priority'],
                    },
                  },
                },
              },
            },
          },
          '201': {
            description: 'Service Created',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Service',
                },
                examples: {
                  'Response Body': {
                    value: {
                      id: '9748f662-7711-4a90-8186-dc02f10eb0f5',
                      created_at: 1422386534,
                      updated_at: 1422386534,
                      name: 'my-service',
                      retries: 5,
                      protocol: 'http',
                      host: 'example.com',
                      port: 80,
                      path: '/some_api',
                      connect_timeout: 60000,
                      write_timeout: 60000,
                      read_timeout: 60000,
                      tags: ['user-level', 'low-priority'],
                    },
                  },
                },
              },
            },
          },
        },
        description: 'Create or Update Service',
        operationId: 'create-or-update-service',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ServiceRequest',
              },
              examples: {
                'Request Body': {
                  value: {
                    name: 'my-service',
                    url: 'http://example.com/some_api',
                    tags: ['user-level', 'low-priority'],
                  },
                },
              },
            },
          },
        },
      },
      delete: {
        summary: 'Delete Service',
        tags: ['Services'],
        responses: {
          '204': {
            description: 'No Content',
          },
        },
        description: '',
        operationId: 'delete-service',
      },
    },
    '/services/{service_name_or_id}/routes': {
      parameters: [
        {
          schema: {
            type: 'string',
          },
          name: 'service_name_or_id',
          in: 'path',
          required: true,
          description:
            'The unique identifier or the name of the Service to view, modify, or delete.',
        },
      ],
      get: {
        summary: 'List Routes for specified Service Name / Id',
        tags: ['Service Routes'],
        responses: {
          '200': {
            description: 'Paginated list of route entities for specified service',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RoutesResponse',
                },
                examples: {
                  'Response Body': {
                    value: {
                      data: [
                        {
                          id: '4506673d-c825-444c-a25b-602e3c2ec16e',
                          created_at: 1422386534,
                          updated_at: 1422386534,
                          name: 'my-route',
                          protocols: ['http', 'https'],
                          methods: ['GET', 'POST'],
                          hosts: ['example.com', 'foo.test'],
                          paths: ['/foo', '/bar'],
                          https_redirect_status_code: 426,
                          regex_priority: 0,
                          strip_path: true,
                          preserve_host: false,
                          tags: ['user-level', 'low-priority'],
                          service: {
                            id: 'd35165e2-d03e-461a-bdeb-dad0a112abfe',
                          },
                        },
                        {
                          id: 'af8330d3-dbdc-48bd-b1be-55b98608834b',
                          created_at: 1422386534,
                          updated_at: 1422386534,
                          name: 'my-route',
                          protocols: ['tcp', 'tls'],
                          https_redirect_status_code: 426,
                          regex_priority: 0,
                          strip_path: true,
                          preserve_host: false,
                          snis: ['foo.test', 'example.com'],
                          sources: [
                            {
                              ip: '10.1.0.0/16',
                              port: 1234,
                            },
                            {
                              ip: '10.2.2.2',
                            },
                            {
                              port: 9123,
                            },
                          ],
                          destinations: [
                            {
                              ip: '10.1.0.0/16',
                              port: 1234,
                            },
                            {
                              ip: '10.2.2.2',
                            },
                            {
                              port: 9123,
                            },
                          ],
                          tags: ['admin', 'high-priority', 'critical'],
                          service: {
                            id: 'a9daa3ba-8186-4a0d-96e8-00d80ce7240b',
                          },
                        },
                      ],
                      next:
                        'http://localhost:8001/routes?offset=6378122c-a0a1-438d-a5c6-efabae9fb969',
                    },
                  },
                },
              },
            },
          },
        },
        description: 'Returns a paginated list of routes for specified service id',
        operationId: 'list-routes-by-service-name-or-id',
        parameters: [
          {
            schema: {
              type: 'string',
            },
            in: 'query',
            name: 'offset',
            description: 'Cursor used for pagination',
          },
          {
            schema: {
              type: 'number',
              maximum: 1000,
              minimum: 1,
              default: '100',
              exclusiveMaximum: false,
            },
            in: 'query',
            name: 'size',
            description: 'A limit on the number of objects to be returned per page.',
          },
          {
            schema: {
              type: 'string',
            },
            in: 'query',
            name: 'tags',
            description:
              'List of tags to filter by. Comma separated. Or clause denoted by slash (example/admin) example or admin. Maximum of 5 operations per request (, or /).',
          },
        ],
      },
      post: {
        summary: 'Create Route associated to specific Service',
        responses: {
          '201': {
            description: 'Route created',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Route',
                },
                examples: {
                  'Response Body': {
                    value: {
                      id: '4506673d-c825-444c-a25b-602e3c2ec16e',
                      created_at: 1422386534,
                      updated_at: 1422386534,
                      name: 'my-route',
                      protocols: ['http', 'https'],
                      methods: ['GET', 'POST'],
                      hosts: ['example.com', 'foo.test'],
                      paths: ['/foo', '/bar'],
                      https_redirect_status_code: 426,
                      regex_priority: 0,
                      strip_path: true,
                      preserve_host: false,
                      tags: ['user-level', 'low-priority'],
                      service: {
                        id: 'd35165e2-d03e-461a-bdeb-dad0a112abfe',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RouteRequest',
              },
              examples: {
                'Request Body': {
                  value: {
                    name: 'my-route',
                    methods: ['GET', 'POST'],
                    hosts: ['example.com', 'foo.test'],
                    paths: ['/foo', '/bar'],
                    tags: ['user-level', 'low-priority'],
                  },
                },
              },
            },
          },
          description: '',
        },
        description: 'Create new route entity',
        operationId: 'create-route-by-service',
        tags: ['Service Routes'],
        parameters: [],
      },
    },
    '/services/{service_name_or_id}/routes/{route_name_or_id}': {
      parameters: [
        {
          schema: {
            type: 'string',
          },
          name: 'service_name_or_id',
          in: 'path',
          required: true,
          description:
            'The unique identifier or the name of the Service associated to the specified route.',
        },
        {
          schema: {
            type: 'string',
          },
          name: 'route_name_or_id',
          in: 'path',
          required: true,
          description: 'The unique identifier or the name of the Route to view, modify, or delete.',
        },
      ],
      get: {
        summary: 'View Route associated with specified Service',
        tags: ['Service Route'],
        responses: {
          '200': {
            description: 'Return specified route details',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Route',
                },
                examples: {
                  'Response Body': {
                    value: {
                      id: '4506673d-c825-444c-a25b-602e3c2ec16e',
                      created_at: 1422386534,
                      updated_at: 1422386534,
                      name: 'my-route',
                      protocols: ['http', 'https'],
                      methods: ['GET', 'POST'],
                      hosts: ['example.com', 'foo.test'],
                      paths: ['/foo', '/bar'],
                      https_redirect_status_code: 426,
                      regex_priority: 0,
                      strip_path: true,
                      preserve_host: false,
                      tags: ['user-level', 'low-priority'],
                      service: {
                        id: 'd35165e2-d03e-461a-bdeb-dad0a112abfe',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        operationId: 'view-route-by-service',
        description: 'Returns specified route details',
      },
      put: {
        summary: 'Create or Update Route by Service',
        tags: ['Service Route'],
        responses: {
          '200': {
            description: 'Route Updated',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Route',
                },
                examples: {
                  'Response Body': {
                    value: {
                      id: '4506673d-c825-444c-a25b-602e3c2ec16e',
                      created_at: 1422386534,
                      updated_at: 1422386534,
                      name: 'my-route',
                      protocols: ['http', 'https'],
                      methods: ['GET', 'POST'],
                      hosts: ['example.com', 'foo.test'],
                      paths: ['/foo', '/bar'],
                      https_redirect_status_code: 426,
                      regex_priority: 0,
                      strip_path: true,
                      preserve_host: false,
                      tags: ['user-level', 'low-priority'],
                      service: {
                        id: 'd35165e2-d03e-461a-bdeb-dad0a112abfe',
                      },
                    },
                  },
                },
              },
            },
          },
          '201': {
            description: 'Route Created',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Route',
                },
                examples: {
                  'Response Body': {
                    value: {
                      id: '4506673d-c825-444c-a25b-602e3c2ec16e',
                      created_at: 1422386534,
                      updated_at: 1422386534,
                      name: 'my-route',
                      protocols: ['http', 'https'],
                      methods: ['GET', 'POST'],
                      hosts: ['example.com', 'foo.test'],
                      paths: ['/foo', '/bar'],
                      https_redirect_status_code: 426,
                      regex_priority: 0,
                      strip_path: true,
                      preserve_host: false,
                      tags: ['user-level', 'low-priority'],
                      service: {
                        id: 'd35165e2-d03e-461a-bdeb-dad0a112abfe',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        description: 'Create or Update Route by Service',
        operationId: 'create-or-update-route-by-service',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RouteRequest',
              },
              examples: {
                'Request Body': {
                  value: {
                    name: 'my-route',
                    protocols: ['http', 'https'],
                    methods: ['GET', 'POST'],
                    hosts: ['example.com', 'foo.test'],
                    paths: ['/foo', '/bar'],
                    https_redirect_status_code: 426,
                    regex_priority: 0,
                    strip_path: true,
                    preserve_host: false,
                    tags: ['user-level', 'low-priority'],
                    service: {
                      id: 'd35165e2-d03e-461a-bdeb-dad0a112abfe',
                    },
                  },
                },
              },
            },
          },
        },
      },
      delete: {
        summary: 'Delete Route associated to specified Service',
        tags: ['Service Route'],
        responses: {
          '204': {
            description: 'No Content',
          },
        },
        description: '',
        operationId: 'delete-route-by-service',
      },
    },
  },
  components: {
    requestBodies: {
      PetBody: {
        description: 'A JSON object containing pet information',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Pet',
            },
            examples: {
              dog: {
                value: {
                  name: 'my-service',
                  url: 'http://example.com/some_api',
                  tags: ['user-level', 'low-priority'],
                },
              },
              cat: {
                value: {
                  name: 'my-service',
                  url: 'http://example.com/some_api',
                  tags: ['user-level', 'low-priority'],
                },
              },
            },
          },
          'application/xml': {
            schema: {
              $ref: '#/components/schemas/Pet',
            },
            examples: {
              dog: {
                value: {
                  name: 'my-service',
                  url: 'http://example.com/some_api',
                  tags: ['user-level', 'low-priority'],
                },
              },
              cat: {
                value: {
                  name: 'my-service',
                  url: 'http://example.com/some_api',
                  tags: ['user-level', 'low-priority'],
                },
              },
            },
          },
          'text/plain': {
            schema: {
              $ref: '#/components/schemas/Pet',
            },
            examples: {
              dog: {
                value: {
                  name: 'my-service',
                  url: 'http://example.com/some_api',
                  tags: ['user-level', 'low-priority'],
                },
              },
              cat: {
                value: {
                  name: 'my-service',
                  url: 'http://example.com/some_api',
                  tags: ['user-level', 'low-priority'],
                },
              },
            },
          },
        },
      },
      StoreBody: {
        description: 'A JSON object containing store information',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Pet',
            },
            examples: {
              dog: {
                value: {
                  name: 'my-service',
                  url: 'http://example.com/some_api',
                  tags: ['user-level', 'low-priority'],
                },
              },
              cat: {
                value: {
                  name: 'my-service',
                  url: 'http://example.com/some_api',
                  tags: ['user-level', 'low-priority'],
                },
              },
            },
          },
          'application/xml': {
            schema: {
              $ref: '#/components/schemas/Pet',
            },
            examples: {
              dog: {
                value: {
                  name: 'my-service',
                  url: 'http://example.com/some_api',
                  tags: ['user-level', 'low-priority'],
                },
              },
              cat: {
                value: {
                  name: 'my-service',
                  url: 'http://example.com/some_api',
                  tags: ['user-level', 'low-priority'],
                },
              },
            },
          },
          'text/plain': {
            schema: {
              $ref: '#/components/schemas/Pet',
            },
            examples: {
              dog: {
                value: {
                  name: 'my-service',
                  url: 'http://example.com/some_api',
                  tags: ['user-level', 'low-priority'],
                },
              },
              cat: {
                value: {
                  name: 'my-service',
                  url: 'http://example.com/some_api',
                  tags: ['user-level', 'low-priority'],
                },
              },
            },
          },
        },
      },
    },
    schemas: {
      Service: {
        title: 'Service Entity',
        type: 'object',
        'x-examples': {
          Entity: {
            id: '9748f662-7711-4a90-8186-dc02f10eb0f5',
            created_at: 1422386534,
            updated_at: 1422386534,
            name: 'my-service',
            retries: 5,
            protocol: 'http',
            host: 'example.com',
            port: 80,
            path: '/some_api',
            connect_timeout: 60000,
            write_timeout: 60000,
            read_timeout: 60000,
            tags: ['user-level', 'low-priority'],
          },
        },
        description:
          'Service entities, as the name implies, are abstractions of each of your own upstream services.',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          created_at: {
            type: 'number',
          },
          updated_at: {
            type: 'number',
          },
          name: {
            type: 'string',
            description: 'Service Name (a-z-_)',
            example: 'my-service',
            pattern: '^[a-z-_]+',
          },
          retries: {
            type: 'number',
            description: 'The number of retries to execute upon failure to proxy.',
          },
          protocol: {
            type: 'string',
            description: 'The protocol used to communicate with the upstream.',
            enum: ['http', 'https', 'grpc', 'grpcs', 'tcp', 'tls'],
          },
          host: {
            type: 'string',
            description: 'The host of the upstream server.',
          },
          port: {
            type: 'number',
            description: 'The port of the upstream server.',
          },
          path: {
            type: 'string',
            example: '/some_api',
            pattern: '^\\/(.*)+',
            description: 'The path to be used in requests to the upstream server.',
          },
          connect_timeout: {
            type: 'number',
            example: '60000',
            description:
              'The timeout in milliseconds for establishing a connection to the upstream server.',
          },
          write_timeout: {
            type: 'number',
            example: '60000',
            description:
              'The timeout in milliseconds between two successive write operations for transmitting a request to the upstream server.',
          },
          read_timeout: {
            type: 'number',
            example: '60000',
            description:
              'The timeout in milliseconds between two successive read operations for transmitting a request to the upstream server.',
          },
          client_certificate: {
            type: 'object',
            description:
              'Certificate to be used as client certificate while TLS handshaking to the upstream server.',
            properties: {
              id: {
                type: 'string',
              },
            },
          },
          tags: {
            $ref: '#/components/schemas/Tags',
          },
        },
      },
      ServiceRequest: {
        title: 'Service Request Body',
        type: 'object',
        'x-examples': {
          'Request Body': {
            name: 'my-service',
            url: 'http://example.com/some_api',
            tags: ['user-level', 'low-priority'],
          },
        },
        description:
          'Service entities, as the name implies, are abstractions of each of your own upstream services.',
        properties: {
          name: {
            type: 'string',
            description: 'Service Name (a-z-_)',
            example: 'my-service',
            pattern: '^[a-z-_]+',
          },
          retries: {
            type: 'number',
            description: 'The number of retries to execute upon failure to proxy.',
          },
          connect_timeout: {
            type: 'number',
            example: '60000',
            description:
              'The timeout in milliseconds for establishing a connection to the upstream server.',
          },
          write_timeout: {
            type: 'number',
            example: '60000',
            description:
              'The timeout in milliseconds between two successive write operations for transmitting a request to the upstream server.',
          },
          read_timeout: {
            type: 'number',
            example: '60000',
            description:
              'The timeout in milliseconds between two successive read operations for transmitting a request to the upstream server.',
          },
          tags: {
            $ref: '#/components/schemas/Tags',
          },
          client_certificate: {
            type: 'object',
            description:
              'Certificate to be used as client certificate while TLS handshaking to the upstream server.',
            properties: {
              id: {
                type: 'string',
              },
            },
          },
          url: {
            type: 'string',
            description: 'Shorthand attribute to set protocol, host, port and path at once.',
            example: 'http://example.com/some_api',
          },
        },
        required: ['url'],
      },
      TagsResponse: {
        title: 'Tags Response',
        type: 'object',
        'x-examples': {
          'Response Body': {
            data: [
              {
                entity_name: 'services',
                entity_id: 'acf60b10-125c-4c1a-bffe-6ed55daefba4',
                tag: 's1',
              },
              {
                entity_name: 'services',
                entity_id: 'acf60b10-125c-4c1a-bffe-6ed55daefba4',
                tag: 's2',
              },
              {
                entity_name: 'routes',
                entity_id: '60631e85-ba6d-4c59-bd28-e36dd90f6000',
                tag: 's1',
              },
            ],
            offset: 'c47139f3-d780-483d-8a97-17e9adc5a7ab',
            next: '/tags?offset=c47139f3-d780-483d-8a97-17e9adc5a7ab',
          },
        },
        properties: {
          data: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/TagEntity',
            },
          },
          offset: {
            type: 'string',
          },
          next: {
            type: 'string',
          },
        },
      },
      TagEntity: {
        title: 'Tag Entity',
        type: 'object',
        'x-examples': {
          TAG: {
            entity_name: 'services',
            entity_id: 'acf60b10-125c-4c1a-bffe-6ed55daefba4',
            tag: 's1',
          },
        },
        description: 'Tag Entity',
        properties: {
          entity_name: {
            type: 'string',
          },
          entity_id: {
            type: 'string',
          },
          tag: {
            $ref: '#/components/schemas/Tag',
          },
        },
      },
      Route: {
        title: 'Route Entity',
        type: 'object',
        'x-examples': {
          HOSTS: {
            id: '4506673d-c825-444c-a25b-602e3c2ec16e',
            created_at: 1422386534,
            updated_at: 1422386534,
            name: 'my-route',
            protocols: ['http', 'https'],
            methods: ['GET', 'POST'],
            hosts: ['example.com', 'foo.test'],
            paths: ['/foo', '/bar'],
            https_redirect_status_code: 426,
            regex_priority: 0,
            strip_path: true,
            preserve_host: false,
            tags: ['user-level', 'low-priority'],
            service: {
              id: 'd35165e2-d03e-461a-bdeb-dad0a112abfe',
            },
          },
          SNIS: {
            id: 'af8330d3-dbdc-48bd-b1be-55b98608834b',
            created_at: 1422386534,
            updated_at: 1422386534,
            name: 'my-route',
            protocols: ['tcp', 'tls'],
            https_redirect_status_code: 426,
            regex_priority: 0,
            strip_path: true,
            preserve_host: false,
            snis: ['foo.test', 'example.com'],
            sources: [
              {
                ip: '10.1.0.0/16',
                port: 1234,
              },
              {
                ip: '10.2.2.2',
              },
              {
                port: 9123,
              },
            ],
            destinations: [
              {
                ip: '10.1.0.0/16',
                port: 1234,
              },
              {
                ip: '10.2.2.2',
              },
              {
                port: 9123,
              },
            ],
            tags: ['admin', 'high-priority', 'critical'],
            service: {
              id: 'a9daa3ba-8186-4a0d-96e8-00d80ce7240b',
            },
          },
        },
        description: 'Route entities define rules to match client requests.',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: '51e77dc2-8f3e-4afa-9d0e-0e3bbbcfd515',
          },
          service: {
            type: 'object',
            description: 'The Service this Route is associated to.',
            properties: {
              id: {
                type: 'string',
              },
            },
          },
          tags: {
            $ref: '#/components/schemas/Tags',
          },
          preserve_host: {
            type: 'boolean',
            example: false,
            description:
              'When matching a Route via one of the hosts domain names, use the request Host header in the upstream request headers.',
          },
          strip_path: {
            type: 'boolean',
            default: true,
            description:
              'When matching a Route via one of the paths, strip the matching prefix from the upstream request URL. ',
            example: true,
          },
          regex_priority: {
            type: 'integer',
            default: 0,
            description:
              'A number used to choose which route resolves a given request when several routes match it using regexes simultaneously. When two routes match the path and have the same regex_priority, the older one (lowest created_at) is used.',
            example: 0,
          },
          https_redirect_status_code: {
            type: 'integer',
            default: 426,
            description:
              'The status code Kong responds with when all properties of a Route match except the protocol',
            example: 426,
          },
          paths: {
            type: 'array',
            description: 'A list of paths that match this Route.',
            items: {
              type: 'string',
            },
          },
          hosts: {
            type: 'array',
            description: 'A list of domain names that match this Route.',
            items: {
              type: 'string',
            },
          },
          methods: {
            type: 'array',
            description: 'A list of HTTP methods that match this Route.',
            items: {
              type: 'string',
            },
          },
          protocols: {
            type: 'array',
            default: ['http', 'https'],
            description: 'A list of the protocols this Route should allow.',
            enum: ['http', 'https'],
            items: {
              type: 'string',
            },
          },
          name: {
            type: 'string',
            pattern: '^[a-z-_]+',
            example: 'my-route',
            description: 'The name of the Route.',
          },
          updated_at: {
            type: 'integer',
            example: 1422386534,
          },
          created_at: {
            type: 'integer',
            example: 1422386534,
          },
          snis: {
            description:
              'A list of SNIs that match this Route when using stream routing. When using tcp or tls protocols, at least one of snis, sources, or destinations must be set.',
            type: 'array',
            items: {
              type: 'string',
            },
          },
          sources: {
            description:
              'A list of IP sources of incoming connections that match this Route when using stream routing. Each entry is an object with fields “ip” (optionally in CIDR range notation) and/or “port”. When using tcp or tls protocols, at least one of snis, sources, or destinations must be set.',
            type: 'array',
            items: {
              type: 'string',
            },
          },
          destinations: {
            type: 'array',
            description:
              'A list of IP destinations of incoming connections that match this Route when using stream routing. Each entry is an object with fields “ip” (optionally in CIDR range notation) and/or “port”. When using tcp or tls protocols, at least one of snis, sources, or destinations must be set.',
            items: {
              type: 'string',
            },
          },
        },
      },
      Certificate: {
        title: 'Certificate Entity',
        type: 'object',
        'x-examples': {
          Entity: {
            id: 'ce44eef5-41ed-47f6-baab-f725cecf98c7',
            created_at: 1422386534,
            cert: '-----BEGIN CERTIFICATE-----...',
            key: '-----BEGIN RSA PRIVATE KEY-----...',
            tags: ['user-level', 'low-priority'],
          },
        },
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          created_at: {
            type: 'number',
          },
          cert: {
            type: 'string',
            description: 'PEM-encoded public certificate of the SSL key pair.',
          },
          key: {
            type: 'string',
            description: 'PEM-encoded private key of the SSL key pair.',
          },
          tags: {
            $ref: '#/components/schemas/Tags',
          },
        },
        description:
          'A certificate object represents a public certificate, and can be optionally paired with the corresponding private key. These objects are used by Kong to handle SSL/TLS termination for encrypted requests, or for use as a trusted CA store when validating peer certificate of client/service. Certificates are optionally associated with SNI objects to tie a cert/key pair to one or more hostnames.',
      },
      UpstreamTarget: {
        title: 'Upstream Target Entity',
        type: 'object',
        'x-examples': {
          Entity: {
            id: 'a3395f66-2af6-4c79-bea2-1b6933764f80',
            created_at: 1422386534,
            upstream: {
              id: '885a0392-ef1b-4de3-aacf-af3f1697ce2c',
            },
            target: 'example.com:8000',
            weight: 100,
            tags: ['user-level', 'low-priority'],
          },
        },
        properties: {
          id: {
            type: 'string',
          },
          created_at: {
            type: 'number',
          },
          upstream: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
              },
            },
          },
          target: {
            type: 'string',
            description:
              'The target address (ip or hostname) and port. If the hostname resolves to an SRV record, the port value will be overridden by the value from the DNS record.',
          },
          weight: {
            type: 'integer',
            default: 100,
            description:
              'The weight this target gets within the upstream loadbalancer (`0`-`1000`). If the hostname resolves to an SRV record, the weight value will be overridden by the value from the DNS record.',
          },
          tags: {
            $ref: '#/components/schemas/Tags',
          },
        },
        description:
          'A target is an ip address/hostname with a port that identifies an instance of a backend service. Every upstream can have many targets, and the targets can be dynamically added. Changes are effectuated on the fly.\n\nBecause the upstream maintains a history of target changes, the targets cannot be deleted or modified. To disable a target, post a new one with `weight=0;` alternatively, use the `DELETE` convenience method to accomplish the same.\n\nThe current target object definition is the one with the latest `created_at`.',
      },
      UpstreamRequest: {
        title: 'Upstream Request',
        type: 'object',
        properties: {
          host_header: {
            type: 'string',
            description:
              'The hostname to be used as Host header when proxying requests through Kong.',
          },
          algorithm: {
            type: 'string',
            default: 'round-robin',
            description: 'Which load balancing algorithm to use.',
            enum: ['round-robin', 'consistent-hashing', 'least-connections'],
          },
          tags: {
            $ref: '#/components/schemas/Tags',
          },
          healthchecks: {
            $ref: '#/components/schemas/Healthcheck',
          },
          slots: {
            type: 'number',
            default: 10000,
            description: 'The number of slots in the loadbalancer algorithm (10-65536).',
          },
          hash_on_cookie: {
            type: 'string',
            description:
              'The cookie name to take the value from as hash input. Only required when hash_on or hash_fallback is set to cookie. If the specified cookie is not in the request, Kong will generate a value and set the cookie in the response.',
          },
          hash_on_cookie_path: {
            type: 'string',
            default: '/',
            description:
              'The cookie path to set in the response headers. Only required when hash_on or hash_fallback is set to cookie.',
          },
          hash_fallback_header: {
            type: 'string',
            description:
              'The header name to take the value from as hash input. Only required when hash_fallback is set to header.',
          },
          hash_fallback: {
            type: 'string',
            default: 'none',
            description:
              'What to use as hashing input if the primary hash_on does not return a hash (eg. header is missing, or no consumer identified). One of: none, consumer, ip, header, or cookie. Not available if hash_on is set to cookie.',
            enum: ['none', 'consumer', 'ip', 'header', 'cookie'],
          },
          hash_on_header: {
            type: 'string',
            description:
              'The header name to take the value from as hash input. Only required when hash_on is set to header.',
          },
          hash_on: {
            type: 'string',
            default: 'none',
            description:
              'What to use as hashing input: none (resulting in a weighted-round-robin scheme with no hashing), consumer, ip, header, or cookie.',
            enum: ['none', 'consumer', 'ip', 'header', 'cookie'],
          },
          name: {
            type: 'string',
          },
        },
        required: ['name'],
        'x-examples': {
          Entity: {
            name: 'my-upstream',
            tags: ['user-level', 'low-priority'],
          },
        },
        description: '',
      },
      SNIRequest: {
        title: 'SNI Request',
        type: 'object',
        properties: {
          tags: {
            $ref: '#/components/schemas/Tags',
          },
          certificate: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
                description:
                  'The id (a UUID) of the certificate with which to associate the SNI hostname.',
              },
              name: {
                type: 'string',
              },
            },
          },
          name: {
            type: 'string',
            description:
              'The SNI name to associate with the given certificate. May contain a single wildcard in the leftmost (suffix) or rightmost (prefix) position. This can be helpful when maintaining multiple subdomains, as a single SNI configured with a wildcard name can be used to match multiple subdomains, instead of creating an SNI entity for each. Valid wildcard positions are mydomain.*, *.mydomain.com, and *.www.mydomain.com. Plain SNI names (no wildcard) take priority when matching, followed by prefix and then suffix.',
          },
        },
        'x-examples': {
          Request: {
            name: 'my-sni',
            certificate: {
              id: 'a2e013e8-7623-4494-a347-6d29108ff68b',
            },
            tags: ['user-level', 'low-priority'],
          },
        },
        description: 'Create / Update SNI',
      },
      UpstreamsResponse: {
        title: 'UpstreamsResponse',
        type: 'object',
        description: 'Paginated list of Upstream entities',
        properties: {
          data: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Upstream',
            },
          },
          offset: {
            type: 'string',
          },
          next: {
            type: 'string',
          },
        },
        'x-examples': {
          'Response Body': {
            data: [
              {
                id: 'a2e013e8-7623-4494-a347-6d29108ff68b',
                created_at: 1422386534,
                name: 'my-upstream',
                hash_on: 'none',
                hash_fallback: 'none',
                hash_on_cookie_path: '/',
                slots: 10000,
                healthchecks: {
                  active: {
                    https_verify_certificate: true,
                    unhealthy: {
                      http_statuses: [429, 404, 500, 501, 502, 503, 504, 505],
                      tcp_failures: 0,
                      timeouts: 0,
                      http_failures: 0,
                      interval: 0,
                    },
                    http_path: '/',
                    timeout: 1,
                    healthy: {
                      http_statuses: [200, 302],
                      interval: 0,
                      successes: 0,
                    },
                    https_sni: 'example.com',
                    concurrency: 10,
                    type: 'http',
                  },
                  passive: {
                    unhealthy: {
                      http_failures: 0,
                      http_statuses: [429, 500, 503],
                      tcp_failures: 0,
                      timeouts: 0,
                    },
                    type: 'http',
                    healthy: {
                      successes: 0,
                      http_statuses: [
                        200,
                        201,
                        202,
                        203,
                        204,
                        205,
                        206,
                        207,
                        208,
                        226,
                        300,
                        301,
                        302,
                        303,
                        304,
                        305,
                        306,
                        307,
                        308,
                      ],
                    },
                  },
                },
                tags: ['user-level', 'low-priority'],
              },
              {
                id: '147f5ef0-1ed6-4711-b77f-489262f8bff7',
                created_at: 1422386534,
                name: 'my-upstream',
                hash_on: 'none',
                hash_fallback: 'none',
                hash_on_cookie_path: '/',
                slots: 10000,
                healthchecks: {
                  active: {
                    https_verify_certificate: true,
                    unhealthy: {
                      http_statuses: [429, 404, 500, 501, 502, 503, 504, 505],
                      tcp_failures: 0,
                      timeouts: 0,
                      http_failures: 0,
                      interval: 0,
                    },
                    http_path: '/',
                    timeout: 1,
                    healthy: {
                      http_statuses: [200, 302],
                      interval: 0,
                      successes: 0,
                    },
                    https_sni: 'example.com',
                    concurrency: 10,
                    type: 'http',
                  },
                  passive: {
                    unhealthy: {
                      http_failures: 0,
                      http_statuses: [429, 500, 503],
                      tcp_failures: 0,
                      timeouts: 0,
                    },
                    type: 'http',
                    healthy: {
                      successes: 0,
                      http_statuses: [
                        200,
                        201,
                        202,
                        203,
                        204,
                        205,
                        206,
                        207,
                        208,
                        226,
                        300,
                        301,
                        302,
                        303,
                        304,
                        305,
                        306,
                        307,
                        308,
                      ],
                    },
                  },
                },
                tags: ['admin', 'high-priority', 'critical'],
              },
            ],
            next: 'http://localhost:8001/upstreams?offset=6378122c-a0a1-438d-a5c6-efabae9fb969',
          },
        },
      },
      Upstream: {
        title: 'Upstream Entity',
        type: 'object',
        'x-examples': {
          Entity: {
            id: '91020192-062d-416f-a275-9addeeaffaf2',
            created_at: 1422386534,
            name: 'my-upstream',
            algorithm: 'round-robin',
            hash_on: 'none',
            hash_fallback: 'none',
            hash_on_cookie_path: '/',
            slots: 10000,
            healthchecks: {
              active: {
                https_verify_certificate: true,
                unhealthy: {
                  http_statuses: [429, 404, 500, 501, 502, 503, 504, 505],
                  tcp_failures: 0,
                  timeouts: 0,
                  http_failures: 0,
                  interval: 0,
                },
                http_path: '/',
                timeout: 1,
                healthy: {
                  http_statuses: [200, 302],
                  interval: 0,
                  successes: 0,
                },
                https_sni: 'example.com',
                concurrency: 10,
                type: 'http',
              },
              passive: {
                unhealthy: {
                  http_failures: 0,
                  http_statuses: [429, 500, 503],
                  tcp_failures: 0,
                  timeouts: 0,
                },
                type: 'http',
                healthy: {
                  successes: 0,
                  http_statuses: [
                    200,
                    201,
                    202,
                    203,
                    204,
                    205,
                    206,
                    207,
                    208,
                    226,
                    300,
                    301,
                    302,
                    303,
                    304,
                    305,
                    306,
                    307,
                    308,
                  ],
                },
              },
            },
            host_header: 'example.com',
            tags: ['user-level', 'low-priority'],
          },
        },
        description:
          'The upstream object represents a virtual hostname and can be used to loadbalance incoming requests over multiple services (targets). So for example an upstream named `service.v1.xyz` for a Service object whose host is `service.v1.xyz`. Requests for this Service would be proxied to the targets defined within the upstream.',
        properties: {
          id: {
            type: 'string',
            description: 'This is a hostname, which must be equal to the host of a Service.',
            format: 'uuid',
          },
          created_at: {
            type: 'number',
          },
          name: {
            type: 'string',
          },
          hash_on: {
            type: 'string',
            default: 'none',
            description:
              'What to use as hashing input: none (resulting in a weighted-round-robin scheme with no hashing), consumer, ip, header, or cookie.',
            enum: ['none', 'consumer', 'ip', 'header', 'cookie'],
          },
          hash_on_header: {
            type: 'string',
            description:
              'The header name to take the value from as hash input. Only required when hash_on is set to header.',
          },
          hash_fallback: {
            type: 'string',
            default: 'none',
            description:
              'What to use as hashing input if the primary hash_on does not return a hash (eg. header is missing, or no consumer identified). One of: none, consumer, ip, header, or cookie. Not available if hash_on is set to cookie.',
            enum: ['none', 'consumer', 'ip', 'header', 'cookie'],
          },
          hash_fallback_header: {
            type: 'string',
            description:
              'The header name to take the value from as hash input. Only required when hash_fallback is set to header.',
          },
          hash_on_cookie_path: {
            type: 'string',
            default: '/',
            description:
              'The cookie path to set in the response headers. Only required when hash_on or hash_fallback is set to cookie.',
          },
          hash_on_cookie: {
            type: 'string',
            description:
              'The cookie name to take the value from as hash input. Only required when hash_on or hash_fallback is set to cookie. If the specified cookie is not in the request, Kong will generate a value and set the cookie in the response.',
          },
          slots: {
            type: 'number',
            default: 10000,
            description: 'The number of slots in the loadbalancer algorithm (10-65536).',
          },
          healthchecks: {
            $ref: '#/components/schemas/Healthcheck',
          },
          tags: {
            $ref: '#/components/schemas/Tags',
          },
          algorithm: {
            type: 'string',
            default: 'round-robin',
            description: 'Which load balancing algorithm to use.',
            enum: ['round-robin', 'consistent-hashing', 'least-connections'],
          },
          host_header: {
            type: 'string',
            description:
              'The hostname to be used as Host header when proxying requests through Kong.',
          },
        },
        required: ['name'],
      },
      HealthcheckHealthy: {
        title: 'HealthcheckHealthy',
        type: 'object',
        properties: {
          http_statuses: {
            type: 'array',
            default: [200, 302],
            description:
              'An array of HTTP statuses to consider a success, indicating healthiness, when returned by a probe in active health checks.',
            items: {
              type: 'number',
            },
          },
          interval: {
            type: 'number',
            description:
              'Interval between active health checks for healthy targets (in seconds). A value of zero indicates that active probes for healthy targets should not be performed.',
          },
          successes: {
            type: 'number',
            description: 'Number of successes to consider a target healthy.',
          },
        },
      },
      HealthcheckUnhealthy: {
        title: 'HealthcheckUnhealthy',
        type: 'object',
        properties: {
          tcp_failures: {
            type: 'number',
            default: 0,
            description: 'Number of TCP failures in active probes to consider a target unhealthy.',
          },
          http_failures: {
            type: 'number',
            default: 0,
            description: 'Number of HTTP failures in to consider a target unhealthy.',
          },
          timeouts: {
            type: 'number',
            default: 0,
            description: 'Number of timeouts in active probes to consider a target unhealthy.',
          },
          http_statuses: {
            type: 'array',
            default: [429, 404, 500, 501, 502, 503, 504, 505],
            description:
              'An array of HTTP statuses to consider a failure, indicating unhealthiness.',
            items: {
              type: 'number',
            },
          },
          interval: {
            type: 'number',
            default: 0,
            description:
              'Interval between active health checks for unhealthy targets (in seconds). A value of zero indicates that active probes for unhealthy targets should not be performed.',
          },
        },
      },
      Healthcheck: {
        title: 'Healthcheck',
        type: 'object',
        properties: {
          active: {
            type: 'object',
            properties: {
              https_verify_certificate: {
                type: 'boolean',
                default: true,
                description:
                  'Whether to check the validity of the SSL certificate of the remote host when performing active health checks using HTTPS.',
              },
              http_path: {
                type: 'string',
                default: '/',
                description:
                  'Path to use in GET HTTP request to run as a probe on active health checks.',
              },
              timeout: {
                type: 'number',
                default: 1,
                description: 'Socket timeout for active health checks (in seconds).',
              },
              https_sni: {
                type: 'string',
                description:
                  'The hostname to use as an SNI (Server Name Identification) when performing active health checks using HTTPS. This is particularly useful when Targets are configured using IPs, so that the target host’s certificate can be verified with the proper SNI.',
              },
              concurrency: {
                type: 'number',
                default: 10,
                description: 'Number of targets to check concurrently in active health checks.',
              },
              type: {
                type: 'string',
                default: 'http',
                description:
                  'Whether to perform active health checks using HTTP or HTTPS, or just attempt a TCP connection. Possible values are tcp, http or https.',
                enum: ['tcp', 'http', 'https'],
              },
              unhealthy: {
                $ref: '#/components/schemas/HealthcheckUnhealthy',
              },
              healthy: {
                $ref: '#/components/schemas/HealthcheckHealthy',
              },
            },
          },
          passive: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                default: 'http',
                description:
                  'Whether to perform passive health checks interpreting HTTP/HTTPS statuses, or just check for TCP connection success.',
                enum: ['tcp', 'http', 'https'],
              },
              unhealthy: {
                $ref: '#/components/schemas/HealthcheckUnhealthy',
              },
              healthy: {
                $ref: '#/components/schemas/HealthcheckHealthy',
              },
            },
          },
        },
      },
      SNISResponse: {
        title: 'SNIs Response',
        type: 'object',
        description: 'Paginated list of SNI entities',
        properties: {
          next: {
            type: 'string',
          },
          offset: {
            type: 'string',
          },
          data: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/SNI',
            },
          },
        },
        'x-examples': {
          'Response Body': {
            data: [
              {
                id: 'a9b2107f-a214-47b3-add4-46b942187924',
                name: 'my-sni',
                created_at: 1422386534,
                tags: ['user-level', 'low-priority'],
                certificate: {
                  id: '04fbeacf-a9f1-4a5d-ae4a-b0407445db3f',
                },
              },
              {
                id: '43429efd-b3a5-4048-94cb-5cc4029909bb',
                name: 'my-sni',
                created_at: 1422386534,
                tags: ['admin', 'high-priority', 'critical'],
                certificate: {
                  id: 'd26761d5-83a4-4f24-ac6c-cff276f2b79c',
                },
              },
            ],
            next: 'http://localhost:8001/snis?offset=6378122c-a0a1-438d-a5c6-efabae9fb969',
          },
        },
      },
      CertificatesResponse: {
        title: 'Certificates Response',
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Certificate',
            },
          },
          offset: {
            type: 'string',
          },
          next: {
            type: 'string',
          },
        },
        'x-examples': {
          'Response Body': {
            data: [
              {
                id: '02621eee-8309-4bf6-b36b-a82017a5393e',
                created_at: 1422386534,
                cert: '-----BEGIN CERTIFICATE-----...',
                key: '-----BEGIN RSA PRIVATE KEY-----...',
                tags: ['user-level', 'low-priority'],
              },
              {
                id: '66c7b5c4-4aaf-4119-af1e-ee3ad75d0af4',
                created_at: 1422386534,
                cert: '-----BEGIN CERTIFICATE-----...',
                key: '-----BEGIN RSA PRIVATE KEY-----...',
                tags: ['admin', 'high-priority', 'critical'],
              },
            ],
            next: 'http://localhost:8001/certificates?offset=6378122c-a0a1-438d-a5c6-efabae9fb969',
          },
        },
        description: 'Paginated list of Certificate entities',
      },
      CertificateRequest: {
        title: 'CertificateRequest',
        type: 'object',
        properties: {
          id: {
            type: 'string',
          },
        },
      },
      ServicesResponse: {
        title: 'Services Response',
        type: 'object',
        description: 'Paginated list of Service entities',
        properties: {
          next: {
            type: 'string',
          },
          offset: {
            type: 'string',
          },
          data: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Service',
            },
          },
        },
        'x-examples': {
          'Response Body': {
            data: [
              {
                id: '4e3ad2e4-0bc4-4638-8e34-c84a417ba39b',
                created_at: 1422386534,
                updated_at: 1422386534,
                name: 'my-service',
                retries: 5,
                protocol: 'http',
                host: 'example.com',
                port: 80,
                path: '/some_api',
                connect_timeout: 60000,
                write_timeout: 60000,
                read_timeout: 60000,
                tags: ['user-level', 'low-priority'],
              },
              {
                id: 'a5fb8d9b-a99d-40e9-9d35-72d42a62d83a',
                created_at: 1422386534,
                updated_at: 1422386534,
                name: 'my-service',
                retries: 5,
                protocol: 'http',
                host: 'example.com',
                port: 80,
                path: '/another_api',
                connect_timeout: 60000,
                write_timeout: 60000,
                read_timeout: 60000,
                tags: ['admin', 'high-priority', 'critical'],
              },
            ],
            next: 'http://localhost:8001/services?offset=6378122c-a0a1-438d-a5c6-efabae9fb969',
          },
        },
      },
      ConsumersResponse: {
        title: 'Consumers Response',
        type: 'object',
        'x-examples': {
          'Response Body': {
            data: [
              {
                id: '9aa116fd-ef4a-4efa-89bf-a0b17c4be982',
                created_at: 1422386534,
                username: 'my-username',
                custom_id: 'my-custom-id',
                tags: ['user-level', 'low-priority'],
              },
              {
                id: 'ba641b07-e74a-430a-ab46-94b61e5ea66b',
                created_at: 1422386534,
                username: 'my-username',
                custom_id: 'my-custom-id',
                tags: ['admin', 'high-priority', 'critical'],
              },
            ],
            next: 'http://localhost:8001/consumers?offset=6378122c-a0a1-438d-a5c6-efabae9fb969',
          },
        },
        description: 'Paginated list of Consumer entities',
        properties: {
          data: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Consumer',
            },
          },
          offset: {
            type: 'string',
          },
          next: {
            type: 'string',
          },
        },
      },
      Tags: {
        title: 'Tags',
        type: 'array',
        items: {
          'x-examples': {},
          description: 'Individual tag value',
          pattern: '^[A-Za-z-_\\.~]+$',
          title: 'Tag',
          type: 'string',
        },
        description: 'List of tag values',
        'x-examples': {},
      },
      ConsumerRequest: {
        title: 'Consumer Request',
        type: 'object',
        description: 'Create / Update Request Entity',
        properties: {
          username: {
            type: 'string',
          },
          custom_id: {
            type: 'string',
          },
          tags: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Tag',
            },
          },
        },
        'x-examples': {
          Request: {
            username: 'my-username',
            custom_id: 'my-custom-id',
            tags: ['user-level', 'low-priority'],
          },
        },
      },
      Tag: {
        type: 'string',
        title: 'Tag',
        pattern: '^[A-Za-z-_\\.~]+$',
        description: 'Individual tag value',
        'x-examples': {},
      },
      PluginsResponse: {
        title: 'PluginsResponse',
        type: 'object',
        description: 'Paginated List of Plugin entities',
        'x-examples': {
          'Response Body': {
            data: [
              {
                id: 'a4407883-c166-43fd-80ca-3ca035b0cdb7',
                name: 'rate-limiting',
                created_at: 1422386534,
                route: null,
                service: null,
                consumer: null,
                config: {
                  hour: 500,
                  minute: 20,
                },
                run_on: 'first',
                protocols: ['http', 'https'],
                enabled: true,
                tags: ['user-level', 'low-priority'],
              },
              {
                id: '01c23299-839c-49a5-a6d5-8864c09184af',
                name: 'rate-limiting',
                created_at: 1422386534,
                route: null,
                service: null,
                consumer: null,
                config: {
                  hour: 500,
                  minute: 20,
                },
                run_on: 'first',
                protocols: ['tcp', 'tls'],
                enabled: true,
                tags: ['admin', 'high-priority', 'critical'],
              },
            ],
            next: 'http://localhost:8001/plugins?offset=6378122c-a0a1-438d-a5c6-efabae9fb969',
          },
        },
        properties: {
          next: {
            type: 'string',
          },
          offset: {
            type: 'string',
          },
          data: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Plugin',
            },
          },
        },
      },
      PluginRequest: {
        title: 'Plugin Request',
        type: 'object',
        properties: {
          tags: {
            $ref: '#/components/schemas/Tags',
          },
          enabled: {
            type: 'boolean',
            description: 'Whether the plugin is applied to matching requests.',
            default: true,
          },
          protocols: {
            type: 'array',
            enum: ['http', 'https'],
            items: {
              type: 'string',
            },
          },
          run_on: {
            type: 'string',
            enum: ['first', 'second', 'all'],
            description:
              'Control on which Kong nodes this plugin will run, given a Service Mesh scenario.',
            default: 'first',
          },
          config: {
            type: 'object',
            description:
              'The configuration properties for the Plugin which can be found on the plugins documentation page in the Kong Hub.',
          },
          consumer: {
            type: 'object',
            description:
              'If set, the plugin will activate only for requests where the specified has been authenticated. (Note that some plugins can not be restricted to consumers this way.). Leave unset for the plugin to activate regardless of the authenticated consumer.',
            default: null,
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
              },
              name: {
                type: 'string',
              },
            },
          },
          service: {
            type: 'object',
            description:
              'If set, the plugin will only activate when receiving requests via one of the routes belonging to the specified Service. Leave unset for the plugin to activate regardless of the Service being matched.',
            default: null,
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
              },
              name: {
                type: 'string',
              },
            },
          },
          route: {
            type: 'object',
            description:
              'If set, the plugin will only activate when receiving requests via the specified route. Leave unset for the plugin to activate regardless of the Route being used.',
            default: null,
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
              },
              name: {
                type: 'string',
              },
            },
          },
          name: {
            type: 'string',
            pattern: '^[A-Za-z-_]+$',
            description:
              'The name of the Plugin that’s going to be added. The Plugin must be installed in every Kong instance in the cluster.',
          },
        },
        'x-examples': {
          REQUEST: {
            name: 'rate-limiting',
            config: {
              hour: 500,
              minute: 20,
            },
            tags: ['user-level', 'low-priority'],
          },
        },
        description: 'Create / Update Request',
      },
      RoutesResponse: {
        title: 'Routes Response',
        type: 'object',
        'x-examples': {
          'Response Body': {
            data: [
              {
                id: '4506673d-c825-444c-a25b-602e3c2ec16e',
                created_at: 1422386534,
                updated_at: 1422386534,
                name: 'my-route',
                protocols: ['http', 'https'],
                methods: ['GET', 'POST'],
                hosts: ['example.com', 'foo.test'],
                paths: ['/foo', '/bar'],
                https_redirect_status_code: 426,
                regex_priority: 0,
                strip_path: true,
                preserve_host: false,
                tags: ['user-level', 'low-priority'],
                service: {
                  id: 'd35165e2-d03e-461a-bdeb-dad0a112abfe',
                },
              },
              {
                id: 'af8330d3-dbdc-48bd-b1be-55b98608834b',
                created_at: 1422386534,
                updated_at: 1422386534,
                name: 'my-route',
                protocols: ['tcp', 'tls'],
                https_redirect_status_code: 426,
                regex_priority: 0,
                strip_path: true,
                preserve_host: false,
                snis: ['foo.test', 'example.com'],
                sources: [
                  {
                    ip: '10.1.0.0/16',
                    port: 1234,
                  },
                  {
                    ip: '10.2.2.2',
                  },
                  {
                    port: 9123,
                  },
                ],
                destinations: [
                  {
                    ip: '10.1.0.0/16',
                    port: 1234,
                  },
                  {
                    ip: '10.2.2.2',
                  },
                  {
                    port: 9123,
                  },
                ],
                tags: ['admin', 'high-priority', 'critical'],
                service: {
                  id: 'a9daa3ba-8186-4a0d-96e8-00d80ce7240b',
                },
              },
            ],
            next: 'http://localhost:8001/routes?offset=6378122c-a0a1-438d-a5c6-efabae9fb969',
          },
        },
        properties: {
          data: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Route',
            },
          },
          offset: {
            type: 'string',
          },
          next: {
            type: 'string',
          },
        },
        description: 'Paginated list of route entities',
      },
      Plugin: {
        title: 'Plugin Entity',
        type: 'object',
        description:
          'A Plugin entity represents a plugin configuration that will be executed during the HTTP request/response lifecycle. Plugins apply additional functionalities and policies such as Rate Limiting / Authentication to incoming requests to Kong.',
        'x-examples': {
          Entity: {
            id: 'ec1a1f6f-2aa4-4e58-93ff-b56368f19b27',
            name: 'rate-limiting',
            created_at: 1422386534,
            route: null,
            service: null,
            consumer: null,
            config: {
              hour: 500,
              minute: 20,
            },
            run_on: 'first',
            protocols: ['http', 'https'],
            enabled: true,
            tags: ['user-level', 'low-priority'],
          },
        },
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          name: {
            type: 'string',
            description:
              'The name of the Plugin that’s going to be added. The Plugin must be installed in every Kong instance in the cluster.',
            pattern: '^[A-Za-z-_]+$',
          },
          route: {
            type: 'object',
            default: null,
            description:
              'If set, the plugin will only activate when receiving requests via the specified route. Leave unset for the plugin to activate regardless of the Route being used.',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
              },
            },
          },
          service: {
            type: 'object',
            default: null,
            description:
              'If set, the plugin will only activate when receiving requests via one of the routes belonging to the specified Service. Leave unset for the plugin to activate regardless of the Service being matched.',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
              },
            },
          },
          consumer: {
            type: 'object',
            default: null,
            description:
              'If set, the plugin will activate only for requests where the specified has been authenticated. (Note that some plugins can not be restricted to consumers this way.). Leave unset for the plugin to activate regardless of the authenticated consumer.',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
              },
            },
          },
          config: {
            type: 'object',
            description:
              'The configuration properties for the Plugin which can be found on the plugins documentation page in the Kong Hub.',
          },
          run_on: {
            type: 'string',
            default: 'first',
            description:
              'Control on which Kong nodes this plugin will run, given a Service Mesh scenario.',
            enum: ['first', 'second', 'all'],
          },
          protocols: {
            type: 'array',
            enum: ['http', 'https'],
            items: {
              type: 'string',
            },
          },
          enabled: {
            type: 'boolean',
            default: true,
            description: 'Whether the plugin is applied to matching requests.',
          },
          tags: {
            $ref: '#/components/schemas/Tags',
          },
          created_at: {
            type: 'number',
          },
        },
        required: ['name'],
      },
      RouteRequest: {
        title: 'RouteRequest',
        type: 'object',
        description: 'Request body to create a Route entity',
        'x-examples': {
          HOSTS: {
            name: 'my-route',
            protocols: ['http', 'https'],
            methods: ['GET', 'POST'],
            hosts: ['example.com', 'foo.test'],
            paths: ['/foo', '/bar'],
            https_redirect_status_code: 426,
            regex_priority: 0,
            strip_path: true,
            preserve_host: false,
            tags: ['user-level', 'low-priority'],
            service: {
              id: 'd35165e2-d03e-461a-bdeb-dad0a112abfe',
            },
          },
          SNIS: {
            name: 'my-route',
            protocols: ['tcp', 'tls'],
            https_redirect_status_code: 426,
            regex_priority: 0,
            strip_path: true,
            preserve_host: false,
            snis: ['foo.test', 'example.com'],
            sources: [
              {
                ip: '10.1.0.0/16',
                port: 1234,
              },
              {
                ip: '10.2.2.2',
              },
              {
                port: 9123,
              },
            ],
            destinations: [
              {
                ip: '10.1.0.0/16',
                port: 1234,
              },
              {
                ip: '10.2.2.2',
              },
              {
                port: 9123,
              },
            ],
            tags: ['admin', 'high-priority', 'critical'],
            service: {
              name: 'my-name',
            },
          },
        },
        properties: {
          destinations: {
            type: 'array',
            description:
              'A list of IP destinations of incoming connections that match this Route when using stream routing. Each entry is an object with fields “ip” (optionally in CIDR range notation) and/or “port”. When using tcp or tls protocols, at least one of snis, sources, or destinations must be set.',
            items: {
              type: 'string',
            },
          },
          sources: {
            description:
              'A list of IP sources of incoming connections that match this Route when using stream routing. Each entry is an object with fields “ip” (optionally in CIDR range notation) and/or “port”. When using tcp or tls protocols, at least one of snis, sources, or destinations must be set.',
            type: 'array',
            items: {
              type: 'string',
            },
          },
          snis: {
            description:
              'A list of SNIs that match this Route when using stream routing. When using tcp or tls protocols, at least one of snis, sources, or destinations must be set.',
            type: 'array',
            items: {
              type: 'string',
            },
          },
          name: {
            type: 'string',
            pattern: '^[a-z-_]+',
            example: 'my-route',
            description: 'The name of the Route.',
          },
          protocols: {
            type: 'array',
            default: ['http', 'https'],
            description: 'A list of the protocols this Route should allow.',
            enum: ['http', 'https'],
            items: {
              type: 'string',
            },
          },
          methods: {
            type: 'array',
            description: 'A list of HTTP methods that match this Route.',
            items: {
              type: 'string',
            },
          },
          hosts: {
            type: 'array',
            description: 'A list of domain names that match this Route.',
            items: {
              type: 'string',
            },
          },
          paths: {
            type: 'array',
            description: 'A list of paths that match this Route.',
            items: {
              type: 'string',
            },
          },
          https_redirect_status_code: {
            type: 'integer',
            default: 426,
            description:
              'The status code Kong responds with when all properties of a Route match except the protocol',
            example: 426,
          },
          regex_priority: {
            type: 'integer',
            default: 0,
            description:
              'A number used to choose which route resolves a given request when several routes match it using regexes simultaneously. When two routes match the path and have the same regex_priority, the older one (lowest created_at) is used.',
            example: 0,
          },
          strip_path: {
            type: 'boolean',
            default: true,
            description:
              'When matching a Route via one of the paths, strip the matching prefix from the upstream request URL. ',
            example: true,
          },
          preserve_host: {
            type: 'boolean',
            example: false,
            description:
              'When matching a Route via one of the hosts domain names, use the request Host header in the upstream request headers.',
          },
          tags: {
            $ref: '#/components/schemas/Tags',
          },
          service: {
            type: 'object',
            description: 'The Service this Route is associated to (by either id or name).',
            properties: {
              id: {
                type: 'string',
                example: 'fc73f2af-890d-4f9b-8363-af8945001f7f',
                description: 'Service Identifier',
              },
              name: {
                type: 'string',
                description: 'Service Name',
              },
            },
          },
        },
      },
      Consumer: {
        title: 'Consumer Entity',
        type: 'object',
        description: 'The Consumer object represents a consumer - or a user - of a Service.',
        'x-examples': {
          Entity: {
            id: '127dfc88-ed57-45bf-b77a-a9d3a152ad31',
            created_at: 1422386534,
            username: 'my-username',
            custom_id: 'my-custom-id',
            tags: ['user-level', 'low-priority'],
          },
        },
        properties: {
          id: {
            type: 'string',
          },
          created_at: {
            type: 'number',
          },
          username: {
            type: 'string',
          },
          custom_id: {
            type: 'string',
          },
          tags: {
            $ref: '#/components/schemas/Tags',
          },
        },
      },
      SNI: {
        title: 'SNI Entity',
        type: 'object',
        'x-examples': {
          Entity: {
            id: '7fca84d6-7d37-4a74-a7b0-93e576089a41',
            name: 'my-sni',
            created_at: 1422386534,
            tags: ['user-level', 'low-priority'],
            certificate: {
              id: 'd044b7d4-3dc2-4bbc-8e9f-6b7a69416df6',
            },
          },
        },
        description:
          'An SNI object represents a many-to-one mapping of hostnames to a certificate. That is, a certificate object can have many hostnames associated with it; when Kong receives an SSL request, it uses the SNI field in the Client Hello to lookup the certificate object based on the SNI associated with the certificate.',
        properties: {
          id: {
            type: 'string',
          },
          name: {
            type: 'string',
            description:
              'The SNI name to associate with the given certificate. May contain a single wildcard in the leftmost (suffix) or rightmost (prefix) position. This can be helpful when maintaining multiple subdomains, as a single SNI configured with a wildcard name can be used to match multiple subdomains, instead of creating an SNI entity for each. Valid wildcard positions are mydomain.*, *.mydomain.com, and *.www.mydomain.com. Plain SNI names (no wildcard) take priority when matching, followed by prefix and then suffix.',
          },
          created_at: {
            type: 'number',
          },
          certificate: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
                description:
                  'The id (a UUID) of the certificate with which to associate the SNI hostname.',
              },
            },
          },
          tags: {
            $ref: '#/components/schemas/Tags',
          },
        },
      },
      Workspace: {
        title: 'Workspace',
        type: 'object',
        properties: {
          id: {
            type: 'string',
          },
        },
      },
      UpstreamTargetResponse: {
        title: 'Upstream Targets Response',
        type: 'object',
        properties: {
          next: {
            type: 'string',
          },
          offset: {
            type: 'string',
          },
          data: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/UpstreamTarget',
            },
          },
        },
        description: 'Response body for lists',
        'x-examples': {
          Response: {
            data: [
              {
                id: 'f5a9c0ca-bdbb-490f-8928-2ca95836239a',
                created_at: 1422386534,
                upstream: {
                  id: '173a6cee-90d1-40a7-89cf-0329eca780a6',
                },
                target: 'example.com:8000',
                weight: 100,
                tags: ['user-level', 'low-priority'],
              },
              {
                id: 'bdab0e47-4e37-4f0b-8fd0-87d95cc4addc',
                created_at: 1422386534,
                upstream: {
                  id: 'f00c6da4-3679-4b44-b9fb-36a19bd3ae83',
                },
                target: 'example.com:8000',
                weight: 100,
                tags: ['admin', 'high-priority', 'critical'],
              },
            ],
            next:
              'http://localhost:8001/upstream/example.com:8000/targets?offset=6378122c-a0a1-438d-a5c6-efabae9fb969',
          },
        },
      },
      UpstreamTargetRequest: {
        title: 'Upstream Target Request',
        type: 'object',
        properties: {
          tags: {
            $ref: '#/components/schemas/Tags',
          },
          weight: {
            type: 'integer',
            default: 100,
            description:
              'The weight this target gets within the upstream loadbalancer (`0`-`1000`). If the hostname resolves to an SRV record, the weight value will be overridden by the value from the DNS record.',
          },
          target: {
            type: 'string',
            description:
              'The target address (ip or hostname) and port. If the hostname resolves to an SRV record, the port value will be overridden by the value from the DNS record.',
          },
        },
        'x-examples': {
          Request: {
            target: 'example.com:8000',
            weight: 100,
            tags: ['user-level', 'low-priority'],
          },
        },
        description: 'Create / Update request body',
      },
    },
    securitySchemes: {
      'Kong-Admin-Token': {
        name: 'Kong-Admin-Token',
        type: 'apiKey',
        in: 'header',
        description: 'Kong Admin RBAC Token\n',
      },
    },
    callbacks: {},
    links: {},
    headers: {
      'X-RateLimit-Limit': {
        description: 'Request limit per hour',
        schema: {
          type: 'integer',
        },
      },
      'X-RateLimit-Remaining': {
        description: 'The number of requests left for the time window',
        schema: {
          type: 'integer',
        },
      },
      'X-RateLimit-Reset': {
        description: 'UTC date/time at which the current rate limit resets',
        schema: {
          type: 'integer',
        },
      },
    },
    parameters: {
      skipParam: {
        name: 'skip',
        in: 'query',
        description: 'number of items to skip',
        required: true,
        schema: {
          type: 'integer',
          format: 'int32',
        },
      },
      limitParam: {
        name: 'limit',
        in: 'query',
        description: 'max records to return',
        required: true,
        schema: {
          type: 'integer',
          format: 'int32',
        },
      },
    },
    responses: {
      NotFound: {
        description: 'Entity not found.',
      },
      IllegalInput: {
        description: 'Illegal input for operation.',
      },
      GeneralError: {
        description: 'General Error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/GeneralError',
            },
          },
        },
      },
    },
  },
  security: [],
};

const apiSpec2 = {
  openapi: '3.0.0',
  info: {
    title: 'Simple API overview',
    version: '2.0.0',
  },
  paths: {
    '/': {
      get: {
        operationId: 'listVersionsv2',
        summary: 'List API versions',
        responses: {
          '200': {
            description: '200 response',
            content: {
              'application/json': {
                examples: {
                  foo: {
                    value: {
                      versions: [
                        {
                          status: 'CURRENT',
                          updated: '2011-01-21T11:33:21Z',
                          id: 'v2.0',
                          links: [
                            {
                              href: 'http://127.0.0.1:8774/v2/',
                              rel: 'self',
                            },
                          ],
                        },
                        {
                          status: 'EXPERIMENTAL',
                          updated: '2013-07-23T11:33:21Z',
                          id: 'v3.0',
                          links: [
                            {
                              href: 'http://127.0.0.1:8774/v3/',
                              rel: 'self',
                            },
                          ],
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
          '300': {
            description: '300 response',
            content: {
              'application/json': {
                examples: {
                  foo: {
                    value:
                      '{\n "versions": [\n       {\n         "status": "CURRENT",\n         "updated": "2011-01-21T11:33:21Z",\n         "id": "v2.0",\n         "links": [\n             {\n                 "href": "http://127.0.0.1:8774/v2/",\n                 "rel": "self"\n             }\n         ]\n     },\n     {\n         "status": "EXPERIMENTAL",\n         "updated": "2013-07-23T11:33:21Z",\n         "id": "v3.0",\n         "links": [\n             {\n                 "href": "http://127.0.0.1:8774/v3/",\n                 "rel": "self"\n             }\n         ]\n     }\n ]\n}\n',
                  },
                },
              },
            },
          },
        },
      },
    },
    '/v2': {
      get: {
        operationId: 'getVersionDetailsv2',
        summary: 'Show API version details',
        responses: {
          '200': {
            description: '200 response',
            content: {
              'application/json': {
                examples: {
                  foo: {
                    value: {
                      version: {
                        status: 'CURRENT',
                        updated: '2011-01-21T11:33:21Z',
                        'media-types': [
                          {
                            base: 'application/xml',
                            type: 'application/vnd.openstack.compute+xml;version=2',
                          },
                          {
                            base: 'application/json',
                            type: 'application/vnd.openstack.compute+json;version=2',
                          },
                        ],
                        id: 'v2.0',
                        links: [
                          {
                            href: 'http://127.0.0.1:8774/v2/',
                            rel: 'self',
                          },
                          {
                            href:
                              'http://docs.openstack.org/api/openstack-compute/2/os-compute-devguide-2.pdf',
                            type: 'application/pdf',
                            rel: 'describedby',
                          },
                          {
                            href:
                              'http://docs.openstack.org/api/openstack-compute/2/wadl/os-compute-2.wadl',
                            type: 'application/vnd.sun.wadl+xml',
                            rel: 'describedby',
                          },
                          {
                            href:
                              'http://docs.openstack.org/api/openstack-compute/2/wadl/os-compute-2.wadl',
                            type: 'application/vnd.sun.wadl+xml',
                            rel: 'describedby',
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
          '203': {
            description: '203 response',
            content: {
              'application/json': {
                examples: {
                  foo: {
                    value: {
                      version: {
                        status: 'CURRENT',
                        updated: '2011-01-21T11:33:21Z',
                        'media-types': [
                          {
                            base: 'application/xml',
                            type: 'application/vnd.openstack.compute+xml;version=2',
                          },
                          {
                            base: 'application/json',
                            type: 'application/vnd.openstack.compute+json;version=2',
                          },
                        ],
                        id: 'v2.0',
                        links: [
                          {
                            href: 'http://23.253.228.211:8774/v2/',
                            rel: 'self',
                          },
                          {
                            href:
                              'http://docs.openstack.org/api/openstack-compute/2/os-compute-devguide-2.pdf',
                            type: 'application/pdf',
                            rel: 'describedby',
                          },
                          {
                            href:
                              'http://docs.openstack.org/api/openstack-compute/2/wadl/os-compute-2.wadl',
                            type: 'application/vnd.sun.wadl+xml',
                            rel: 'describedby',
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

export const _default = () => {
  const [targetPath, setTargetPath] = React.useState('Awaiting click...');

  const _handleItemClick = (...items) => {
    setTargetPath(items.join(' > '));
  };

  return (
    <div style={{ width: '350px' }}>
      <div style={{ display: 'block', margin: '0px 0px 20px 0px' }}>Target: {targetPath}</div>
      <Sidebar jsonData={apiSpec} onClick={_handleItemClick} />
    </div>
  );
};

export const SimpleAPI = () => {
  const [targetPath, setTargetPath] = React.useState('Awaiting click...');

  const _handleItemClick = (...items) => {
    setTargetPath(items.join(' > '));
  };

  return (
    <div style={{ width: '350px' }}>
      <div style={{ display: 'block', margin: '0px 0px 20px 0px' }}>Target: {targetPath}</div>
      <Sidebar jsonData={apiSpec2} onClick={_handleItemClick} />
    </div>
  );
};

_default.story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/sS7oBbKmDvhtq5lXyTckVe/Style-Guide-Components?node-id=0%3A2',
    },
  },
};
