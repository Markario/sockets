'use strict';

const Sockets   = require('../lib/').App;
const Util      = require('../lib/').Util;
const CO        = require('co');

module.exports = function(address, faddress){
	let app = Sockets();

	let pull = app.pull('Pull then Forward Socket');
	let push = app.push("Forward Socket");

	pull.use_rcv(function* (next){
		console.log("Forward 1", this);
		yield next;
		console.log("Forward 6", this);
	});

	pull.use_rcv(function* (next){
		console.log("Forward 2", this);
		yield next;
		console.log("Forward 5", this);
	});

	pull.use_rcv(function* (next){
		console.log("Forward 3", this);
		yield next;
		console.log("Forward 4", this);
	});

	pull.use_rcv(push.forwardOn());

	pull.connect(Util.connectAddr(address));
	push.connect(Util.connectAddr(faddress));
}