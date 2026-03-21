

export class Player {
    constructor (){
        this.x = 100;
        this.y = 100;
        this.x_vel = 0;
        this.y_vel = 0;
        this.width = 32;
        this.height = 32;
        this.speed = 5;
        this.color = [0, 255, 0];
        this.username = "Player";
        this.sprite = null; // image option
    }
    move(direction) {
        this.x_vel = 0;
        this.y_vel = 0;

        switch (direction) {
            case "left":  this.x_vel = -this.speed * (deltaTime / 16.67); break;
            case "right": this.x_vel =  this.speed * (deltaTime / 16.67); break;
            case "up":    this.y_vel = -this.speed * (deltaTime / 16.67); break; 
            case "down":  this.y_vel =  this.speed * (deltaTime / 16.67); break; 
        }
    }
    applyVelocityWithCollision(tilemap) {
        // --- Horizontal ---
        this.x += this.x_vel;
        for (let tile of tilemap.getOverlappingTiles(this)) {
            console.log("H collision", tile, "x_vel:", this.x_vel);
            if (this.x_vel > 0) {
                this.x = tile.x - this.width;
            } else if (this.x_vel < 0) {
                this.x = tile.x + tilemap.tile_size;
            }
        }

        // --- Vertical ---
        this.y += this.y_vel;
        for (let tile of tilemap.getOverlappingTiles(this)) {
            console.log("V collision", tile, "y_vel:", this.y_vel);
            if (this.y_vel > 0) {
                this.y = tile.y - this.height;
            } else if (this.y_vel < 0) {
                this.y = tile.y + tilemap.tile_size;
            }
        }
    }

    draw(camera) {
        if (this.sprite) {
            image(this.sprite, this.x - camera.cx, this.y - camera.cy, this.width, this.height);
        } else {
            fill(...this.color);
            rect(this.x - camera.cx, this.y - camera.cy, this.width, this.height);
        }
    }

    addNetworkPlayer(socket, camera){
        for (let sid in socket.networkPlayers) {
            if (!socket.networkPlayers.hasOwnProperty(sid)) continue;
            if (sid === socket.ownSid) continue;

            let p = socket.networkPlayers[sid];
            if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') continue;

            fill(255, 0, 0);
            rect(p.x - camera.cx, p.y - camera.cy, this.width, this.height);
        }
    }

}
