export class Tilemap {
    tile_size = 32;
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

    // Convert screen coordinates to world coordinates
    screenToWorld(sx, sy, camera) {
        return {
            x: sx / 2 + camera.cx,  // Account for scale(2) in sketch
            y: sy / 2 + camera.cy
        };
    }

    // Convert world coordinates to tile grid coordinates
    worldToTile(wx, wy) {
        return {
            x: Math.floor(wx / this.tile_size),
            y: Math.floor(wy / this.tile_size)
        };
    }

    // Toggle tile at world position
    toggleTile(worldX, worldY) {
        const tile = this.worldToTile(worldX, worldY);
        const x = tile.x;
        const y = tile.y;

        if (y >= 0 && y < this.tiles.length && x >= 0 && x < this.tiles[0].length) {
            this.tiles[y][x] = this.tiles[y][x] === 1 ? 0 : 1;
        }
    }

    // Clear all tiles
    clearMap() {
        for (let y = 0; y < this.tiles.length; y++) {
            for (let x = 0; x < this.tiles[y].length; x++) {
                this.tiles[y][x] = 0;
            }
        }
        console.log("Map cleared!");
    }

    // Export map as text format for tilemap_data.txt
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

    // Send map to backend for saving
    saveMapToBackend(socket) {
        const mapData = {
            tile_size: 32,
            tiles: this.tiles
        };
        console.log("Sending map to backend:", mapData);
        socket.saveMap(mapData);
        this.lastSaveTime = Date.now();
        console.log("Map saved to backend!");
    }

    // Check if recently saved for visual feedback
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

                let overlapX = player.x < tx + this.tile_size && player.x + player.width  > tx;
                let overlapY = player.y < ty + this.tile_size && player.y + player.height > ty;

                if (overlapX && overlapY) {
                    overlapping.push({ x: tx, y: ty });
                }
            }
        }

        return overlapping;
    }

    load(camera) {
        fill(100);
        for (let y = 0; y < this.tiles.length; y++) {
            for (let x = 0; x < this.tiles[y].length; x++) {
                if (this.tiles[y][x] === 1) {
                    rect(
                        x * this.tile_size - camera.cx,
                        y * this.tile_size - camera.cy,
                        this.tile_size,
                        this.tile_size
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
                        x * this.tile_size - camera.cx,
                        y * this.tile_size - camera.cy,
                        this.tile_size,
                        this.tile_size
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
                    tile.x * this.tile_size - camera.cx,
                    tile.y * this.tile_size - camera.cy,
                    this.tile_size,
                    this.tile_size
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