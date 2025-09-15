# gRPC

## Wrapper around gRPC, provides essentials like:
- Creating server more convenient way
- Stop/Start async methods for more rich bootstrap and graceful shutdown
- Creating client with defined proto
- Convenient proto definition
- Convenient merge between proto and implementation
- Async/await client/server methods instead of errback (callback last error first)


## Example - Client / Server communication
```js
  /* proto */
  `syntax = "proto3";
  
  message UserRequest {
    string name = 1;
    uint32 age = 2;
  }

  message UserResponse {
    string content = 1;
  }

  service UserService {
    rpc echo(UserRequest) returns (UserResponse);
  }`

  /* define proto */
  const proto = define([{ path: schema('your path to user.proto') },]);

  /* 
    define proto implementation, 
    callbackifyApi allows you to write async/await syntax instead of callbacks
  */
  const api = {
    user: {
      UserService: callbackifyApi({
        async echo(call) {
          return { content: `name: ${call.request.name}, age: ${call.request.age}` };
        }
      }),
    },
  };

  /*merge api signature with api implementation for the server to run*/
  const services = merge(proto, api);

  /*create/start server with services*/
  const { start, stop } = server();
  await start(services);

  /*
    create client with the same proto
    don't forget to share .proto schemas with your client(s)
  */
  const schemas = client({ proto });
  /*
   choose interface(user), service(UserService), procedure (UserService.echo) to run
   this syntax allows flexible client creation with .bind
   you can for example const iUser = schemas.bind(null, 'user');
  */
  const UserService = schemas('user', 'UserService');

  /*invoke method with parameters according to .proto schema*/
  const res = await UserService.echo({ name: 'sora', age: 42069 });

  /*graceful shutdown*/
  const exit = async (code, details) => {
    await stop();
    console.log('Graceful shutdown', { code, details });
    process.exit(code);
  };
  process.on("SIGINT", exit.bind(null, 0));
  process.on("uncaughtException", exit.bind(null, 1));
```


## Example - Client streaming to server
**here we need access to callback in server the method**
**and 'call' stream as client so we don't use async/await here**

```js
  /* proto */
  `syntax = "proto3";

  message UserRequest {
    string name = 1;
    uint32 age = 2;
  }

  message UserResponse {
    string content = 1;
  }

  service UserService {
    rpc echo(UserRequest) returns (UserResponse);
  }`

  const CLIENT_SCHEMA_PATH = '';
  const PORT = 50052;
  const proto = define([{ path: schema('your path to client.proto') },]);

  const api = {
    client: {
      ClientService: {
         /*we don't use callbackify api here*/
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
  /*promisify false to use old syntax for streams*/
  const schemas = client({ port: PORT, proto, promisify: false });
  const ClientService = schemas('client', 'ClientService');
  const call = ClientService.UploadData((error, res) => {
    if (error) console.error(res);
    else console.log(res);
  });
  call.write({ chunk: Buffer.from('1') });
  call.write({ chunk: Buffer.from('2') });
  call.write({ chunk: Buffer.from('3') });
  call.end();
```

## Example Server streaming to Client

```js
  /*proto */
  `syntax = "proto3";

  message Data {
    bytes message = 1;
  }

  message Upload {
    uint32 id = 1;
  }

  service ServerService {
    rpc messages(Upload) returns (stream Data);
  }`
  const PORT = 50053;
  const proto = define([{ path: schema('your path to server.proto') },]);

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
  call.on("end", () => void console.log(Buffer.concat(chunks).toString()));
```