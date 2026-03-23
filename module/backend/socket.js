
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
      direction: player.currentDirection,
      lastDirection: player.lastDirection,
      width: player.width,
      height: player.height,
      colliderWidth: player.colliderWidth,
      colliderHeight: player.colliderHeight,
      colliderOffsetX: player.colliderOffsetX,
      colliderOffsetY: player.colliderOffsetY
    });
  }

  saveMap(mapData) {
    if (!mapData) return;
    socket.emit("save_map", mapData);
  }

}


  
