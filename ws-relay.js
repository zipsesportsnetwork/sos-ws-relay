const WebSocket = require('ws');
const prompt = require('prompt');
const { success, error, warn, info, log, indent } = require('cli-msg');
const atob = require('atob');
const got = require('got');

const STEAM_API_KEY = process.env['STEAM_API_KEY'];
const avatarCache = {};
let caching = false;

prompt.get([
    {
        description: 'Relay delay in ms (used in cloud productions)',
        pattern: /^\d+$/,
        message: 'Must be a number',
        name: 'delay',
        required: true,
        default: "0",
    },
    {
        description: "Port number for this websocket server",
        pattern: /^\d+$/,
        message: 'Must be a number',
        name: 'port',
        required: true,
        default: "49322",
    },
    {
        description: "Hostname:Port that Rocket League is running on",
        name: 'rocketLeagueHostname',
        required: true,
        default: "localhost:49122"
    }
], function (e, r) {
    /**
     * Rocket League WebSocket client
     * @type {WebSocket}
     */
    let wsClient;
    let relayMsDelay = parseInt(r.delay, 10);

    const wss = new WebSocket.Server({ port: r.port });
    let connections = {};
    info.wb("Opened WebSocket server on port " + r.port);

    wss.on('connection', function connection(ws) {
        let id = (+ new Date()).toString();
        success.wb("Received connection: " + id);
        connections[id] = {
            connection: ws,
            registeredFunctions: []
        };

        ws.send(JSON.stringify({
            event: "wsRelay:info",
            data: "Connected!"
        }));

        ws.on('message', function incoming(message) {
            sendRelayMessage(id, message);
        });

        ws.on('close', function close() {
            // Might run into race conditions with accessing connections for sending, but cant be arsed to account for this.
            // If a connection closes something will be fucked anyway
            delete connections[id];
        });
    });

    initRocketLeagueWebsocket(r.rocketLeagueHostname);
    setInterval(function () {
       if (wsClient.readyState === WebSocket.CLOSED) {
           warn.wb("Rocket League WebSocket Server Closed. Attempting to reconnect");
           initRocketLeagueWebsocket(r.rocketLeagueHostname);
       }
    }, 10000);

    function isntBot(player) {
        return player.primaryID !== '0';
    }

    function notInCache(player) {
        return typeof avatarCache[player.primaryID] === 'undefined';
    }

    function sendRelayMessage(senderConnectionId, message) {
        let json = JSON.parse(message);
        log.wb(senderConnectionId + "> Sent " + json.event);
        let channelEvent = (json['event']).split(':');
        if (channelEvent[0] === 'wsRelay') {
            if (channelEvent[1] === 'register') {
                if (connections[senderConnectionId].registeredFunctions.indexOf(json['data']) < 0) {
                    connections[senderConnectionId].registeredFunctions.push(json['data']);
                    info.wb(senderConnectionId + "> Registered to receive: "+json['data']);
                } else {
                    warn.wb(senderConnectionId + "> Attempted to register an already registered function: "+json['data']);
                }
            } else if (channelEvent[1] === 'unregister') {
                let idx = connections[senderConnectionId].registeredFunctions.indexOf(json['data']);
                if (idx > -1) {
                    connections[senderConnectionId].registeredFunctions.splice(idx, 1);
                    info.wb(senderConnectionId + "> Unregistered: "+json['data']);
                } else {
                    warn.wb(senderConnectionId + "> Attempted to unregister a non-registered function: "+json['data']);
                }
            }
            return;
        } else if (channelEvent[0] === 'game' && channelEvent[1] === 'update_state') {
            cachePlayerAvatars(Object.values(json.data.players).filter(isntBot).filter(notInCache));

            for (const [id, player] of Object.entries(json.data.players)) {
                if (isntBot(player) && !notInCache(player)) {
                    json.data.players[id].avatarURL = avatarCache[player.primaryID];
                }
            }

            message = JSON.stringify(json);
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
                        //The connection can close between the exist check, and sending, so we catch it here and ignore
                    }
                }, 0);
            }
        }
    }

    function initRocketLeagueWebsocket(rocketLeagueHostname) {
        wsClient = new WebSocket("ws://"+rocketLeagueHostname);

        wsClient.onopen = function open() {
            success.wb("Connected to Rocket League on "+rocketLeagueHostname);
        };
        wsClient.onmessage = function(message) {
            let sendMessage = message.data;
            if (sendMessage.substr(0, 1) !== '{') {
                sendMessage = atob(message.data);
            }
            setTimeout(() => {
                sendRelayMessage(0, sendMessage);
            }, relayMsDelay);
        };
        wsClient.onerror = function (err) {
            error.wb(`Error connecting to Rocket League on host "${rocketLeagueHostname}"\nIs the plugin loaded into Rocket League? Run the command "plugin load sos" from the BakkesMod console to make sure`);
        };
    }

    async function cachePlayerAvatars(players) {
        if (caching || players.length === 0) return;

        caching = true;

        const data = await got(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_API_KEY}&steamids=${players.map(p => p.primaryID).join(',')}`).json();
    
        for (const { steamid, avatarfull } of data.response.players) {
            avatarCache[steamid] = avatarfull;
        }
    
        info.wb(`Cached ${players.length} player avatar(s)`);

        caching = false;
    }
});