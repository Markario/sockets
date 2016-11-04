'use strict';

const Sockets   = require('../lib/').App;
const CO        = require('co');

let app = Sockets();
let push = app.push('Push Socket', {numWorkers: 2, monitor: false});

module.exports = function(address){
	setup(address);
	startSending();
}

function setup(address){

	push.use_snd(function* (next){
		let ctx = this;
		let now = Date.now();
		ctx.message.push = {
			sent: now,
			message: "Push module sent this message on its Push socket at " + now
		}
		yield next;
	});

	push.use_snd(function* (next){
		let ctx = this;
		ctx.meta.shouldManipulate = Math.random() > .5;
		ctx.state.validate = true;
		yield next;
	});

	push.use_snd(function* (next){
		let ctx = this;
		if(ctx.meta.shouldManipulate){
			ctx.message.manipulated = ctx.message.id + " was manipulated before sending.";
		}
		yield next;
	});

	push.use_snd(function* (next){
		let ctx = this;
		console.log("%s Push: Sending message %s", Date.now(), JSON.stringify(ctx.message));
		yield next;
	});

	push.bind(address);
}

function startSending(){
	CO(function* (){
		console.log("%s Push: Waiting 2 seconds before starting.", Date.now());
		yield wait("2000");
		console.log("%s Push: Starting.", Date.now());

		let messages = 0;
		while(messages < 1000){
			let numToSend = Math.abs(Math.round(Math.random() * 99)) + 1;
			let remain = numToSend;
			while(remain--){
				let message = {
					message: "Message sent by Push socket", 
					id: messages++
				};
				let ctx = push.createContext(message);
				yield push.send(ctx);
			}
			console.log("%s Push: Queued: %d messages. Total messages: %d", Date.now(), numToSend, messages);
			yield wait(Math.abs(Math.round(Math.random() * 99)) + 1);
		}
	});
}

function wait(timeout){
	return new Promise(function(resolve, reject){
		setTimeout(function(){
			resolve();
		}, timeout);
	});
}