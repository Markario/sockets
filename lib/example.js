'use strict';

const App       = require('./app');
const CO        = require('co');

let app = App();

let push = app.socket('push','Push Socket');
let pull = app.socket('pull','Pull Socket');

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

push.bind("tcp://*:5555");
pull.connect("tcp://localhost:5555");

console.log("Done setting up");

CO(function* (){
	console.log("Send some stuff");
	yield push.send(push.createContext({some: "message"}));
	yield push.send(push.createContext({some: "message"}), function* (){
		console.log("Some next after send");
	});
});