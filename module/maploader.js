export class Tilemap {
    tile_size = 16;
    tiles = [];
    editorMode = false;
    lastSaveTime = 0;

    setMap(data) {
        if (!data) return;
        this.tile_size = data.tile_size || this.tile_size;
        this.tiles = Array.isArray(data.tiles) ? data.tiles : [];
    }

    toggleEditorMode() {
        this.editorMode = !this.editorMode;
        console.log(this.editorMode ? "EDITOR MODE ON - Press 'E' to toggle, Click to paint/erase tiles, 'C' to clear map" : "PLAY MODE ON");
    }

    screenToWorld(sx, sy, camera) {
        return {
            x: sx / 2 + camera.cx,
            y: sy / 2 + camera.cy
        };
    }

    worldToTile(wx, wy) {
        return {
            x: Math.floor(wx / this.tile_size),
            y: Math.floor(wy / this.tile_size)
        };
    }

    toggleTile(worldX, worldY) {
        const tile = this.worldToTile(worldX, worldY);
        const x = tile.x;
        const y = tile.y;

        if (y >= 0 && y < this.tiles.length && x >= 0 && x < this.tiles[0].length) {
            this.tiles[y][x] = this.tiles[y][x] === 1 ? 0 : 1;
        }
    }

    clearMap() {
        for (let y = 0; y < this.tiles.length; y++) {
            for (let x = 0; x < this.tiles[y].length; x++) {
                this.tiles[y][x] = 0;
            }
        }
        console.log("Map cleared!");
    }

    exportMapData() {
        let data = "";
        for (let y = 0; y < this.tiles.length; y++) {
            data += this.tiles[y].join(",") + "\n";
        }
        console.log("=== COPY THIS TO tilemap_data.txt ===");
        console.log(data);
        console.log("======================================");
        return data;
    }

    saveMapToBackend(socket) {
        const mapData = {
            tile_size: 16,
            tiles: this.tiles
        };
        console.log("Sending map to backend:", mapData);
        socket.saveMap(mapData);
        this.lastSaveTime = Date.now();
        console.log("Map saved to backend!");
    }

    isSavedRecently() {
        return Date.now() - this.lastSaveTime < 2000;
    }

    // Returns world-space rects of all solid tiles overlapping the player
    getOverlappingTiles(player) {
        let overlapping = [];

        for (let y = 0; y < this.tiles.length; y++) {
            for (let x = 0; x < this.tiles[y].length; x++) {
                if (this.tiles[y][x] !== 1) continue;

                let tx = x * this.tile_size;
                let ty = y * this.tile_size;

                let colliderLeft = player.x + player.colliderOffsetX;
                let colliderTop = player.y + player.colliderOffsetY;
                let overlapX = colliderLeft < tx + this.tile_size && colliderLeft + player.colliderWidth  > tx;
                let overlapY = colliderTop < ty + this.tile_size && colliderTop + player.colliderHeight > ty;

                if (overlapX && overlapY) {
                    overlapping.push({ x: tx, y: ty });
                }
            }
        }

        return overlapping;
    }

    load(camera) {
        fill(100);
        const ts = this.tile_size;
        
        for (let y = 0; y < this.tiles.length; y++) {
            for (let x = 0; x < this.tiles[y].length; x++) {
                if (this.tiles[y][x] === 1) {
                    rect(
                        x * ts - camera.cx,
                        y * ts - camera.cy,
                        ts,
                        ts
                    );
                }
            }
        }

        // Draw editor grid and highlights
        if (this.editorMode) {
            stroke(50);
            strokeWeight(1);
            noFill();
            
            // Draw grid
            for (let y = 0; y < this.tiles.length; y++) {
                for (let x = 0; x < this.tiles[y].length; x++) {
                    rect(
                        x * ts - camera.cx,
                        y * ts - camera.cy,
                        ts,
                        ts
                    );
                }
            }

            // Highlight tile under mouse
            const world = this.screenToWorld(mouseX, mouseY, camera);
            const tile = this.worldToTile(world.x, world.y);
            
            if (tile.y >= 0 && tile.y < this.tiles.length && tile.x >= 0 && tile.x < this.tiles[0].length) {
                stroke(255, 255, 0);
                strokeWeight(2);
                rect(
                    tile.x * ts - camera.cx,
                    tile.y * ts - camera.cy,
                    ts,
                    ts
                );
            }

            // Show save status
            if (this.isSavedRecently()) {
                fill(0, 255, 0);
                textSize(14);
                text("✓ Saved!", 10, 50);
            }
        }
    }
}