const { define, callbackify, callbackifyApi, merge, url } = require('./lib/util');
const { describe, it } = require('node:test');
const { resolve } = require('node:path');
const { async, array } = require('naughty-util');
const client = require('./lib/client');
const server = require('./lib/server');
const assert = require('node:assert');

const schema = path => resolve(__dirname, path);
