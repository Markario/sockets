'use strict';

const _ = require('lodash');

function Context(){
}

Context.prototype.inspect = Context.prototype.toJSON = function(){
	return _.pick(this, [
		'message',
		'state'
	]);
}

module.exports = Context;