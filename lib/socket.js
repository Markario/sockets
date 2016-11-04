'use strict';

const zmq        = require('zmq');
const CO         = require('co');
const Context    = require('./context');
const Channel    = require('chan');
const _          = require('lodash');

const defaults = {
	monitor: false,
	numWorkers: 1
}

function Socket(type, name, options){
	options = _.defaultsDeep(options, defaults);
	this.socket_type = type;
	this.socket_name = name;
	if(!this.socket_name){
		this.socket_name = _.capitalize(type) + " Socket";
	}
	this.rcvMiddleware = [];
	this.sndMiddleware = [];
	this.socket = zmq.socket(type);
	this.ch = Channel();
	this.logPrepend = `'${this.socket_name}' (${this.socket_type}):`;
	setupZmq(this, options);
	setupWorkers(this, options);
	return this;
}

function setupZmq(self, options){
	let logPrepend = self.logPrepend;
	let socket = self.socket;

	// Register to monitoring events
	socket.on('connect',       function(fd, ep) {console.log(logPrepend, 'connect, endpoint:',       ep);});
	socket.on('connect_delay', function(fd, ep) {console.log(logPrepend, 'connect_delay, endpoint:', ep);});
	socket.on('connect_retry', function(fd, ep) {console.log(logPrepend, 'connect_retry, endpoint:', ep);});
	socket.on('listen',        function(fd, ep) {console.log(logPrepend, 'listen, endpoint:',        ep);});
	socket.on('bind_error',    function(fd, ep) {console.log(logPrepend, 'bind_error, endpoint:',    ep);});
	socket.on('accept',        function(fd, ep) {console.log(logPrepend, 'accept, endpoint:',        ep);});
	socket.on('accept_error',  function(fd, ep) {console.log(logPrepend, 'accept_error, endpoint:',  ep);});
	socket.on('close',         function(fd, ep) {console.log(logPrepend, 'close, endpoint:',         ep);});
	socket.on('close_error',   function(fd, ep) {console.log(logPrepend, 'close_error, endpoint:',   ep);});
	socket.on('disconnect',    function(fd, ep) {console.log(logPrepend, 'disconnect, endpoint:',    ep);});

	// Handle monitor error
	socket.on('monitor_error', function(err) {
	    console.log(logPrepend, 'Error in monitoring: %s, will restart monitoring in 5 seconds', err);
	    setTimeout(() => socket.monitor(500, 0), 5000);
	});

	socket.on('message', function(buffer){
		self.ch(buffer)((err) => {
			if (err) console.error(logPrepend, "error queueing message", err);
		});
	});

	if(options.monitor){
		socket.monitor(500, 0);	
	}
}

function setupWorkers(self, options){	
	var worker = CO.wrap(function* (id){
		let message = yield self.yieldMessage();
		if(message) yield self.handleMessage(message, id);
	});

	let numWorkers = options.numWorkers;
	while(numWorkers--) startWorker(numWorkers);

	function startWorker(id){
		//setImmediate will postpone the next iteration of work until after the next event tick. Do not replace with process.nextTick.
		//https://github.com/nodejs/node/blob/master/doc/topics/event-loop-timers-and-nexttick.md#processnexttick-vs-setimmediate
		worker(id).then(() => setImmediate(startWorker, id), (err) => { console.error("Error while running handleMessage worker", err); setImmediate(startWorker, id); });
	}
}

function makePrepend(options){
	let hasPrepend = options.prepend && options.prepend.length > 0;
	let prepend = [];
	if(options.timestamp) prepend.push(Date.now());
	if(hasPrepend) prepend.push(options.prepend);
	prepend = prepend.join(" ");
	if(prepend.length > 0) prepend = prepend + ": ";
	return prepend;
}

///////////////
// Prototype //
///////////////

Socket.prototype.createContext = function(message){
	let context = new Context();
	context.message = message ? message : {};
	context.state = {};
	context.socket = this;
	return context;
};

Socket.prototype.bind = function(address){
	this.socket.bindSync(address.toString());
}

Socket.prototype.unbind = function(address){
	this.socket.unbindSync(address.toString());
}

Socket.prototype.connect = function(address){
	this.socket.connect(address.toString());
}

Socket.prototype.disconnect = function(address){
	this.socket.disconnect(address.toString());
}

Socket.prototype.use_rcv = function(fn){
	this.rcvMiddleware.push(fn);
	return this;
}
Socket.prototype.use_snd = function(fn){
	this.sndMiddleware.push(fn);
	return this;
}

Socket.prototype.compose = function(ctx, middleware){
	return function* (next){
		if (!next) next = function*(){};
		var i = middleware.length;
		while (i--) {
			next = middleware[i].call(ctx, next);
		}
		return yield next;
	}
}

Socket.prototype.checkHealth = function(){	
	let numBatch = this.numBatch || 0;
	let oldQueued = this.oldQueued || 0;
	let receivedTime = this.receivedTime || null;
	let totalQueued = this.getQueueCount();

	let healthItems = {queue: totalQueued};
	if(totalQueued > oldQueued){
		//A new batch
		let now = Date.now();
		let newMessages = totalQueued - oldQueued;
		healthItems.new_batch = {
			numBatch: newMessages, 
			receivedTime: now, 
			batchSizeDiff: (newMessages - numBatch)
		};

		if(receivedTime && numBatch){
			//had a previous batch
			healthItems.last_batch = { numBatch, receivedTime };
		}
		this.receivedTime = now;
		this.numBatch = newMessages;
	}
	this.oldQueued = totalQueued;
	return healthItems;
}

Socket.prototype.yieldMessage = function* (){
	let buffer = yield this.ch;
	if(!buffer) return null;
	let message = buffer.toString();
	try{message = JSON.parse(message);}catch(e){};
	return message;
}

Socket.prototype.getQueueCount = function(){
	let chan = this.ch.__chan;
	return chan.items.length + chan.pendingAdds.length;
}

Socket.prototype.handleMessage = function* (message, workerID){
	let ctx = this.createContext(message, {received: Date.now()});
	ctx.health = this.checkHealth();
	ctx.worker = workerID;
	let middleware = this.compose(ctx, this.rcvMiddleware);
	yield middleware;
}

Socket.prototype.send = function* (ctx){
	let middleware = this.compose(ctx, this.sndMiddleware);
	yield middleware;
	this.socket.send(JSON.stringify(ctx.message));
}

Socket.prototype.forwardOn = function(){
	let self = this;
	return function* (next){
		let ctx = this;
		yield self.send(ctx);
		yield next;
	}
}

Socket.prototype.logQueueSize =  function(options){
	options = _.defaultsDeep(options, {throttlems: 1000, prepend: null, timestamp: false});
	let throttle = _.throttle(function(log){console.log(log);}, options.throttlems);
	return function* (next){
		let queue = this.socket.getQueueCount();
		let prepend = makePrepend(options);
		throttle(`${prepend}Queue: ${queue};`);
		yield next;
	};
}

Socket.prototype.logBatches = function(options){
	options = _.defaultsDeep(options, {messages: 1000, batches: 100, prepend: null, timestamp: false});
	let batches = 0;
	let messages = 0;
	let time = Date.now();
	return function* (next){
		let health = this.health;
		if(this.health.new_batch){
			batches ++;
			messages += this.health.new_batch.numBatch;
			if(messages >= options.messages || batches >= options.batches){
				let now = Date.now();
				let seconds = (now - time)/1000;
				console.log("%sBatches: %d; Messages: %d; Seconds: %s", makePrepend(options), batches, messages, seconds);
				messages = batches = 0;
				time = now;
			}
		}
		yield next;
	};
}

module.exports = Socket;
