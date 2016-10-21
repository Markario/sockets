'use strict';

const CO        = require('co');
const _         = require('lodash');
const zmq       = require('zmq');
const zmqUtil   = require('./zmq-util');

let coPromise = (promise) => {
	return new Promise ((resolve, reject) => {
		CO(function* () {
			let response = yield promise;
			resolve(response);
		}).catch((err) => {
			reject(err.stack || err);
		});
	});
};

function newWorker(name, network){
	let receiver   = zmq.socket('pull');
  	let sender     = zmq.socket('push');

	receiver.on('message', function(buf) {
		let message = JSON.parse(buf.toString());
		let msec = message.workload;

		console.log("%s %s started task %s from %s", Date.now(), name, msec, message.vent);
		let promise = new Promise ((resolve, reject) => {
		    setTimeout(function() {
		    	console.log("%s %s resolving task %s from %s", Date.now(), name, msec, message.vent);
		    	let response = message;
		    	response.worker = name;
		    	resolve(JSON.stringify(response));
		    }, msec);
		});
		coPromise(promise)
	    .then((response) => sender.send(response))
	    .catch((err)     => sender.send(err));
	});

	_.each(network.vents, function(vent){
		let address = zmqUtil.connectAddr(vent.address);
		receiver.connect(address);
	});

	let sinkAddress = zmqUtil.connectAddr(network.sink.address);

	sender.connect(sinkAddress);
}

module.exports.newWorker = newWorker;