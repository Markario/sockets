'use strict';

const cluster   = require('cluster')

const Push    = require('./push');
const Forward = require('./forward');
const Pull    = require('./pull');

if(cluster.isMaster){
	cluster.fork({
		TYPE: "forward"
	});
	cluster.fork();
	console.log("setup Push");
	Push("tcp://*:5555");
}else{
	if(process.env.TYPE === 'forward') {
		console.log("setup Forward");
		Forward("tcp://localhost:5555", "tcp://localhost:5557");
	}else{
		console.log("setup Pull");
		Pull("tcp://*:5557");
	}
}