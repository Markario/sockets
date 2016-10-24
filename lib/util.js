'use strict';

module.exports.bindAddr = function(addr){
	return `${addr.protocol}://${addr.bindHost}:${addr.port}`;
}

module.exports.connectAddr = function(addr){
	return `${addr.protocol}://${addr.host}:${addr.port}`;
}