'use strict';

const CO        = require('co');
const _         = require('lodash');
const zmq       = require('zmq');
const cluster   = require('cluster')

const Vent      = require('./vent');
const Worker    = require('./worker');
const Sink      = require('./sink');

let network = {
	vents: [
	{
		name: "Vent A",
		address: {
			port: 5557,
			protocol: "tcp",
			bindHost: "*",
			host: "localhost"
		},
		numTasks: 456,
	},
	{
		name: "Vent B",
		address: {
			port: 5558,
			protocol: "tcp",
			bindHost: "*",
			host: "localhost"
		},
		numTasks: 1234,
	},
	{
		name: "Vent C",
		address: {
			port: 5559,
			protocol: "tcp",
			bindHost: "*",
			host: "localhost"
		},
		numTasks: 2345,
	}],
	sink: {
		name: "Sink",
		address: {
			port: 5560,
			protocol: "tcp",
			bindHost: "*",
			host: "localhost"
		}
	},
	numWorkers: 10
}

if(cluster.isMaster){
	let sink = Sink.newSink(network.sink);
	for(var i=0; i < network.numWorkers; i++){
		let name = `'Worker ${i}'`;
		cluster.fork({
			TYPE: "worker",
			WORKER_NAME: name
		});
	}
	_.each(network.vents, function(config){
		cluster.fork({
			TYPE: "vent",
			VENT_CONFIG: JSON.stringify(config),
		});
	});
}else{
	if(process.env.TYPE === 'vent') {
		Vent.newVent(JSON.parse(process.env.VENT_CONFIG));
	}else if(process.env.TYPE === 'worker'){
		Worker.newWorker(process.env.WORKER_NAME, network)
	}
}