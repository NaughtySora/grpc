const { define, callbackify, callbackifyApi, merge, url } = require('../lib/util');
const { describe, it } = require('node:test');
const { resolve } = require('node:path');
const { async, array } = require('naughty-util');
const client = require('../lib/client');
const server = require('../lib/server');
const assert = require('node:assert');

const USER_SCHEMA_PATH = './mocks/user.proto';
const CLIENT_SCHEMA_PATH = './mocks/client.proto';
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
    const services = [{ path: schema(USER_SCHEMA_PATH) },];
    const proto = define(services);
    assert.ok(proto.user !== undefined);
    assert.ok(proto.user.UserRequest !== undefined);
    assert.ok(proto.user.UserResponse !== undefined);
    assert.ok(proto.user.UserService !== undefined);
  });

  it('merge', () => {
    const proto = define([{ path: schema(USER_SCHEMA_PATH) },]);
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
  const proto = define([{ path: schema(USER_SCHEMA_PATH) },]);
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
  await stop(0);
});

describe.skip('server streaming', async () => {
  // function getMessages(call) {
  //   const messages = ["hi", "hello", "hey"];
  //   messages.forEach(msg => call.write({ text: msg }));
  //   call.end();
  // }

  // const call = client.getMessages({ userId: "123" });
  // call.on("data", (msg) => console.log("got:", msg));
  // call.on("end", () => console.log("done"));
});

describe('client streaming', async () => {
  const PORT = 50052;
  const proto = define([{ path: schema(CLIENT_SCHEMA_PATH) },]);

  const api = {
    client: {
      ClientService: {
        UploadData(call, callback) {
          let count = 0;
          let chunks = [];
          call.on("data", ({ chunk }) => void (count++, chunks.push(chunk)));
          call.on("end", () => {
            callback(null, {
              success: true,
              message: `count: ${count} messages: ${Buffer.concat(chunks).toString()}`
            });
          });
        }
      },
    },
  };

  const { start, stop } = server({ port: PORT });
  await start(merge(proto, api));

  const schemas = client({ port: PORT, proto, promisify: false });
  const ClientService = schemas('client', 'ClientService');
  const call = ClientService.UploadData((error, res) => {
    if (error) throw error;
    assert.deepStrictEqual(res, { success: true, message: 'count: 3 messages: 123' });
    stop(0);
  });
  call.write({ chunk: Buffer.from('1') });
  call.write({ chunk: Buffer.from('2') });
  call.write({ chunk: Buffer.from('3') });
  call.end();
});

describe.skip('bidirectional stream', async () => {
  // function chat(call) {
  //   call.on("data", (msg) => {
  //     console.log("got:", msg.text);
  //     // echo back or broadcast
  //     call.write({ text: `echo: ${msg.text}` });
  //   });
  //   call.on("end", () => call.end());
  // }

  // const call = client.chat();
  // call.on("data", (msg) => console.log("server:", msg.text));

  // call.write({ text: "hi server" });
  // setTimeout(() => call.write({ text: "another msg" }), 1000);
});
