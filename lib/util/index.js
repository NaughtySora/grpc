'use strict';

const { loadSync } = require('@grpc/proto-loader');
const { loadPackageDefinition } = require('@grpc/grpc-js');

const callbackify = fn => (...args) => {
  const last = args.length - 1;
  const callback = args[last];
  fn(...args.slice(0, last))
    .then(callback.bind(null, null), callback);
};

const callbackifyApi = api => {
  const result = {};
  for (const entry of Object.entries(api)) {
    result[entry[0]] = callbackify(entry[1]);
  }
  return result;
};

const merge = (proto, api) => {
  const result = [];
  for (const schema of Object.entries(api)) {
    const category = proto[schema[0]];
    for (const entry of Object.entries(schema[1])) {
      const signature = category?.[entry[0]]?.service;
      if (signature === undefined) continue;
      result.push({ signature, impl: entry[1] });
    }
  }
  return result;
};

const DEFAULT_PROTO_OPTIONS = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

const NAME_REGEXP = /\\(?<name>[^\\]+)\.proto$/;

const define = routes => {
  const definitions = {};
  for (const { path, options = DEFAULT_PROTO_OPTIONS } of routes) {
    const match = path.match(NAME_REGEXP);
    const name = match?.groups?.name;
    if (name === undefined) {
      throw new Error('Wrong path format, requires to be [module name].proto');
    }
    definitions[name] = loadPackageDefinition(loadSync(path, options));
  }
  return definitions;
};

const url = (host, port) => `${host}:${port}`;

const PORT = 50051;
const HOST = 'localhost';

module.exports = {
  callbackify,
  callbackifyApi,
  merge,
  define,
  url,
  PORT,
  HOST,
};