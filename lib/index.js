'use strict';

let Lib = {};

Lib.App     = require('./app');
Lib.Socket  = require('./socket');
Lib.Address = Lib.SocketAddress = require('./socket-address');

module.exports = Lib;