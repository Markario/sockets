'use strict';

const Sockets   = require('../lib/').App;
const Util      = require('../lib/').Util;
const CO        = require('co');

module.exports = function(address){
	let app = Sockets();

	let push = app.push('Push Socket'); //or app.socket("push", "Push Socket");

	push.use_snd(function* (next){
		console.log("Push 1", this);
		yield next;
		console.log("Push 6", this);
	});

	push.use_snd(function* (next){
		console.log("Push 2", this);
		yield next;
		console.log("Push 5");
	});

	push.use_snd(function* (next){
		console.log("Push 3", this);
		yield next;
		console.log("Push 4", this);
	});

	push.bind(Util.bindAddr(address));

	CO(function* (){
		console.log("Send some stuff");
		yield push.send(push.createContext({some: "message"}));
		yield push.send(push.createContext({some: "message"}), function* (){
			console.log("Some next after send");
		});
	});
}