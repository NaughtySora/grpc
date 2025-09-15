'use strict';

const { credentials } = require('@grpc/grpc-js');
const { url, PORT, HOST } = require('../util');
const { createInsecure, createSsl } = credentials;

module.exports = (options = {}) => {
  const { port = PORT, host = HOST, proto,
    ssl, promisify = true } = options;
  if (typeof proto === undefined) {
    throw new Error("Proto is required for gRPC client");
  }
  const URL = url(host, port);
  const lazy = {};
  return (key, schema) => {
    if (!Object.hasOwn(proto, key)) {
      throw new Error(`Proto doesn't have key ${key}`);
    }
    const category = lazy[key] ??= {};
    const service = category[schema];
    if (service !== undefined) return service;
    if (!Object.hasOwn(proto[key], schema)) {
      throw new Error(`Proto category ${key} doesn't have schema ${schema}`);
    }
    const tunnel = ssl !== undefined ? createSsl(ssl) : createInsecure();
    const api = new proto[key][schema](URL, tunnel);
    if (promisify) {
      for (const key in api) {
        const fn = api[key];
        api[key] = (...args) =>
          new Promise((resolve, reject) => void
            fn.call(api, ...args, (err, data) =>
              err ? reject(err) : resolve(data)));
      }
    }
    return category[schema] = api;
  }
};

