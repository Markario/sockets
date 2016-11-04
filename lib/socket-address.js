'use strict';

const _ = require('lodash');

function SocketAddress(protocol, host, port){
	this.protocol = protocol;
	this.host = host;
	this.port = port;
}

SocketAddress.prototype.toString = function(){
	let self = this;
	return `${self.protocol}://${self.host}:${self.port}`;
}

module.exports = SocketAddress;