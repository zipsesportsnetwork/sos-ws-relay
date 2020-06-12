const WebSocket = require('ws');
const prompt = require('prompt');
// const port = process.argv[2] || 49322;

// if (port < 1000 || port > 65535) {
//     console.warn("Invalid port number provided. Exiting");
//     process.exit(2);
// }

prompt.get([
    {
        message: "Port number for this websocket server",
        name: 'port',
        required: true,
        default: "49322",
    },
    {
        message: "Hostname:Port that Rocket League is running on",
        name: 'rocketLeagueHostname',
        required: true,
        default: "localhost:49122"
    }
], function (e, r) {
    const wss = new WebSocket.Server({ port: r.port });
    let connections = {};
    console.log("Opened WebSocket server on port " + r.port);

    wss.on('connection', function connection(ws) {
        let id = (+ new Date()).toString();
        console.log("Received connection: " + id);
        connections[id] = {
            connection: ws,
            registeredFunctions: []
        };

        ws.on('message', function incoming(message) {
            sendRelayMessage(id, message);
        });

        ws.on('close', function close() {
            // Might run into race conditions with accessing connections for sending, but cant be arsed to account for this.
            // If a connection closes something will be fucked anyway
            delete connections[id];
        });
    });

    /**
     * Rocket League WebSocket client
     * @type {WebSocket}
     */
    const wsClient = new WebSocket("ws://"+r.rocketLeagueHostname);
    let rlWsClientReady = false;

    wsClient.on('open', function open() {
        rlWsClientReady = true;
        console.log("Connected to websocket on "+r.rocketLeagueHostname);
    });
    wsClient.on('close', function () {
        rlWsClientReady = false;
    });
    wsClient.onmessage = function(message) {
        sendRelayMessage(0, message.data);
    }
    wsClient.onerror = function (err) {
        console.log(`Error connecting to Rocket League on "${r.rocketLeagueHostname}": ${JSON.stringify(err)}`);
    };

    function sendRelayMessage(senderConnectionId, message) {
        let json = JSON.parse(message);
        console.log(senderConnectionId + "> Sent " + json.event);
        let channelEvent = (json['event']).split(':');
        if (channelEvent[0] === 'wsRelay') {
            if (channelEvent[1] === 'register') {
                if (connections[senderConnectionId].registeredFunctions.indexOf(json['data']) < 0) {
                    connections[senderConnectionId].registeredFunctions.push(json['data']);
                    console.log(senderConnectionId + "> Registered to receive: "+json['data']);
                } else {
                    console.log(senderConnectionId + "> Attempted to register an already registered function: "+json['data']);
                }
            } else if (channelEvent[1] === 'unregister') {
                let idx = connections[senderConnectionId].registeredFunctions.indexOf(json['data']);
                if (idx > -1) {
                    connections[senderConnectionId].registeredFunctions.splice(idx, 1);
                    console.log(senderConnectionId + "> Unregistered: "+json['data']);
                } else {
                    console.log(senderConnectionId + "> Attempted to unregister a non-registered function: "+json['data']);
                }
            }
            return;
        }
        for (let k in connections) {
            if (senderConnectionId === k) {
                continue;
            }
            if (!connections.hasOwnProperty(k)) {
                continue;
            }
            if (connections[k].registeredFunctions.indexOf(json['event']) > -1) {
                setTimeout(() => {
                    try {
                        connections[k].connection.send(message);
                    } catch (e) {
                        //The connection can close between the exist check, and sending so we catch it here and ignore
                    }
                }, 0);
            }
        }
    }
});