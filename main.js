'use strict';

const client = require("./lib/client/index.js");
const server = require("./lib/server/index.js");
const utils = require("./lib/util/index.js");

module.exports = {
  ...utils,
  client,
  server
};
