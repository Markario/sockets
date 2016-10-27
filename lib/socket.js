'use strict';

const zmq        = require('zmq');
const CO         = require('co');
const Context    = require('./context');
const Channel    = require('chan');
const _          = require('lodash');

const defaults = {
	monitor: false,
	numWorkers: 1,
	manualFlushThrottle: null
}

function Socket(type, name, options){
	options = _.defaultsDeep(options, defaults);
	this.socket_type = type;
	this.socket_name = name;
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
		self.ch(buffer)(function (err) {
			if (err) {
				console.error(logPrepend, "error queueing message", err);	
			}
		});
	});

	if(options.monitor){
		socket.monitor(500, 0);	
	}
}

function setupWorkers(self, options){
	if(options.manualFlush !== null){
		//Guarantees that, while under load, we have an accurate queue size every options.manualFlush ms.
		//Otherwise, while under load, socket.on('message') may not get executed until the queue reaches zero and the socket finally flushes reads/writes
		let manualFlush = _.throttle(self.flush.bind(self), options.manualFlush);
		var worker = CO.wrap(function* (){
			let buffer = yield self.ch;
			if(buffer) yield self.handleMessage(buffer);
			manualFlush();
		});
	}else{
		var worker = CO.wrap(function* (){
			let buffer = yield self.ch;
			if(buffer) yield self.handleMessage(buffer);
		});
	}

	let numWorkers = options.numWorkers;
	while(numWorkers--) startWorker();

	function startWorker(){
		worker().then(startWorker, (err) => { console.error("Error while running handleMessage worker", err); startWorker(); });
	}
}

///////////////
// Prototype //
///////////////

Socket.prototype.createContext = function(message, meta){
	let context = new Context();
	context.message = message ? message : {};
	context.meta = meta ? meta : {};
	context.state = {};
	context.socket = this;
	return context;
};

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

Socket.prototype.flush = function(){
	this.socket.resume();
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
	let chan = this.ch.__chan;
	let totalQueued = chan.items.length + chan.pendingAdds.length;

	let healthItems = {queue: totalQueued};
	if(totalQueued > oldQueued){
		//A new batch
		let now = Date.now();
		let newEvents = totalQueued - oldQueued;
		healthItems.new_batch = {
			numBatch: newEvents, 
			receivedTime: now, 
			batchSizeDiff: (newEvents - numBatch)
		};

		if(receivedTime && numBatch){
			//had a previous batch
			healthItems.last_batch = { numBatch, receivedTime };
		}
		this.receivedTime = now;
		this.numBatch = newEvents;
	}
	this.oldQueued = totalQueued;
	return healthItems;
}

Socket.prototype.handleMessage = function* (buffer){
	let message = buffer.toString();
	try{message = JSON.parse(message);}catch(e){};
	let ctx = this.createContext(message, {received: Date.now()});
	ctx.health = this.checkHealth();
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

Socket.prototype.logQueueSize =  function(throttleTime){
	let throttle = _.throttle(function(log){console.log(log);}, throttleTime);
	return function* (next){
		let health = this.health;
		throttle(`${Date.now()}: Queue ${health.queue}`);
		yield next;
	};
}

Socket.prototype.logBatches = function(options){
	options = _.defaultsDeep(options, {events: 1000, batches: 100});
	let batches = 0;
	let events = 0;
	let time = Date.now();
	return function* (next){
		let health = this.health;
		if(this.health.new_batch){
			batches ++;
			events += this.health.new_batch.numBatch;
			if(events >= options.events || batches >= options.batches){
				let now = Date.now();
				let seconds = (now - time)/1000;
				console.log("%s: %d batches total of %d events over %d seconds", now, batches, events, seconds);
				events = batches = 0;
				time = now;
			}
		}
		yield next;
	};
}

module.exports = Socket;
