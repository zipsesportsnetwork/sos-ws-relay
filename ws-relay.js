const WebSocket = require('ws');
const port = process.argv[2] || 49322;

if (port < 1000 || port > 65535) {
    console.warn("Invalid port number provided. Exiting");
    process.exit(2);
}

const wss = new WebSocket.Server({ port: port });
let connections = {};
console.log("Opened WebSocket server on port " + port);

wss.on('connection', function connection(ws) {
    let id = (+ new Date()).toString();
    console.log("Received connection: " + id);
    connections[id] = ws;

    ws.on('message', function incoming(message) {
        console.log(message);
        for (let k in connections) {
            if (!connections.hasOwnProperty(k)) {
                continue;
            }
            if (id === k) {
                continue;
            }
            connections[k].send(message);
        }
    });

    ws.on('close', function close() {
        // Might run into race conditions with accessing connections for sending, but cant be arsed to account for this.
        // If a connection closes something will be fucked anyway
        delete connections[id];
    });
});