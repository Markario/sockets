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
	let ctx = this;
	return function* (next){
		if (!next) next = function*(){};
		var i = middleware.length;
		while (i--) {
			next = middleware[i].call(ctx, next);
		}
		return yield next;
	}
}

function createContext(message, meta){
	return {message: message, meta: meta};
}

function zmq_setup(){
	let self = this;
	self.socket.on('message', function(buffer){
		CO(function* (){
			yield handleMessage.call(self, buffer);
		});
	});
}

function* handleMessage(buffer){
	let message = buffer.toString();
	try{message = JSON.parse(message);}catch(e){};
	let ctx = createContext(message, {received: Date.now()});
	let middleware = compose.call(ctx, this.rcvMiddleware);
	yield middleware;
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

function* send(ctx){
	let middleware = compose.call(ctx, this.sndMiddleware);
	yield middleware;
	this.socket.send(ctx.message);
}

Socket.prototype.send = send;

function forwardOn(){
	let self = this;
	return function* (next){
		let ctx = this;
		yield self.send(ctx);
		yield next;
	}
}

Socket.prototype.forwardOn = forwardOn;