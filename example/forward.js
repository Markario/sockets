'use strict';

const App       = require('../lib/app');
const CO        = require('co');

module.exports = function(address, faddress){
	let app = App();

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

	push.use_snd(function* (){

	});

	pull.use_rcv(push.forwardOn());

	pull.connect(address);
	push.connect(faddress);
}