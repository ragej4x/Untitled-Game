
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

  saveMap(mapData, onComplete) {
    if (!mapData) {
      console.warn("saveMap called with no mapData");
      if (onComplete) onComplete({ success: false, error: "No map data" });
      return;
    }
    console.log("SOCKET.SAVEMAP - Sending mapData with furniture:", mapData.furniture?.length, "rows");
    
    // Measure the size of the data being sent
    const dataStr = JSON.stringify(mapData);
    const sizeInMB = (new Blob([dataStr]).size / (1024 * 1024)).toFixed(2);
    console.log(`SOCKET.SAVEMAP - Data size: ${sizeInMB}MB`);
    
    socket.emit("save_map", mapData, (response) => {
      console.log("SOCKET.SAVEMAP - Server response:", response);
      if (response && response.success) {
        console.log("✓ Save confirmed by server");
        if (onComplete) onComplete({ success: true });
      } else if (response && response.error) {
        console.error("✗ Server save error:", response.error);
        if (onComplete) onComplete({ success: false, error: response.error });
      } else {
        console.warn("✗ Unexpected server response:", response);
        if (onComplete) onComplete({ success: false, error: "Unexpected response" });
      }
    });
  }

}


  
