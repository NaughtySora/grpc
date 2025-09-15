'use strict';

const { credentials } = require('@grpc/grpc-js');
const { url, PORT, HOST } = require('../util');
const { createInsecure, createSsl } = credentials;

module.exports = ({ port = PORT, host = HOST, proto, ssl } = {}) => {
  if (typeof proto === undefined) {
    throw new Error("Proto is required for gRPC client");
  }
  const URL = url(host, port);
  const lazy = {};
  return (key, schema) => {
    if (!Object.hasOwn(proto, key)) {
      throw new Error(`proto doesn't have key ${key}`);
    }
    const category = lazy[key] ??= {};
    const service = category[schema];
    if (service !== undefined) return service;
    if (!Object.hasOwn(proto[key], schema)) {
      throw new Error(`proto category ${key} doesn't have schema ${schema}`);
    }
    const tunnel = ssl !== undefined ? createSsl(ssl) : createInsecure();
    const api = new proto[key][schema](URL, tunnel);
    for (const key in api) {
      const fn = api[key];
      api[key] = (...args) =>
        new Promise((resolve, reject) => void
          fn.call(api, ...args, (err, data) =>
            err ? reject(err) : resolve(data)));
    }
    return category[schema] = api;
  }
};

