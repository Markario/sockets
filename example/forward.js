'use strict';

const Sockets   = require('../lib/');
const CO        = require('co');

module.exports = function(pullAddr, pushAddr){
	let app = new Sockets.App();

	let pull = app.pull('Pull then Forward Socket');
	let push = app.push("Forward Socket");

	//Log stats on received messages every 1000 messages or 100 batches of messages
	pull.use_rcv(pull.logBatches({messages: 1000, batches: 100, prepend: "Forward", timestamp: true}));

	//Log the queue size at most every 10ms
	pull.use_rcv(pull.logQueueSize({throttlems: 10, prepend: "Forward", timestamp: true})); 

	pull.use_rcv(function* (next){
		let ctx = this;
		let now = Date.now();
		ctx.message.forward = {
			pull: {
				received: now,
				message: "Forward module received this message on its Pull socket at " + now,
				diff: now - ctx.message.push.sent
			}
		}
		yield next;
	});

	//Send the message received on the Pull Socket to the Push Socket
	pull.use_rcv(push.forwardOn());

	push.use_snd(function* (next){
		let ctx = this;
		let now = Date.now();
		if(!ctx.message.forward)
			ctx.message.forward = {}
		ctx.message.forward.push = {
			sent: now,
			message: "Forward module sent this message on its Push socket at " + now,
			diff: now - ctx.message.forward.pull.received
		}
		yield next;
	});

	pull.connect(pullAddr);
	push.connect(pushAddr);
}