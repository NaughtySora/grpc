const { define, callbackify, callbackifyApi, merge, url } = require('../lib/util');
const { describe, it } = require('node:test');
const { resolve } = require('node:path');
const { async, array } = require('naughty-util');
const client = require('../lib/client');
const server = require('../lib/server');
const assert = require('node:assert');

const USER_SCHEMA_PATH = './mocks/user.proto';
const CLIENT_SCHEMA_PATH = './mocks/client.proto';
const SERVER_SCHEMA_PATH = './mocks/server.proto';
const CHAT_SCHEMA_PATH = './mocks/chat.proto';

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

describe('server streaming', async () => {
  const PORT = 50053;
  const proto = define([{ path: schema(SERVER_SCHEMA_PATH) },]);

  const api = {
    server: {
      ServerService: {
        messages(call) {
          ["hi", "hello", "hey"]
            .forEach(message => void call.write({ message: Buffer.from(message) }));
          call.end();
        }
      },
    },
  };

  const { start, stop } = server({ port: PORT });
  await start(merge(proto, api));

  const schemas = client({ port: PORT, proto, promisify: false });
  const ClientService = schemas('server', 'ServerService');
  const call = ClientService.messages({ id: 1 });
  const chunks = [];
  call.on("data", ({ message }) => chunks.push(message));
  call.on("end", () => {
    assert.strictEqual(Buffer.concat(chunks).toString(), "hihellohey");
    stop(0);
  });
});

describe('bidirectional stream', async () => {
  const PORT = 50054;
  const proto = define([{ path: schema(CHAT_SCHEMA_PATH) },]);

  const api = {
    chat: {
      ChatService: {
        echo(call) {
          call.on("data", ({ message }) => {
            call.write({ message: Buffer.from(`echo: ${message}`) });
          });
          call.on("end", () => call.end());
        }
      },
    },
  };

  const { start, stop } = server({ port: PORT });
  await start(merge(proto, api));

  const schemas = client({ port: PORT, proto, promisify: false });
  const ChatService = schemas('chat', 'ChatService');
  const call = ChatService.echo();
  const messages = [];
  call.on("data", ({ message }) => {
    messages.push(message.toString());
    if (messages.length === 2) {
      assert.deepStrictEqual(messages, ["echo: message 0", "echo: message 1000"]);
      call.end();
    }
  });
  call.on('end', () => {
    stop(0);
  })
  call.write({ message: Buffer.from("message 0") });
  setTimeout(() => {
    call.write({ message: Buffer.from("message 1000") });
  }, 1000);
});
