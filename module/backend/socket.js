
let socket = io("https://minigame.taketwomanila.com");


export class Socket {
  init() {
    this.networkPlayers = {};
    this.ownSid = null;
    this.mapData = null;

    socket.on("connect", () => {
      this.ownSid = socket.id;
      console.log("Connected! sid=", this.ownSid);
      socket.emit("request_map");
    });

    socket.on("players", (data) => {
      this.networkPlayers = data;
    });

    socket.on("map_data", (data) => {
      this.mapData = data;
      console.log("Received map_data", data);
    });

    socket.on("map_saved", (response) => {
      console.log("Map saved successfully on server!");
      if (this.onMapSaved) {
        this.onMapSaved();
      }
    });
  }

  requestMap() {
    socket.emit("request_map");
  }

 sendPlayer(player) {
    if (!player) return;
    socket.emit("update_player", {
      x: player.x,
      y: player.y,
      id: this.ownSid,
      username: player.username,
    });
  }

  saveMap(mapData) {
    console.log("Attempting to save map...");
    if (!socket.connected) {
      console.error("Socket not connected! Cannot save map.");
      return;
    }
    socket.emit("save_map", mapData);
    console.log("Save map event emitted to server");
  }

}


  
