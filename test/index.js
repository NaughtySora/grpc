const define = require('../define_proto/index.js');
const path = require('node:path');
const client = require('./index.js');

const findService = (filePath) => path.resolve(__dirname, filePath);
const services = [
  { path: findService('../server/mocks/user.proto') },
];
const proto = define(services);
const schemas = client({ proto });
const UserService = schemas('user', 'UserService');

(async () => {
  const res = await UserService.echo({ name: 'hi!', age: 22 });
  console.log(res);
})();

// const grpc = require('./index.js');
// const define = require('../define_proto/index.js');
// const path = require('node:path');

// const { callbackifyApi } = require('../callbackifyApi/index.js');
// const merge = require('../merge/index.js');

// const findService = (filePath) => path.resolve(__dirname, filePath);

// const services = [
//   { path: findService('./mocks/user.proto') },
// ];

// const proto = define(services);

// const api = {
//   user: {
//     UserService: callbackifyApi({
//       async echo(call) {
//         return { content: `name: ${call.request.name}, age: ${call.request.age}` };
//       }
//     }),
//   }
// };

// const main = async () => {
//   const { start, stop } = grpc();
//   await start(merge(proto, api));
//   const exit = async (code, details) => {
//     await stop();
//     console.log('Graceful shutdown', { code, details });
//     process.exit(code)
//   };
//   process.on("SIGINT", exit.bind(null, 0));
//   process.on("uncaughtException", exit.bind(null, 1));


// };

// main();

