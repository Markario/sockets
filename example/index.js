'use strict';

const cluster   = require('cluster')

const PushSocket = require('./push-socket');
const PullSocket = require('./pull-socket');

if(cluster.isMaster){
	cluster.fork();
	PushSocket("tcp://*:5555");
}else{
	PullSocket("tcp://localhost:5555");
}