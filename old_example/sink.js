'use strict';

const CO        = require('co');
const _         = require('lodash');
const zmq       = require('zmq');
const zmqUtil   = require('./zmq-util');

function newSink(config){
	let name = config.name;
  	let receiver   = zmq.socket('pull');
	let label = "Total elapsed time";
	let vents = {};

	receiver.on('message', function(buf) {
	  let message = JSON.parse(buf.toString());
	  if(!vents[message.vent]){
	  	vents[message.vent] = {messages: 0};
	  }
	  vents[message.vent].messages++;
	  console.log("%d tasks finished for %s: latest: %s", vents[message.vent].messages, message.vent, JSON.stringify(message));
	});

	let bindAddr = zmqUtil.bindAddr(config.address);
	receiver.bindSync(bindAddr);
}

module.exports.newSink = newSink;