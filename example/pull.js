'use strict';

const Sockets   = require('../lib/').App;
const Util      = require('../lib/').Util;
const CO        = require('co');

module.exports = function(address){
	let app = Sockets();

	let pull = app.pull('Pull Socket');

	pull.use_rcv(function* (next){
		console.log("Pull 1", this);
		yield next;
		console.log("Pull 6", this);
	});

	pull.use_rcv(function* (next){
		console.log("Pull 2", this);
		yield next;
		console.log("Pull 5", this);
	});

	pull.use_rcv(function* (next){
		console.log("Pull 3", this);
		yield next;
		console.log("Pull 4", this);
	});

	pull.bind(Util.bindAddr(address));
}