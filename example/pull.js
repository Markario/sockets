'use strict';

const Sockets   = require('../lib/');
const CO        = require('co');

module.exports = function(address){
	let app = new Sockets.App();

	let pull = app.pull('Pull Socket');

	//Log stats on received messages every 100 messages or 100 batches of messages
	pull.use_rcv(pull.logBatches({messages: 100, batches: 100, prepend: "Sink", timestamp: true}));

	//Log the queue size at most every 10ms
	pull.use_rcv(pull.logQueueSize({throttlems: 10, prepend: "Sink", timestamp: true})); 

	pull.use_rcv(function* (next){
		let ctx = this;
		let now = Date.now();
		ctx.message.pull = {
			received: now,
			message: "Pull module received this message on its Pull socket at " + now,
			diff: now - ctx.message.forward.push.sent,
			totalTime: now - ctx.message.push.sent
		}
		yield next;
	});

	pull.use_rcv(function* (next){
		console.log("%s Sink: Received message: %s", Date.now(), JSON.stringify(this.message));
		yield next;
	});

	pull.bind(address);
}