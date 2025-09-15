# gRPC

## Wrapper around gRPC, provides essentials like:
- Creating server more convenient way
- Stop/Start async methods for more rich bootstrap and graceful shutdown
- Creating client with defined proto
- Convenient proto definition
- Convenient merge between proto and implementation
- Async/await client/server methods instead of errback (callback last error first)


## Example 
```js
  /* define proto */
  const proto = define([{ path: schema('./mocks/user.proto') },]);

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