'use strict';

const Socket    = require('./socket');
const _         = require('lodash');

function App() {
  if (!(this instanceof App)) return new App;
  this.sockets = [];
}
module.exports = App;

function addSocket(type, name, options){
	let socket = new Socket(type, name, options);
	this.sockets.push(socket);
	return socket;
}

App.prototype.list = function(){
	return _.map(sockets, function(socket){
		return `${socket.socket_name} (${socket.socket_type})`;
	});
}

App.prototype.addSocket = App.prototype.socket = addSocket;

App.prototype.req = _.partial(addSocket, "req"); //send (round-robin); receive (from last peer); blocks
App.prototype.rep = _.partial(addSocket, "rep"); //send (to last peer); receive (fair); drops per client

App.prototype.dealer = _.partial(addSocket, "dealer"); //send (round-robin); receive (fair); blocks
App.prototype.router = _.partial(addSocket, "router"); //send (identity); receive (fair); drops

App.prototype.pub = _.partial(addSocket, "pub"); //send (fanout); drops per sub; drops when no subs
App.prototype.sub = _.partial(addSocket, "sub"); //receive (fair); drops

App.prototype.xpub = _.partial(addSocket, "xpub");//send (fanout); drops per sub; drops when no subs
App.prototype.xsub = _.partial(addSocket, "xsub"); //receive (fair); drops

App.prototype.push = _.partial(addSocket, "push"); //send (round-robin); blocks; blocks when no pulls
App.prototype.pull = _.partial(addSocket, "pull"); //receive (fair); blocks

App.prototype.pair = _.partial(addSocket, "pair"); //send (single peer); receive (single peer); blocks; experimental