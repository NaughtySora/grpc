const { define, callbackify, callbackifyApi, merge, url } = require('../lib/util');
const { describe, it } = require('node:test');
const { resolve } = require('node:path');
const { async, array } = require('naughty-util');
const client = require('../lib/client');
const server = require('../lib/server');
const assert = require('node:assert');

const schema = path => resolve(__dirname, path);

describe('util', () => {
  it('url', () => {
    assert.strictEqual(url('127.0.0.1', 5555), '127.0.0.1:5555');
  });

  it('callbackify', () => {
    const param = 42;
    const fn = async (x) => {
      await async.pause(0);
      return x;
    };
    const errback = callbackify(fn);
    errback(param, (err, data) => {
      assert.strictEqual(data, param);
    });
  });

  it('callbackifyApi', () => {
    const api = callbackifyApi({
      async echo(x) {
        await async.pause(0);
        return `Hello ${x}!`;
      },
      async test() {
        await async.pause(0);
        return { content: "hello" };
      },
    });
    api.echo("World", (err, data) => {
      assert.strictEqual(data, `Hello World!`);
    });
    api.test((err, data) => {
      assert.deepStrictEqual(data, { content: "hello" });
    });
  });

  it('define', () => {
    const services = [{ path: schema('./mocks/user.proto') },];
    const proto = define(services);
    assert.ok(proto.user !== undefined);
    assert.ok(proto.user.UserRequest !== undefined);
    assert.ok(proto.user.UserResponse !== undefined);
    assert.ok(proto.user.UserService !== undefined);
  });

  it('merge', () => {
    const proto = define([{ path: schema('./mocks/user.proto') },]);
    const api = {
      user: {
        UserService: callbackifyApi({
          async echo(x) {
            await async.pause(0);
            return `Hello ${x}!`;
          },
          async test() {
            await async.pause(0);
            return { content: "hello" };
          },
        }),
      }
    };
    const services = merge(proto, api);
    assert.ok(array.valid(services));
    assert.ok(services[0]?.signature?.echo !== undefined);
    assert.ok(services[0]?.impl?.echo === api.user.UserService.echo);
    assert.ok(services[0]?.impl?.test === api.user.UserService.test);
  });
});

describe('client/server', async () => {
  const proto = define([{ path: schema('./mocks/user.proto') },]);
  const api = {
    user: {
      UserService: callbackifyApi({
        async echo(call) {
          return { content: `name: ${call.request.name}, age: ${call.request.age}` };
        }
      }),
    },
  };

  const { start, stop } = server();
  await start(merge(proto, api));

  const schemas = client({ proto });
  const UserService = schemas('user', 'UserService');
  assert.ok(UserService?.echo !== undefined);
  const res = await UserService.echo({ name: 'sora', age: 42069 });
  assert.deepStrictEqual(res, { content: `name: sora, age: 42069` });

  const exit = async (code, details) => {
    await stop();
    console.log('Graceful shutdown', { code, details });
    process.exit(code);
  };
  process.on("SIGINT", exit.bind(null, 0));
  process.on("uncaughtException", exit.bind(null, 1));

  process.emit('SIGINT', "Client/Server test ended");
});
