# Sockets

Sockets is a service framework for ZeroMQ/zmq using middleware.

v0.2.0 - Push/Pull sockets work. Others socket types may or may not work.

**Need to install the ZeroMQ library** 
- perhaps try `brew install zeromq`

**depends on** 

- [zmq](https://github.com/JustinTulloss/zeromq.node)
- [chan](https://github.com/brentburg/chan)
- [co](https://github.com/tj/co)
- [lodash](https://github.com/lodash/lodash)

## Simple Push/Pull Example

```javascript
const Sockets   = require('sockets');
const CO        = require('co');

let app = Sockets.App();

let push = app.push();
let pull = app.pull();

push.use_snd(function* (next){
	console.log("Sending Message %s", JSON.stringify(this.message));
	yield next;
});

pull.use_rcv(function* (next){
	console.log("Received Message %s", JSON.stringify(this.message));
	yield next;
});

push.bind("tcp://*:5555");
pull.connect("tcp://localhost:5555");

console.log("Done setting up");

CO(function* (){
	yield push.send(push.createContext({some: "message"}));
});

```

More examples in /example

- example.js
	-  Example showing order of execution of middleware generator functions
- index.js (push.js, forward.js, and pull.js)
	- Example that loads three services: 
	 - Push, which generates some messages on a Push socket; 
	 - Forward, which Pulls and then Pushes; 
	 - Pull, which receives the messages on a Pull socket.

## Reference

### App

#### Create a new Sockets App
```javascript
const Sockets = require('sockets');
let app = Sockets.App();
```

#### Create a socket


let socket = `app.socket(type, name, options)`

**params**

- **type** (string) Socket type one of (req, rep, dealer, router, pub, sub, xpub, xsub, push, pull, or pair)
- **name** (string) Name of Socket (for reference)
- **options** (object)
	- **monitor** (boolean, default: false):
	- **numWorkers** (integer, default: 1): Number of CO functions running for processing recieved messages on a socket.
	
**returns** a **Socket** object

```javascript
let pushSocket = app.socket("push", "My Push Socket", {
	monitor: false,
	numWorkers: 1
});
```

Shortcuts for creating Sockets ([reference for socket types](http://api.zeromq.org/3-2:zmq-socket))
```javascript
app.req();    //send (round-robin); receive (from last peer);
app.rep();    //send (to last peer); receive (fair-queued);

app.dealer(); //send (round-robin); receive (fair-queued);
app.router(); //send (identity); receive (fair-queued);

app.pub();    //send (fanout);
app.sub();    //receive (fair-queued);

app.xpub();   //send (fanout);
app.xsub();   //receive (fair-queued);

app.push();   //send (round-robin);
app.pull();   //receive (fair-queued);

app.pair();   //send (single peer); receive (single peer); experimental;
```

### Socket

#### Create a message context
`let ctx = socket.createContext(message, meta)`

**params**

- **message** (object) 

**returns**

- **Context**
	- **message** (object) Object received or to be sent
	- **state** (object) Object to store state as the context is passed through middleware
	- **socket** (Socket) Socket that created this Context

#### Bind Socket to an address

`socket.bind(address);`

**params**

- **address** - Will bind Socket to address.toString()

#### Connect Socket to an address


`socket.connect(address);`

**params**

- **address** - Will connect Socket to address.toString()

**example**

`socket.connect("tcp://localhost:5555");`

#### Send a message
yield `socket.send* (context)`

**generator function**
**params**
- **context** context object with at least a 'message' property

Passing a context object to send() will
1.  execute the socket's send-middleware generator functions with the context bound to each generator. 
2. JSON.stringify(context.message) and send the message on the Socket

#### Add middleware for receiving messages

`socket.use_rcv(function* (next))`

**params**

- generator function that accepts another middleware generator function

**result:** adds a middleware generator function that will be executed (in the order they were added) when a message is received on this Socket.

#### Add middleware for sending messages

`socket.use_snd(function* (next))`

**params**

- generator function that accepts another middleware generator function

**result:** adds a middleware generator function that will be executed (in the order they were added) when a message is about to be sent on this Socket using socket.send(context)

#### Middleware - forwardOn

`socketOne.use_rcv(socketTwo.forwardOn())`

Middleware to send the context for a received message to another Socket for sending. The sending Socket's send middleware will be executed exactly as if socket.send(ctx) had been called.

#### Middleware - logQueueSize

`socket.use_rcv(socket.logQueueSize(options))`

Logs the current queue size for the Socket's received messages to console when a message is receieved.

Available options will determine what rate the logs are made as well as whether or not the log is prepended with a string and/or epoch ms.

`(timestamp) (prepend): Queue: 123`

**params**

- **options** (object)
	- **throttlems** (integer, default: 1000) - minimum number of milliseconds between logs
	- **prepend** (string, default: null) - text to prepend to the log
	- **timestamp** (boolean, default: false) - prepend epoch milliseconds to the log

#### Middleware - logBatches

`socket.use_rcv(socket.logBatches(options))`

Logs information about Batches of received messages, whenever the queue increases due to many messages being received. This can be used to detect when a Socket is under load.

Available options will determine when the information is logged based on the number of messages or batches reaching a limit as well as determining whether or not the log is prepended with a string and/or epoch ms.

`(timestamp) (prepend): Batches: 100; Messages: 567; Seconds: 1.001`

**params**

- **options** (object)
	- **messages** (integer, default: 1000) - Minimum number messages to receive in batches before triggering the log
	- **batches** (integer, default: 100) - Minimum number of batches to receive before triggering the log
	- **prepend** (string, default: null) - text to prepend to the log
	- **timestamp** (boolean, default: false) - prepend epoch milliseconds to the log

### SocketAddress

#### Create an Address for a Socket to Bind on or Connect to

```javascript
const Address = require('sockets').Address
let bindAddr = new Address("tcp", "*", 5555);
let connectAddr = new Address("tcp", "localhost", 5555);

socketOne.bind(bindAddr);
socketTwo.connect(connectAddr);

console.log(bindAddr.toString());    // "tcp://*:5555"
console.log(connectAddr.toString()); // "tcp://localhost:5555"
```

It is not necessary to create an  Address object to use socket.bind or socket.connect and this is offered as a convenience.