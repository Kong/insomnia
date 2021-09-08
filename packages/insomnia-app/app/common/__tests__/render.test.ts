import { createBuilder } from '@develohpanda/fluent-builder';

import { globalBeforeEach } from '../../__jest__/before-each';
import * as models from '../../models';
import { environmentModelSchema, requestGroupModelSchema } from '../../models/__schemas__/model-schemas';
import { Environment } from '../../models/environment';
import { Workspace } from '../../models/workspace';
import * as renderUtils from '../render';

jest.mock('electron');

const envBuilder = createBuilder(environmentModelSchema);
const reqGroupBuilder = createBuilder(requestGroupModelSchema);

describe('render tests', () => {
  beforeEach(async () => {
    await globalBeforeEach();
    await models.project.all();
    envBuilder.reset();
    reqGroupBuilder.reset();
  });

  describe('render()', () => {
    it('renders hello world', async () => {
      const rendered = await renderUtils.render('Hello {{ msg }}!', {
        msg: 'World',
      });
      expect(rendered).toBe('Hello World!');
    });

    it('renders custom tag: uuid', async () => {
      const rendered = await renderUtils.render('Hello {% uuid %}!');
      expect(rendered).toMatch(/Hello [a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}!/);
    });

    it('renders custom tag: timestamp', async () => {
      const rendered = await renderUtils.render('Hello {% timestamp %}!');
      expect(rendered).toMatch(/Hello \d{13}!/);
    });

    it('renders nested object', async () => {
      const rendered = await renderUtils.render('Hello {{ users[0].name }}!', {
        users: [
          {
            name: 'FooBar',
          },
        ],
      });
      expect(rendered).toBe('Hello FooBar!');
    });

    it('fails on invalid template', async () => {
      try {
        await renderUtils.render('Hello {{ msg }!', {
          msg: 'World',
        });
        fail('Render should have failed');
      } catch (err) {
        expect(err.message).toContain('expected variable end');
      }
    });

    it('handles variables using tag before tag is defined as expected (incorrect order)', async () => {
      const rootEnvironment = envBuilder
        .data({
          consume: '{{ replaced }}',
          hashed: "{% hash 'md5', 'hex', value %}",
          replaced: "{{ hashed | replace('f67565de946a899a534fd908e7eef872', 'cat') }}",
          value: 'ThisIsATopSecretValue',
        })
        .dataPropertyOrder({
          '&': ['value', 'replaced', 'hashed', 'consume'],
        })
        .build();

      const context = await renderUtils.buildRenderContext({ ancestors: [], rootEnvironment });
      expect(context).toEqual({
        value: 'ThisIsATopSecretValue',
        hashed: 'f67565de946a899a534fd908e7eef872',
        replaced: 'f67565de946a899a534fd908e7eef872',
        consume: 'f67565de946a899a534fd908e7eef872',
      });
      // In runtime, this context is used to render, which re-evaluates the expression for replaced in the rootEnvironment by using the built context
      // Regression test from issue 1917 - https://github.com/Kong/insomnia/issues/1917
      const renderExpression = await renderUtils.render(rootEnvironment.data.replaced, context);
      expect(renderExpression).toBe('cat');
    });
  });

  describe('buildRenderContext()', () => {
    it('cascades properly', async () => {
      const ancestors = [
        reqGroupBuilder.environment({ foo: 'parent', ancestor: true }).build(),
        reqGroupBuilder.environment({ foo: 'grandparent', ancestor: true }).build(),
      ];

      const rootEnvironment = envBuilder.data({ foo: 'root', root: true }).build();
      const subEnvironment = envBuilder.data({ foo: 'sub', sub: true }).build();

      const context = await renderUtils.buildRenderContext({ ancestors, rootEnvironment, subEnvironment });

      expect(context).toEqual({
        foo: 'parent',
        ancestor: true,
        root: true,
        sub: true,
      });
    });

    it('rendered recursive should not infinite loop', async () => {
      const ancestors = [
        reqGroupBuilder.environment({ recursive: '{{ recursive }}/hello' }).build(),
      ];

      const context = await renderUtils.buildRenderContext({ ancestors });
      // This is longer than 3 because it multiplies every time (1 -> 2 -> 4 -> 8)
      expect(context).toEqual({
        recursive: '{{ recursive }}/hello/hello/hello/hello/hello/hello/hello/hello',
      });
    });

    it('does not recursive render if itself is not used in var', async () => {
      const root = envBuilder.data({
        proto: 'http',
        domain: 'base.com',
        url: '{{ proto }}://{{ domain }}',
      }).build();

      const sub = envBuilder.data({
        proto: 'https',
        domain: 'sub.com',
        port: 8000,
        url: '{{ proto }}://{{ domain }}:{{ port }}',
      }).build();

      const ancestors = [
        reqGroupBuilder.environment({
          proto: 'https',
          domain: 'folder.com',
          port: 7000,
        }).build(),
      ];
      const context = await renderUtils.buildRenderContext({ ancestors, rootEnvironment: root, subEnvironment: sub });
      expect(context).toEqual({
        proto: 'https',
        domain: 'folder.com',
        port: 7000,
        url: 'https://folder.com:7000',
      });
    });

    it('does the thing', async () => {
      const root = envBuilder.data({ url: 'insomnia.rest' }).build();
      const sub = envBuilder.data({ url: '{{ url }}/sub' }).build();
      const ancestors = [
        reqGroupBuilder.environment({
          url: '{{ url }}/{{ name }}',
          name: 'folder',
        }).build(),
      ];

      const context = await renderUtils.buildRenderContext({ ancestors, rootEnvironment: root, subEnvironment: sub });
      expect(context).toEqual({
        url: 'insomnia.rest/sub/folder',
        name: 'folder',
      });
    });

    it('render up to 3 recursion levels', async () => {
      const ancestors = [
        reqGroupBuilder.environment({
          d: '/d',
          c: '/c{{ d }}',
          b: '/b{{ c }}',
          a: '/a{{ b }}',
          test: 'http://insomnia.rest{{ a }}',
        }).build(),
      ];
      const context = await renderUtils.buildRenderContext({ ancestors });
      expect(context).toEqual({
        d: '/d',
        c: '/c/d',
        b: '/b/c/d',
        a: '/a/b/c/d',
        test: 'http://insomnia.rest/a/b/c/d',
      });
    });

    it('rendered sibling environment variables', async () => {
      const ancestors = [
        reqGroupBuilder.environment({
          sibling: 'sibling',
          test: '{{ sibling }}/hello',
        }).build(),
      ];
      const context = await renderUtils.buildRenderContext({ ancestors });
      expect(context).toEqual({
        sibling: 'sibling',
        test: 'sibling/hello',
      });
    });

    it('rendered parent environment variables', async () => {
      const ancestors = [
        reqGroupBuilder
          .name('Parent')
          .environment({
            test: '{{ grandparent }} parent',
          })
          .build(),
        reqGroupBuilder
          .name('Grandparent')
          .environment({
            grandparent: 'grandparent',
          })
          .build(),
      ];
      const context = await renderUtils.buildRenderContext({ ancestors });
      expect(context).toEqual({
        grandparent: 'grandparent',
        test: 'grandparent parent',
      });
    });

    it('rendered parent same name environment variables', async () => {
      const ancestors = [
        reqGroupBuilder
          .name('Parent')
          .environment({
            base_url: '{{ base_url }}/resource',
          })
          .build(),
        reqGroupBuilder
          .name('Grandparent')
          .environment({
            base_url: 'https://insomnia.rest',
          })
          .build(),
      ];
      const context = await renderUtils.buildRenderContext({ ancestors });
      expect(context).toEqual({
        base_url: 'https://insomnia.rest/resource',
      });
    });

    it('rendered parent, ignoring sibling environment variables', async () => {
      const ancestors = [
        reqGroupBuilder
          .name('Parent')
          .environment({
            host: 'parent.com',
          })
          .build(),
        reqGroupBuilder
          .name('Grandparent')
          .environment({
            host: 'grandparent.com',
            node: {
              admin: 'admin',
              test: 'test',
              port: 8080,
            },
            urls: {
              admin: 'https://{{ host }}/{{ node.admin }}',
              test: 'https://{{ host }}/{{ node.test }}',
            },
          })
          .build(),
      ];
      const context = await renderUtils.buildRenderContext({ ancestors });
      expect(await renderUtils.render('{{ urls.admin }}/foo', context)).toBe(
        'https://parent.com/admin/foo',
      );
      expect(await renderUtils.render('{{ urls.test }}/foo', context)).toBe(
        'https://parent.com/test/foo',
      );
    });

    it('renders child environment variables', async () => {
      const ancestors = [
        reqGroupBuilder
          .name('Parent')
          .environment({
            parent: 'parent',
          })
          .build(),
        reqGroupBuilder
          .name('Grandparent')
          .environment({
            test: '{{ parent }} grandparent',
          })
          .build(),
      ];
      const context = await renderUtils.buildRenderContext({ ancestors });
      expect(context).toEqual({
        parent: 'parent',
        test: 'parent grandparent',
      });
    });

    it('works with object arrays', async () => {
      const ancestors = [
        reqGroupBuilder
          .name('Parent')
          .environment({})
          .build(),
        reqGroupBuilder
          .name('Grandparent')
          .environment({
            users: [
              {
                name: 'Foo',
              },
              {
                name: 'Bar',
              },
            ],
          })
          .build(),
      ];
      const context = await renderUtils.buildRenderContext({ ancestors });
      expect(context).toEqual({
        users: [
          {
            name: 'Foo',
          },
          {
            name: 'Bar',
          },
        ],
      });
    });

    it('works with ordered objects', async () => {
      const obj = {
        users: [
          {
            name: 'Foo',
            id: 1,
          },
          {
            name: 'Bar',
            id: 2,
          },
        ],
      };
      const order = {
        '&': ['users'],
        '&~|users~|0': ['id', 'name'],
        '&~|users~|1': ['id', 'name'],
      };
      const requestGroup = reqGroupBuilder.name('Parent').environment(obj).environmentPropertyOrder(order).build();
      const rootEnvironment = envBuilder.name('Parent').data(obj).dataPropertyOrder(order).build();
      const subEnvironment = envBuilder.name('Sub').data(obj).dataPropertyOrder(order).build();

      const groupCtx = await renderUtils.buildRenderContext({ ancestors: [requestGroup] });
      const rootCtx = await renderUtils.buildRenderContext({ ancestors: [], rootEnvironment });
      const subCtx = await renderUtils.buildRenderContext({ ancestors: [], subEnvironment });

      const expected = {
        users: [
          {
            id: 1,
            name: 'Foo',
          },
          {
            id: 2,
            name: 'Bar',
          },
        ],
      };
      expect(groupCtx).toEqual(expected);
      expect(rootCtx).toEqual(expected);
      expect(subCtx).toEqual(expected);
    });

    it('merges nested properties when rendering', async () => {
      const ancestors = [
        reqGroupBuilder
          .name('Parent')
          .environment({
            parent: 'parent',
            nested: {
              common: 'parent',
              parentA: 'pa',
              parentB: 'pb',
            },
          }).build(),
        reqGroupBuilder
          .name('Grandparent')
          .environment({
            test: '{{ parent }} grandparent',
            nested: {
              common: 'grandparent',
              grandParentA: 'gpa',
              grandParentB: 'gpb',
            },
          }).build(),
      ];
      const context = await renderUtils.buildRenderContext({ ancestors });
      expect(context).toEqual({
        parent: 'parent',
        test: 'parent grandparent',
        nested: {
          common: 'parent',
          grandParentA: 'gpa',
          grandParentB: 'gpb',
          parentA: 'pa',
          parentB: 'pb',
        },
      });
    });

    it('cascades properly and renders', async () => {
      const ancestors = [
        reqGroupBuilder
          .environment({
            url: '{{ base_url }}/resource',
            ancestor: true,
            winner: 'folder parent',
          })
          .build(),
        reqGroupBuilder
          .environment({
            ancestor: true,
            winner: 'folder grandparent',
          })
          .build(),
      ];
      const subEnvironment = envBuilder.data({
        winner: 'sub',
        sub: true,
        base_url: 'https://insomnia.rest',
      }).build();
      const rootEnvironment = envBuilder.data({
        winner: 'root',
        root: true,
        base_url: 'ignore this',
      }).build();
      const context = await renderUtils.buildRenderContext(
        { ancestors, rootEnvironment, subEnvironment },
      );
      expect(context).toEqual({
        base_url: 'https://insomnia.rest',
        url: 'https://insomnia.rest/resource',
        ancestor: true,
        winner: 'folder parent',
        root: true,
        sub: true,
      });
    });

    it('handles variables using tag after tag is defined as expected (correct order)', async () => {
      const rootEnvironment = envBuilder
        .data({
          consume: '{{ replaced }}',
          hashed: "{% hash 'md5', 'hex', value %}",
          replaced: "{{ hashed | replace('f67565de946a899a534fd908e7eef872', 'cat') }}",
          value: 'ThisIsATopSecretValue',
        })
        .dataPropertyOrder({
          '&': ['value', 'hashed', 'replaced', 'consume'],
        })
        .build();
      const context = await renderUtils.buildRenderContext({ ancestors: [], rootEnvironment });
      expect(context).toEqual({
        value: 'ThisIsATopSecretValue',
        hashed: 'f67565de946a899a534fd908e7eef872',
        replaced: 'cat',
        consume: 'cat',
      });
    });

    it('handles variables being used in tags', async () => {
      const rootEnvironment = envBuilder
        .data({
          hash_input: '{{ orderId }}{{ secret }}',
          hash_input_expected: '123456789012345ThisIsATopSecretValue',
          orderId: 123456789012345,
          password: "{% hash 'sha512', 'hex', hash_input %}",
          password_expected: "{% hash 'sha512', 'hex', hash_input_expected %}",
          secret: 'ThisIsATopSecretValue',
        })
        .build();
      const context = await renderUtils.buildRenderContext({ ancestors: [], rootEnvironment });
      expect(context).toEqual({
        hash_input: '123456789012345ThisIsATopSecretValue',
        hash_input_expected: '123456789012345ThisIsATopSecretValue',
        orderId: 123456789012345,
        password:
        'ea84d15f33d3f9e9098fe01659b1ea0599d345770bba20ba98bf9056676a83ffe6b5528b2451ad04badbf690cf3009a94c510121cc6897045f8bb4ba0826134c',
        password_expected:
        'ea84d15f33d3f9e9098fe01659b1ea0599d345770bba20ba98bf9056676a83ffe6b5528b2451ad04badbf690cf3009a94c510121cc6897045f8bb4ba0826134c',
        secret: 'ThisIsATopSecretValue',
      });
    });

    it('works with minimal parameters', async () => {
      const context = await renderUtils.buildRenderContext({ });
      expect(context).toEqual({});
    });
  });

  describe('render()', () => {
    it('correctly renders simple Object', async () => {
      const newObj = await renderUtils.render(
        {
          foo: '{{ foo }}',
          bar: 'bar',
          baz: '{{ bad }}',
        },
        {
          foo: 'bar',
          bad: 'hi',
        },
      );
      expect(newObj).toEqual({
        foo: 'bar',
        bar: 'bar',
        baz: 'hi',
      });
    });

    it('correctly renders complex Object', async () => {
      const d = new Date();
      const obj = {
        foo: '{{ foo }}',
        null: null,
        bool: true,
        date: d,
        undef: undefined,
        num: 1234,
        nested: {
          foo: '{{ foo }}',
          arr: [1, 2, '{{ foo }}'],
        },
      };
      const newObj = await renderUtils.render(obj, {
        foo: 'bar',
      });
      expect(newObj).toEqual({
        foo: 'bar',
        null: null,
        bool: true,
        date: d,
        undef: undefined,
        num: 1234,
        nested: {
          foo: 'bar',
          arr: [1, 2, 'bar'],
        },
      });
      // Make sure original request isn't changed
      expect(obj.foo).toBe('{{ foo }}');
      expect(obj.nested.foo).toBe('{{ foo }}');
      expect(obj.nested.arr[2]).toBe('{{ foo }}');
    });

    it('fails on bad template', async () => {
      try {
        await renderUtils.render(
          {
            foo: '{{ foo }',
            bar: 'bar',
            baz: '{{ bad }}',
          },
          {
            foo: 'bar',
          },
        );
        fail('Render should have failed');
      } catch (err) {
        expect(err.message).toContain('expected variable end');
      }
    });

    it('keep on error setting', async () => {
      const template = '{{ foo }} {% invalid "hi" %}';
      const context = {
        foo: 'bar',
      };
      const resultOnlyVars = await renderUtils.render(
        template,
        context,
        null,
        renderUtils.KEEP_ON_ERROR,
      );
      expect(resultOnlyVars).toBe('{{ foo }} {% invalid "hi" %}');

      try {
        await renderUtils.render(template, context, null);
        fail('Render should not have succeeded');
      } catch (err) {
        expect(err.message).toBe('unknown block tag: invalid');
      }
    });

    it('outputs correct error path', async () => {
      const template = {
        foo: [
          {
            bar: '{% foo %}',
          },
        ],
      };

      try {
        await renderUtils.render(template);
        fail('Should have failed to render');
      } catch (err) {
        expect(err.path).toBe('foo[0].bar');
      }
    });

    it('outputs correct error path when private first node', async () => {
      const template = {
        _foo: {
          _bar: {
            baz: '{% foo %}',
          },
        },
      };

      try {
        await renderUtils.render(template);
        fail('Should have failed to render');
      } catch (err) {
        expect(err.path).toBe('_bar.baz');
      }
    });
  });

  describe('getRenderedGrpcRequestMessage()', () => {
    it('renders only the body for a grpc request ', async () => {
      const w1 = await models.workspace.create();
      const env = await models.environment.create({
        parentId: w1._id,
        data: {
          foo: 'bar',
          host: 'testb.in:9000',
        },
      });
      const grpcRequest = await models.grpcRequest.create({
        parentId: w1._id,
        name: 'hi {{ foo }}',
        url: '{{ host }}',
        description: 'hi {{ foo }}',
        body: {
          text: '{ "prop": "{{ foo }}" }',
        },
      });
      const request = await renderUtils.getRenderedGrpcRequestMessage({ request: grpcRequest, environmentId: env._id });
      expect(request).toEqual(
        expect.objectContaining({
          text: '{ "prop": "bar" }',
        }),
      );
    });
  });

  describe('getRenderedGrpcRequest()', () => {
    let w1: Workspace;
    let env: Environment;

    beforeEach(async () => {
      w1 = await models.workspace.create();
      env = await models.environment.create({
        parentId: w1._id,
        data: {
          foo: 'bar',
          host: 'testb.in:9000',
        },
      });
    });

    it('renders all grpc request properties', async () => {
      const grpcRequest = await models.grpcRequest.create({
        parentId: w1._id,
        name: 'hi {{ foo }}',
        url: '{{ host }}',
        description: 'hi {{ foo }}',
        body: {
          text: '{ "prop": "{{ foo }}" }',
        },
      });
      const request = await renderUtils.getRenderedGrpcRequest({ request: grpcRequest, environmentId: env._id });
      expect(request).toEqual(
        expect.objectContaining({
          name: 'hi bar',
          url: 'testb.in:9000',
          description: 'hi bar',
          body: {
            text: '{ "prop": "bar" }',
          },
        }),
      );
    });

    it('renders but ignores the body for a grpc request ', async () => {
      const grpcRequest = await models.grpcRequest.create({
        parentId: w1._id,
        name: 'hi {{ foo }}',
        url: '{{ host }}',
        description: 'hi {{ foo }}',
        body: {
          text: '{ "prop": "{{ foo }}" }',
        },
      });
      const request = await renderUtils.getRenderedGrpcRequest({ request: grpcRequest, environmentId: env._id, skipBody: true });
      expect(request).toEqual(
        expect.objectContaining({
          name: 'hi bar',
          url: 'testb.in:9000',
          description: 'hi bar',
          body: {
            text: '{ "prop": "{{ foo }}" }',
          },
        }),
      );
    });

    it('should still render with bad description', async () => {
      const grpcRequest = await models.grpcRequest.create({
        parentId: w1._id,
        name: 'hi {{ foo }}',
        url: '{{ host }}',
        description: 'hi {{ some error }}',
        body: {
          text: '{ "prop": "{{ foo }}" }',
        },
      });
      const request = await renderUtils.getRenderedGrpcRequest({ request: grpcRequest, environmentId: env._id });
      expect(request).toEqual(
        expect.objectContaining({
          name: 'hi bar',
          url: 'testb.in:9000',
          description: 'hi {{ some error }}',
          body: {
            text: '{ "prop": "bar" }',
          },
        }),
      );
    });
  });
});
