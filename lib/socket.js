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
	this.rcvMiddleware = [];
	this.sndMiddleware = [];
	this.socket = zmq.socket(type);
	this.ch = Channel();
	zmq_setup.call(this, options);
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

function zmq_setup(options){
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

	self.socket.on('message', (buffer) => {
		return new Promise ( (resolve, reject) => {
			CO (function * () {
				self.ch(buffer)(function (err) {
				if (err) {
					console.error(logPrepend, "error queueing message", err);
					reject();
				}
				resolve();
				});
			});
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
	let numWorkers = options.numWorkers;
	while(numWorkers--){
		startWorker();
	}

	if(options.monitor){
		self.socket.monitor(500, 0);	
	}
}

let numBatch = 0;
let oldQueued = 0;
let receivedTime = null;

function checkHealth(){	
	let healthItems = {};
	let chan = this.ch.__chan;
	let totalQueued = chan.items.length + chan.pendingAdds.length;

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
			healthItems.last_batch = {
				numBatch, 
				receivedTime
			};
		}
		receivedTime = now;
		numBatch = newEvents;
	}
	oldQueued = totalQueued;
	healthItems.queue = totalQueued;
	return healthItems;
}

function* handleMessage(buffer){
	let message = buffer.toString();
	try{message = JSON.parse(message);}catch(e){};
	let ctx = createContext(message, {received: Date.now()});
	ctx.health = checkHealth.call(this);
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

function logQueueSize(throttleTime){
	let throttle = _.throttle(function(log){console.log(log);}, throttleTime);
	return function* (next){
		let health = this.health;
		throttle(`${Date.now()}: Queue ${health.queue}`);
		yield next;
	};
}

Socket.prototype.logQueueSize = logQueueSize;

function logBatches(options){
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

Socket.prototype.logBatches = logBatches;
