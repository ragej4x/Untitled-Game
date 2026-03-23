export class Tilemap {
    tile_size = 16;
    tiles = [];
    furniture = [];
    editorMode = false;
    lastSaveTime = 0;
    selectedLayer = "ground"; // ground or furniture
    selectedTile = 1;
    tileTypes = {}; // ground tile types, loaded from assets/blocks.json
    furnitureTypes = {}; // furniture types, loaded from assets/blocks.json
    tileImages = {}; // preload image objects for both layers


    setMap(data) {
        if (!data) return;
        this.tile_size = data.tile_size || this.tile_size;

        this.tiles = Array.isArray(data.tiles) ? data.tiles : [];
        this.furniture = Array.isArray(data.furniture) ? data.furniture : this._emptyLayer(this.tiles);

        if (data.tile_types && typeof data.tile_types === 'object') {
            this.tileTypes = data.tile_types;
        }

        if (data.furniture_types && typeof data.furniture_types === 'object') {
            this.furnitureTypes = data.furniture_types;
        }

        this.loadTileImages();
    }

    loadBlockConfig(filePath) {
        loadJSON(filePath,
            (data) => {
                if (!data) {
                    console.warn("No block data loaded from", filePath);
                    return;
                }

                if (data.tile_size) {
                    this.tile_size = data.tile_size;
                }

                if (data.tile_types && typeof data.tile_types === 'object') {
                    this.tileTypes = data.tile_types;
                }

                if (data.furniture_types && typeof data.furniture_types === 'object') {
                    this.furnitureTypes = data.furniture_types;
                }

                if (data.tiles && Array.isArray(data.tiles)) {
                    this.tiles = data.tiles;
                }

                this.furniture = Array.isArray(data.furniture) ? data.furniture : this._emptyLayer(this.tiles);

                this.loadTileImages();

                console.log("Loaded block config:", { tileTypes: this.tileTypes, furnitureTypes: this.furnitureTypes });
            },
            (err) => {
                console.error("Error loading block config", err);
            }
        );
    }

    _emptyLayer(baseTiles) {
        if (!Array.isArray(baseTiles) || baseTiles.length === 0) return [];
        return baseTiles.map(row => row.map(() => 0));
    }

    getFurnitureMeta(typeId) {
        return this.furnitureTypes[typeId] || null;
    }

    getFurnitureTypeIds() {
        return Object.keys(this.furnitureTypes)
            .map(key => parseInt(key, 10))
            .filter(id => !Number.isNaN(id))
            .sort((a, b) => a - b);
    }

    loadTileImages() {
        this.tileImages = {};

        for (const id of this.getTileTypeIds()) {
            const meta = this.getTileMeta(id);
            if (meta && meta.image) {
                try {
                    this.tileImages[`g_${id}`] = loadImage(meta.image);
                } catch (err) {
                    console.warn("Could not load ground image for tile", id, meta.image, err);
                    this.tileImages[`g_${id}`] = null;
                }
            }
        }

        for (const id of this.getFurnitureTypeIds()) {
            const meta = this.getFurnitureMeta(id);
            if (meta && meta.image) {
                try {
                    this.tileImages[`f_${id}`] = loadImage(meta.image);
                } catch (err) {
                    console.warn("Could not load furniture image for tile", id, meta.image, err);
                    this.tileImages[`f_${id}`] = null;
                }
            }
        }
    }

    toggleEditorMode() {
        this.editorMode = !this.editorMode;
        console.log(this.editorMode ? "EDITOR MODE ON - Press 'E' to toggle, Click to paint/erase tiles, 'C' to clear map" : "PLAY MODE ON");
    }

    screenToWorld(sx, sy, camera) {
        return {
            x: sx / 3.5 + camera.cx,
            y: sy / 3.5 + camera.cy
        };
    }

    worldToTile(wx, wy) {
        return {
            x: Math.floor(wx / this.tile_size),
            y: Math.floor(wy / this.tile_size)
        };
    }

    getTileMeta(typeId) {
        return this.tileTypes[typeId] || null;
    }

    getTileTypeIds() {
        return Object.keys(this.tileTypes)
            .map((key) => parseInt(key, 10))
            .filter((id) => !Number.isNaN(id))
            .sort((a, b) => a - b);
    }

    getFurnitureMeta(typeId) {
        return this.furnitureTypes[typeId] || null;
    }

    getFurnitureTypeIds() {
        return Object.keys(this.furnitureTypes)
            .map((key) => parseInt(key, 10))
            .filter((id) => !Number.isNaN(id))
            .sort((a, b) => a - b);
    }

    ensureFurnitureLayer() {
        if (!Array.isArray(this.furniture) || this.furniture.length !== this.tiles.length) {
            this.furniture = this._emptyLayer(this.tiles);
        }
    }

    toggleTile(worldX, worldY) {
        const tile = this.worldToTile(worldX, worldY);
        const x = tile.x;
        const y = tile.y;

        if (y < 0 || y >= this.tiles.length || x < 0 || x >= this.tiles[0].length) return;

        if (this.selectedLayer === "ground") {
            if (this.tiles[y][x] === this.selectedTile) {
                this.tiles[y][x] = 0;
            } else {
                this.tiles[y][x] = this.selectedTile;
            }
        } else {
            this.ensureFurnitureLayer();
            if (this.furniture[y][x] === this.selectedTile) {
                this.furniture[y][x] = 0;
            } else {
                this.furniture[y][x] = this.selectedTile;
            }
        }
    }

    clearMap() {
        for (let y = 0; y < this.tiles.length; y++) {
            for (let x = 0; x < this.tiles[y].length; x++) {
                this.tiles[y][x] = 0;
            }
        }
        if (Array.isArray(this.furniture)) {
            for (let y = 0; y < this.furniture.length; y++) {
                for (let x = 0; x < this.furniture[y].length; x++) {
                    this.furniture[y][x] = 0;
                }
            }
        }
        console.log("Map cleared!");
    }

    exportMapData() {
        // Old text-export path retains compatibility
        let csv = "";
        for (let y = 0; y < this.tiles.length; y++) {
            csv += this.tiles[y].join(",") + "\n";
        }
        console.log("=== COPY THIS TO tilemap_data.txt ===");
        console.log(csv);
        console.log("======================================");

        const json = {
            tile_size: this.tile_size,
            tile_types: this.tileTypes,
            furniture_types: this.furnitureTypes,
            tiles: this.tiles,
            furniture: this.furniture
        };

        console.log("=== JSON MAP DATA ===");
        console.log(JSON.stringify(json, null, 2));
        console.log("=====================");

        return json;
    }

    saveMapToBackend(socket) {
        const mapData = {
            tile_size: this.tile_size,
            tiles: this.tiles,
            furniture: this.furniture,
            tile_types: this.tileTypes,
            furniture_types: this.furnitureTypes
        };
        console.log("Sending map to backend:", mapData);
        if (socket && typeof socket.saveMap === 'function') {
            socket.saveMap(mapData);
            this.lastSaveTime = Date.now();
            console.log("Map saved to backend!");
        } else {
            console.warn("Socket saveMap not available");
        }
    }

    isSavedRecently() {
        return Date.now() - this.lastSaveTime < 2000;
    }

    // Returns world-space rects of all solid tiles/furniture overlapping the player
    getOverlappingTiles(player) {
        let overlapping = [];

        const pushOverlap = (tx, ty, tileW, tileH, typeId) => {
            let colliderLeft = player.x + player.colliderOffsetX;
            let colliderTop = player.y + player.colliderOffsetY;
            let overlapX = colliderLeft < tx + tileW && colliderLeft + player.colliderWidth > tx;
            let overlapY = colliderTop < ty + tileH && colliderTop + player.colliderHeight > ty;
            if (overlapX && overlapY) {
                overlapping.push({ x: tx, y: ty, w: tileW, h: tileH, type: typeId });
            }
        };

        for (let y = 0; y < this.tiles.length; y++) {
            for (let x = 0; x < this.tiles[y].length; x++) {
                const tileType = this.tiles[y][x];
                if (tileType === 0) continue;

                const meta = this.getTileMeta(tileType);
                if (!meta || meta.solid === false) continue;

                let tx = x * this.tile_size;
                let ty = y * this.tile_size;
                let tileW = meta.width || this.tile_size;
                let tileH = meta.height || this.tile_size;
                pushOverlap(tx, ty, tileW, tileH, tileType);
            }
        }

        for (let y = 0; y < this.furniture.length; y++) {
            for (let x = 0; x < this.furniture[y].length; x++) {
                const fType = this.furniture[y][x];
                if (fType === 0) continue;

                const meta = this.getFurnitureMeta(fType);
                if (!meta || meta.solid === false) continue;

                let tx = x * this.tile_size;
                let ty = y * this.tile_size;
                let tileW = meta.width || this.tile_size;
                let tileH = meta.height || this.tile_size;
                pushOverlap(tx, ty, tileW, tileH, fType);
            }
        }

        return overlapping;
    }

    load(camera) {
        const ts = this.tile_size;
        
        for (let y = 0; y < this.tiles.length; y++) {
            for (let x = 0; x < this.tiles[y].length; x++) {
                const tileType = this.tiles[y][x];
                const meta = this.getTileMeta(tileType);
                if (tileType > 0 && meta) {
                    const drawX = x * ts - camera.cx;
                    const drawY = y * ts - camera.cy;
                    const drawW = meta.width || ts;
                    const drawH = meta.height || ts;

                    const img = this.tileImages[`g_${tileType}`];
                    if (img) {
                        image(img, drawX, drawY, drawW, drawH);
                    } else {
                        fill(...(meta.color || [200, 200, 200]));
                        noStroke();
                        rect(drawX, drawY, drawW, drawH);
                    }
                }
            }
        }

        // draw furniture layer above ground
        for (let y = 0; y < this.furniture.length; y++) {
            for (let x = 0; x < this.furniture[y].length; x++) {
                const fType = this.furniture[y][x];
                const meta = this.getFurnitureMeta(fType);
                if (fType > 0 && meta) {
                    const drawX = x * ts - camera.cx;
                    const drawY = y * ts - camera.cy;
                    const drawW = meta.width || ts;
                    const drawH = meta.height || ts;

                    const img = this.tileImages[`f_${fType}`];
                    if (img) {
                        image(img, drawX, drawY, drawW, drawH);
                    } else {
                        fill(...(meta.color || [255, 255, 0]));
                        noStroke();
                        rect(drawX, drawY, drawW, drawH);
                    }
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

            // Current editing layer indicator
            fill(255, 255, 255);
            textSize(14);
            text("Layer: " + this.selectedLayer, 10, 30);

            // Render tile selector in screen (unscaled) space so click is direct
            push();
            resetMatrix();
            this.renderTileSelector();
            pop();
        }
    }

    renderTileSelector() {
        const startX = 10;
        const startY = 70;
        const tileSize = 20;
        const padding = 5;

        const ids = this.selectedLayer === 'ground' ? this.getTileTypeIds() : this.getFurnitureTypeIds();
        const getMeta = this.selectedLayer === 'ground' ? this.getTileMeta.bind(this) : this.getFurnitureMeta.bind(this);

        for (let index = 0; index < ids.length; index++) {
            const i = ids[index];
            const meta = getMeta(i);
            if (!meta) continue;

            const x = startX;
            const y = startY + index * (tileSize + padding);

            fill(...(meta.color || [200, 200, 200]));
            stroke(255);
            strokeWeight(1);
            rect(x, y, tileSize, tileSize);

            fill(0);
            noStroke();
            textSize(10);
            text(i, x + 4, y + 14);

            if (i === this.selectedTile) {
                stroke(255, 255, 0);
                strokeWeight(3);
                noFill();
                rect(x - 2, y - 2, tileSize + 4, tileSize + 4);
            }
        }
    }

    handleClick(sx, sy) {
        const startX = 10;
        const startY = 70;
        const tileSize = 20;
        const padding = 5;

        const ids = this.selectedLayer === 'ground' ? this.getTileTypeIds() : this.getFurnitureTypeIds();
        for (let index = 0; index < ids.length; index++) {
            const i = ids[index];
            const x = startX;
            const y = startY + index * (tileSize + padding);

            if (sx >= x && sx <= x + tileSize && sy >= y && sy <= y + tileSize) {
                this.selectedTile = i;
                return true; // Clicked on selector
            }
        }
        return false; // Not on selector
    }
}