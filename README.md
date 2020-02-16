# SOS-WS-Relay
SOS-WS-Relay is a special rebroadcasting application that handles communications between specially coded overlays
and remote control boards. Incoming websocket communications are rebroadcast on all connections except the
one it came on, minimizing self-reaction to events for control boards and overlays. 

### Installation
- Install NodeJS (preferably an LTS build which is the default when downloading from the NodeJS website)
- Download this repository and extract it to a folder that you can find again
- In a command prompt that's pointed at the root of this directory:
  1. `npm install`
  2. `node ws-relay.js`
    - This will run the server. Once you get a prompt saying `"Opened WebSocket server on port XXXXX"`, you are good to go.
    Simply minimize the window and forget about it

### Configuration
By default, the relay runs on `ws://localhost:49322`.

Pass a valid port integer as the first argument when startup the relay to change the port it will run on.