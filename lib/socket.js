'use strict';

const zmq    = require('zmq');
const CO     = require('co');

function Socket(type, name){
	console.log("new socket", type, name);
	this.socket_type = type;
	this.socket_name = name;
	this.rcvMiddleware = [];
	this.sndMiddleware = [];
	this.socket = zmq.socket(type);
	zmq_setup.call(this);
	return this;
}

module.exports = Socket;

function compose(middleware){
	return function* (next){
		if (!next) next = function*(){};
		var i = middleware.length;
		while (i--) {
			next = middleware[i].call(this, next);
		}
		return yield *next;
	}
}

function createContext(message){
	return {iIsContext: true, message: message};
}

function zmq_setup(){
	console.log("setup onmessage");
	let self = this;
	self.socket.on('message', function(buffer){
		CO(function* (){
			console.log("on message");
			let message = buffer.toString();
			try{
				JSON.parse(buffer.toString());
			}catch(e){};
			let ctx = createContext(message);
			console.log("ctx",ctx);
			let middleware = compose.call(ctx, self.rcvMiddleware);
			yield middleware;
			console.log("Receive middleware executed", arguments);
		});
	});
}

Socket.prototype.createContext = createContext;

Socket.prototype.bind = function(address){
	this.socket.bindSync(address);
}

Socket.prototype.connect = function(address){
	this.socket.connect(address);
}

Socket.prototype.use_rcv = function(fn){
	this.rcvMiddleware.push(fn);
	return this;
}
Socket.prototype.use_snd = function(fn){
	this.sndMiddleware.push(fn);
	return this;
}

Socket.prototype.send = function* (ctx, next){
	console.log("Send", ctx, next);
	let middleware = compose.call(ctx, this.sndMiddleware);
	yield middleware;
	console.log("Send middlware executed", arguments);
	this.socket.send("some message");
	if(next)
		yield next;
}