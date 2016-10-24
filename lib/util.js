'use strict';

const _ = require('lodash');

module.exports.bindAddr = function(addr){
	if(_.isString(addr)){
		return addr;
	}
	return `${addr.protocol}://${addr.bindHost}:${addr.port}`;
}

module.exports.connectAddr = function(addr){
	if(_.isString(addr)){
		return addr;
	}
	return `${addr.protocol}://${addr.host}:${addr.port}`;
}