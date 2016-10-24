'use strict';

const App       = require('../lib/app');
const CO        = require('co');

module.exports = function(address){
	let app = App();

	let pull = app.socket('pull','Pull Socket');

	pull.use_rcv(function* (next){
		console.log("Pull 1");
		yield next;
		console.log("Pull 6");
	});

	pull.use_rcv(function* (next){
		console.log("Pull 2");
		yield next;
		console.log("Pull 5");
	});

	pull.use_rcv(function* (next){
		console.log("Pull 3");
		yield next;
		console.log("Pull 4");
	});

	pull.connect(address);
}