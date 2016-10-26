'use strict';

const zmq        = require('zmq');
const CO         = require('co');
const Context    = require('./context');
const Channel    = require('chan');

function Socket(type, name, numWorkers){
	this.socket_type = type;
	this.socket_name = name;
	this.rcvMiddleware = [];
	this.sndMiddleware = [];
	this.socket = zmq.socket(type);
	this.ch = Channel();
	zmq_setup.call(this, numWorkers ? numWorkers : 1);
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
	let context = new Context();
	context.message = message ? message : {};
	context.meta = meta ? meta : {};
	context.state = {};
	context.socket = this;
	return context;
}

function zmq_setup(numWorkers){
	let self = this;

	let logPrepend = `'${self.socket_name}' (${self.socket_type}):`;

	// Register to monitoring events
	self.socket.on('connect',       function(fd, ep) {console.log(logPrepend, 'connect, endpoint:',       ep);});
	self.socket.on('connect_delay', function(fd, ep) {console.log(logPrepend, 'connect_delay, endpoint:', ep);});
	self.socket.on('connect_retry', function(fd, ep) {console.log(logPrepend, 'connect_retry, endpoint:', ep);});
	self.socket.on('listen',        function(fd, ep) {console.log(logPrepend, 'listen, endpoint:',        ep);});
	self.socket.on('bind_error',    function(fd, ep) {console.log(logPrepend, 'bind_error, endpoint:',    ep);});
	self.socket.on('accept',        function(fd, ep) {console.log(logPrepend, 'accept, endpoint:',        ep);});
	self.socket.on('accept_error',  function(fd, ep) {console.log(logPrepend, 'accept_error, endpoint:',  ep);});
	self.socket.on('close',         function(fd, ep) {console.log(logPrepend, 'close, endpoint:',         ep);});
	self.socket.on('close_error',   function(fd, ep) {console.log(logPrepend, 'close_error, endpoint:',   ep);});
	self.socket.on('disconnect',    function(fd, ep) {console.log(logPrepend, 'disconnect, endpoint:',    ep);});

	// Handle monitor error
	self.socket.on('monitor_error', function(err) {
	    console.log(logPrepend, 'Error in monitoring: %s, will restart monitoring in 5 seconds', err);
	    setTimeout(function() { self.socket.monitor(500, 0); }, 5000);
	});

	self.socket.on('message', function(buffer){
		self.ch(buffer)(function (err) {
			if (err) {
				console.error(logPrepend, "error queueing message", err);	
			}
		});
	});

	let handleMessageBound = handleMessage.bind(self);

	function startWorker(){
		CO(function* (){
			while(true){
				let buffer = yield self.ch;
				if(buffer){
					yield handleMessageBound(buffer);
				}
			}
		}).catch(function(err){
			console.error(logPrepend, "restarting socket's worker", err);
			startWorker();
		})
	}
	while(numWorkers--){
		startWorker();
	}

	self.socket.monitor(500, 0);
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
	this.socket.send(JSON.stringify(ctx.message));
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

Socket.prototype.channelStats = function(){
	let chan = this.ch.__chan;
	return {
		items: chan.items.length,
		pendingAdds: chan.pendingAdds.length,
		pendingGets: chan.pendingGets.length
	}
}
