
let socket = io("http://127.0.0.1:5000");


export class Socket {
  init() {
    this.networkPlayers = {};
    this.ownSid = null;
    socket.on("connect", () => {
      this.ownSid = socket.id;
      console.log("Connected! sid=", this.ownSid);
    });

    socket.on("players", (data) => {
      this.networkPlayers = data;
    });
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

}


  
