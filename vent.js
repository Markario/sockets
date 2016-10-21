'use strict';

const CO        = require('co');
const _         = require('lodash');
const zmq       = require('zmq');
const zmqUtil   = require('./zmq-util');

function newVent(config) {
	// Socket to send work messages on
	var sender = zmq.socket('push');

	let name = config.name;
	let numTasks = config.numTasks;

	let bindAddr = zmqUtil.bindAddr(config.address);
	sender.bindSync(bindAddr);

	let total_msec = 0;
  	console.log("%s Sending tasks to workers...", name);

	for(var i = 0; i < numTasks; i++){
		let workload = Math.abs(Math.round(Math.random() * 100)) + 1;
		total_msec += workload;
		CO(function* (){
			let message = {
				workload: workload,
				vent: name
			}
			console.log("%s %s workload: %s.", name, i, workload.toString());
			sender.send(JSON.stringify(message));
		});
	}
	console.log("Total expected cost:", total_msec, "msec");
	sender.close();
};

module.exports.newVent = newVent;