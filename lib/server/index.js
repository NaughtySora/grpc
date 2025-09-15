'use strict';

const { Server, ServerCredentials } = require('@grpc/grpc-js');
const { HOST, PORT, url } = require('../util');
const { createInsecure, createSsl } = ServerCredentials;

module.exports = (options = {}) => {
  const { port = PORT, host = HOST,
    logger = console, serverOptions, ssl } = options;
  let server = null;
  let stopping = false;
  const URL = url(host, port);
  const SERVER_INFO = `gRPC server on ${URL}`;
  const onBind = error => {
    if (error) logger.error(`${SERVER_INFO} has binding failed`, error);
    else logger.log(`${SERVER_INFO} has started`);
  };
  return {
    async start(services = []) {
      server = new Server(serverOptions);
      for (const service of services) {
        server.addService(service.signature, service.impl);
      }
      const tunnel = ssl !== undefined ? createSsl(ssl) : createInsecure();
      server.bindAsync(URL, tunnel, onBind);
    },
    stop(ms = 5000) {
      const { promise, resolve } = Promise.withResolvers();
      if (stopping || server === null) return void resolve();
      stopping = true;
      const log = logger.log.bind(null, `${SERVER_INFO} has shutdown`);
      let timer = setTimeout(() => {
        if (server === null) return;
        server.forceShutdown();
        server = null;
        log();
        resolve();
      }, ms);
      server.tryShutdown(error => {
        if (error) logger.error(`${SERVER_INFO} has errored`, error);
        timer[Symbol.dispose]();
        if (server !== null) {
          log();
          server = null;
        }
        resolve();
      });
      return promise;
    },
  };
};
