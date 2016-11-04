'use strict';

const cluster   = require('cluster')

const Push    = require('./push');
const Forward = require('./forward');
const Pull    = require('./pull');
const Address = require('../lib/').Address;

if(cluster.isMaster){
	cluster.fork({
		TYPE: "forward"
	});
	cluster.fork();
	console.log("setup Push");
	Push(new Address("tcp", "*", 5555));
}else{
	if(process.env.TYPE === 'forward') {
		console.log("setup Forward");
		Forward(new Address("tcp", "localhost", 5555), new Address("tcp", "localhost", 5557));
	}else{
		console.log("setup Pull");
		Pull(new Address("tcp", "*", 5557));
	}
}