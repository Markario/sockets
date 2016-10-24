'use strict';

const App       = require('../lib/app');
const CO        = require('co');

module.exports = function(address){
	let app = App();

	let push = app.socket('push','Push Socket');

	push.use_snd(function* (next){
		console.log("Push 1");
		yield next;
		console.log("Push 6");
	});

	push.use_snd(function* (next){
		console.log("Push 2");
		yield next;
		console.log("Push 5");
	});

	push.use_snd(function* (next){
		console.log("Push 3");
		yield next;
		console.log("Push 4");
	});


	push.bind(address);

	CO(function* (){
		console.log("Send some stuff");
		yield push.send(push.createContext({some: "message"}));
		yield push.send(push.createContext({some: "message"}), function* (){
			console.log("Some next after send");
		});
	});
}