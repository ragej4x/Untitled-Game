
import { PlayerAnimator } from "./animation.js";

export class Player {
    constructor (){
        this.x = 100;
        this.y = 100;
        this.x_vel = 0;
        this.y_vel = 0;
        this.width = 16;
        this.height = 32;
        this.speed = 2;
        this.color = [0, 255, 0];
        this.username = "Player";
        this.sprite = null; // image option
        this.animator = null; // animation handler
        this.lastDirection = "down";
        this.currentDirection = "none"; // Current movement direction (walk vs idle)
        
        // Collider dimensions (separate from image size)
        this.colliderWidth = 12;
        this.colliderHeight = 7;
        this.colliderOffsetX = 2; // X offset from image position
        this.colliderOffsetY = 25; // Y offset from image position
        this.showCollider = true; // Debug flag
        
        // Network players storage - track animator state per network player
        this.networkPlayerAnimators = {};
    }

    setAnimator(animator) {
        this.animator = animator;
    }



    move(direction) {
        this.x_vel = 0;
        this.y_vel = 0;
        
        // Store direction for animation (only update if not "none")
        if (direction && direction !== "none") {
            this.lastDirection = direction;
        }

        // Track current movement direction (for network sync)
        this.currentDirection = direction || "none";

        switch (direction) {
            case "left":  this.x_vel = -this.speed * (deltaTime / 16.67); break;
            case "right": this.x_vel =  this.speed * (deltaTime / 16.67); break;
            case "up":    this.y_vel = -this.speed * (deltaTime / 16.67); break; 
            case "down":  this.y_vel =  this.speed * (deltaTime / 16.67); break; 
        }

        // Update animation based on movement and direction
        if (this.animator) {
            this.animator.update(direction, this.lastDirection, deltaTime);
        }
    }
    applyVelocityWithCollision(tilemap) {
        // --- Horizontal ---
        this.x += this.x_vel;
        for (let tile of tilemap.getOverlappingTiles(this)) {
            const tileW = typeof tile.w === 'number' ? tile.w : tilemap.tile_size;
            console.log("H collision", tile, "x_vel:", this.x_vel);
            if (this.x_vel > 0) {
                this.x = tile.x - this.colliderWidth - this.colliderOffsetX;
            } else if (this.x_vel < 0) {
                this.x = tile.x + tileW - this.colliderOffsetX;
            }
        }

        // --- Vertical ---
        this.y += this.y_vel;
        for (let tile of tilemap.getOverlappingTiles(this)) {
            const tileH = typeof tile.h === 'number' ? tile.h : tilemap.tile_size;
            console.log("V collision", tile, "y_vel:", this.y_vel);
            if (this.y_vel > 0) {
                this.y = tile.y - this.colliderHeight - this.colliderOffsetY;
            } else if (this.y_vel < 0) {
                this.y = tile.y + tileH - this.colliderOffsetY;
            }
        }
    }

    draw(camera) {
        if (this.animator) {
            this.animator.draw(
                this.x - camera.cx,
                this.y - camera.cy,
                this.width,
                this.height
            );
        } else if (this.sprite) {
            image(this.sprite, this.x - camera.cx, this.y - camera.cy, this.width, this.height);
        } else {
            fill(...this.color);
            rect(this.x - camera.cx, this.y - camera.cy, this.width, this.height);
        }
        
        // Draw collider box for debugging
        if (this.showCollider) {
            stroke(255, 0, 0);
            strokeWeight(2);
            noFill();
            rect(
                this.x + this.colliderOffsetX - camera.cx,
                this.y + this.colliderOffsetY - camera.cy,
                this.colliderWidth,
                this.colliderHeight
            );
            noStroke();
        }
    }

    addNetworkPlayer(socket, camera, frameGroups){
        for (let sid in socket.networkPlayers) {
            if (!socket.networkPlayers.hasOwnProperty(sid)) continue;
            if (sid === socket.ownSid) continue;

            let p = socket.networkPlayers[sid];
            if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') continue;

            // Create a separate animator for this network player if needed
            if (!this.networkPlayerAnimators[sid] && frameGroups) {
                this.networkPlayerAnimators[sid] = {
                    animator: new PlayerAnimator(frameGroups, { frameDelay: 100 }),
                    lastDirection: p.lastDirection || "down"
                };
            }

            let playerState = this.networkPlayerAnimators[sid];
            
            // Use the current direction from server (walk vs idle)
            let movementDirection = p.direction || "none";
            
            // Update facing direction for animation
            if (p.lastDirection) {
                playerState.lastDirection = p.lastDirection;
            }

            // Update animator with the current movement direction
            if (playerState.animator) {
                playerState.animator.update(movementDirection, playerState.lastDirection, deltaTime);
            }

            // Draw network player with animation
            let playerWidth = typeof p.width === 'number' ? p.width : this.width;
            let playerHeight = typeof p.height === 'number' ? p.height : this.height;
            
            if (playerState.animator) {
                playerState.animator.draw(
                    p.x - camera.cx,
                    p.y - camera.cy,
                    playerWidth,
                    playerHeight
                );
            } else {
                fill(255, 0, 0);
                rect(p.x - camera.cx, p.y - camera.cy, playerWidth, playerHeight);
            }

            // Draw collider box for network player
            let colliderWidth = typeof p.colliderWidth === 'number' ? p.colliderWidth : this.colliderWidth;
            let colliderHeight = typeof p.colliderHeight === 'number' ? p.colliderHeight : this.colliderHeight;
            let colliderOffsetX = typeof p.colliderOffsetX === 'number' ? p.colliderOffsetX : this.colliderOffsetX;
            let colliderOffsetY = typeof p.colliderOffsetY === 'number' ? p.colliderOffsetY : this.colliderOffsetY;
            
            if (this.showCollider) {
                stroke(255, 100, 100);
                strokeWeight(2);
                noFill();
                rect(
                    p.x + colliderOffsetX - camera.cx,
                    p.y + colliderOffsetY - camera.cy,
                    colliderWidth,
                    colliderHeight
                );
                noStroke();
            }
        }
    }

}
