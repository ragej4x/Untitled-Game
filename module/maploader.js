export class Tilemap {
    tile_size = 16;
    tiles = [];
    furniture = [];
    editorMode = false;
    lastSaveTime = 0;
    lastSaveError = null;
    selectedLayer = "ground"; // ground or furniture
    selectedTile = 1;
    tileTypes = {}; // ground tile types, loaded from assets/blocks.json
    furnitureTypes = {}; // furniture types, loaded from assets/blocks.json
    tileImages = {}; // preload image objects for both layers

    // Item selector configuration
    selectorConfig = {
        cols: 8,          // Number of columns in tile grid
        itemWidth: 32,      // Width of each item in selector
        itemHeight: 32,     // Height of each item in selector
        padding: 5,         // Padding between items
        startX: 10,         // Starting X position
        startY: 150          // Starting Y position
    };

    // Editor tool settings
    toolMode = 'brush';   // brush, eraser, line, bucket
    brushSize = 1;         // 1x1, 2x2, 3x3
    lineStart = null;      // [x,y] for line mode

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

                // Expand folder-based tiles into individual tile types
                this.expandFolderTiles().then(() => {
                    this.loadTileImages();
                    console.log("Loaded block config:", { tileTypes: this.tileTypes, furnitureTypes: this.furnitureTypes });
                });
            },
            (err) => {
                console.error("Error loading block config", err);
            }
        );
    }

    async expandFolderTiles() {
        /**
         * For any tile type with a "folder" property, fetch the list of images
         * and auto-generate individual tile types for each image.
         * startID is the tile type key, tag is the category name.
         */
        console.log(`[expandFolderTiles] Starting expansion...`);
        const tileTypesToExpand = [];
        const furnitureTypesToExpand = [];

        // Collect all folder-based tile types
        for (const [typeKey, meta] of Object.entries(this.tileTypes)) {
            if (meta && meta.folder) {
                tileTypesToExpand.push({ typeKey: parseInt(typeKey), meta });
            }
        }

        for (const [typeKey, meta] of Object.entries(this.furnitureTypes)) {
            if (meta && meta.folder) {
                furnitureTypesToExpand.push({ typeKey: parseInt(typeKey), meta });
            }
        }

        console.log(`[expandFolderTiles] Found ${tileTypesToExpand.length} folder-based tile types and ${furnitureTypesToExpand.length} furniture types to expand`);

        // Fetch and expand each folder
        const promises = [];

        for (const { typeKey, meta } of tileTypesToExpand) {
            promises.push(this.expandFolderType(typeKey, meta, this.tileTypes));
        }

        for (const { typeKey, meta } of furnitureTypesToExpand) {
            promises.push(this.expandFolderType(typeKey, meta, this.furnitureTypes));
        }

        await Promise.all(promises);
        console.log(`[expandFolderTiles] Expansion complete. tileTypes now has ${Object.keys(this.tileTypes).length} types, furnitureTypes has ${Object.keys(this.furnitureTypes).length} types`);
    }

    async expandFolderType(startID, folderMeta, targetCollection) {
        /**
         * Fetch tile metadata for a folder and inject auto-generated tiles.
         * startID: the starting tile ID (from blocks.json key)
         * folderMeta: the metadata object with folder, tag, fileExtension, width, height, etc.
         * targetCollection: tileTypes or furnitureTypes object to inject into
         */
        if (!folderMeta.folder || !folderMeta.tag) {
            console.warn("Folder-based tile type missing folder or tag", folderMeta);
            return;
        }

        const backendUrl = "http://localhost:5000";
        const fileExt = folderMeta.fileExtension || 'png';
        const apiUrl = `${backendUrl}/api/list-images?folder=${encodeURIComponent(folderMeta.folder)}&startID=${startID}&tag=${encodeURIComponent(folderMeta.tag)}&fileExtension=${encodeURIComponent(fileExt)}`;

        console.log(`[expandFolderType] Fetching tiles for startID=${startID}, folder=${folderMeta.folder}, tag=${folderMeta.tag}`);
        console.log(`[expandFolderType] API URL: ${apiUrl}`);

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch tile metadata: ${response.status} ${errorText}`);
            }
            const data = await response.json();

            if (data.error) {
                console.error(`[expandFolderType] Error from backend:`, data.error);
                return;
            }

            if (!data.tiles || !Array.isArray(data.tiles)) {
                console.warn(`[expandFolderType] No tiles returned from folder ${folderMeta.folder}`, data);
                return;
            }

            console.log(`[expandFolderType] Expanding ${data.tiles.length} tiles from ${folderMeta.folder}`);

            // Remove the original folder-based entry
            delete targetCollection[startID];

            // Add each auto-generated tile to the collection
            for (const tileData of data.tiles) {
                const tileId = tileData.id;
                const newTile = {
                    name: tileData.name,
                    image: tileData.image,
                    width: folderMeta.width,
                    height: folderMeta.height,
                    color: folderMeta.color,
                    solid: folderMeta.solid,
                    isAutoGenerated: true
                };
                targetCollection[tileId] = newTile;
                console.log(`[expandFolderType] Added tile ${tileId}: ${tileData.name} = ${tileData.image}`);
            }

            console.log(`[expandFolderType] Expansion complete. Collection now has ${Object.keys(targetCollection).length} types:`, Object.keys(targetCollection).sort((a,b) => parseInt(a) - parseInt(b)));
        } catch (err) {
            console.error(`[expandFolderType] Error expanding folder type with startID=${startID}:`, err);
        }
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
        
        console.log(`[loadTileImages] Starting image loading...`);
        console.log(`[loadTileImages] Available tile types: ${Object.keys(this.tileTypes).join(', ')}`);
        console.log(`[loadTileImages] Available furniture types: ${Object.keys(this.furnitureTypes).join(', ')}`);

        // Load ground tile images
        for (const id of this.getTileTypeIds()) {
            const meta = this.getTileMeta(id);
            if (!meta) {
                console.warn(`[loadTileImages] No metadata found for tile ${id}`);
                continue;
            }

            if (meta.image) {
                // Single image file - use p5.js loadImage with callbacks
                const imagePath = meta.image;
                const imageKey = `g_${id}`;
                loadImage(
                    imagePath,
                    (img) => {
                        this.tileImages[imageKey] = img;
                        console.log(`[loadTileImages] ✓ Loaded ground tile ${id} from ${imagePath}`);
                    },
                    (err) => {
                        console.warn(`[loadTileImages] ✗ Failed to load ground tile ${id}: ${imagePath}`, err);
                        this.tileImages[imageKey] = null;
                    }
                );
            } else if (meta.folder) {
                // Folder with multiple PNG files - load asynchronously
                console.log(`[loadTileImages] Ground tile ${id} still has folder property (should have been expanded), loading directly`);
                this.loadImagesFromFolder(meta.folder, `g_${id}`);
            } else {
                console.warn(`[loadTileImages] Ground tile ${id} has no image or folder property`, meta);
            }
        }

        // Load furniture images
        for (const id of this.getFurnitureTypeIds()) {
            const meta = this.getFurnitureMeta(id);
            if (!meta) {
                console.warn(`[loadTileImages] No metadata found for furniture ${id}`);
                continue;
            }

            if (meta.image) {
                // Single image file - use p5.js loadImage with callbacks
                const imagePath = meta.image;
                const imageKey = `f_${id}`;
                loadImage(
                    imagePath,
                    (img) => {
                        this.tileImages[imageKey] = img;
                        console.log(`[loadTileImages] ✓ Loaded furniture ${id} from ${imagePath}`);
                    },
                    (err) => {
                        console.warn(`[loadTileImages] ✗ Failed to load furniture ${id}: ${imagePath}`, err);
                        this.tileImages[imageKey] = null;
                    }
                );
            } else if (meta.folder) {
                // Folder with multiple PNG files - load asynchronously
                console.log(`[loadTileImages] Furniture ${id} still has folder property (should have been expanded), loading directly`);
                this.loadImagesFromFolder(meta.folder, `f_${id}`);
            } else {
                console.warn(`[loadTileImages] Furniture ${id} has no image or folder property`, meta);
            }
        }
    }

    loadImagesFromFolder(folderPath, keyPrefix) {
        /**
         * Load images directly from a folder without tile expansion.
         * Used as fallback for backwards compatibility.
         * Now that expandFolderTiles handles most cases, this is rarely used.
         */
        const backendUrl = "http://localhost:5000";
        const apiUrl = `${backendUrl}/api/list-images?folder=${encodeURIComponent(folderPath)}`;
        
        console.log(`Loading images from folder: ${folderPath}`);
        
        fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to list images: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    console.error(`Error listing images from ${folderPath}:`, data.error);
                    return;
                }
                
                // Handle both old format (images array) and new format (tiles array)
                const imageList = data.images || (data.tiles ? data.tiles.map(t => t.image) : []);
                console.log(`Found ${imageList.length} images in ${folderPath}`);
                
                // Load each image
                imageList.forEach((imagePath, index) => {
                    try {
                        const imageKey = `${keyPrefix}_${index}`;
                        this.tileImages[imageKey] = loadImage(imagePath);
                        console.log(`Loaded: ${imageKey} = ${imagePath}`);
                    } catch (err) {
                        console.warn(`Could not load image: ${imagePath}`, err);
                    }
                });
                
                // Also store array reference by key prefix for bulk access
                this.tileImages[keyPrefix] = {
                    isFolder: true,
                    count: imageList.length,
                    folder: folderPath
                };
            })
            .catch(err => {
                console.error(`Error loading images from folder ${folderPath}:`, err);
            });
    }

    toggleEditorMode() {
        this.editorMode = !this.editorMode;
        console.log(this.editorMode ? "EDITOR MODE ON - Press 'E' to toggle, Click to paint/erase tiles, 'C' to clear map" : "PLAY MODE ON");
    }

    setSelectorConfig(config) {
        /**
         * Update item selector configuration
         * config = {
         *   cols: number,       // Columns in grid (default: 8)
         *   itemWidth: number,  // Width of each item (default: 20)
         *   itemHeight: number, // Height of each item (default: 20)
         *   padding: number,    // Space between items (default: 5)
         *   startX: number,     // Starting X position (default: 10)
         *   startY: number      // Starting Y position (default: 70)
         * }
         */
        this.selectorConfig = { ...this.selectorConfig, ...config };
        console.log("[selector] Configuration updated:", this.selectorConfig);
    }

    getSelectorConfig() {
        return this.selectorConfig;
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

    paintTile(worldX, worldY) {
        const tile = this.worldToTile(worldX, worldY);
        const x = tile.x;
        const y = tile.y;

        if (y < 0 || y >= this.tiles.length || x < 0 || x >= this.tiles[0].length) return;

        if (this.selectedLayer === "ground") {
            this.tiles[y][x] = this.selectedTile;
            console.log(`PAINT_TILE - Ground layer at (${x}, ${y}): set to ${this.selectedTile}`);
        } else {
            this.ensureFurnitureLayer();
            this.furniture[y][x] = this.selectedTile;
            console.log(`PAINT_TILE - Furniture layer at (${x}, ${y}): set to ${this.selectedTile}`);
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
            console.log(`TOGGLE_TILE - Ground layer at (${x}, ${y}): set to ${this.tiles[y][x]}`);
        } else {
            this.ensureFurnitureLayer();
            if (this.furniture[y][x] === this.selectedTile) {
                this.furniture[y][x] = 0;
            } else {
                this.furniture[y][x] = this.selectedTile;
            }
            console.log(`TOGGLE_TILE - Furniture layer at (${x}, ${y}): set to ${this.furniture[y][x]}`);
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

    setToolMode(mode) {
        const allowed = ['brush', 'eraser', 'line', 'bucket'];
        if (!allowed.includes(mode)) {
            console.warn(`[setToolMode] Invalid mode: ${mode}`);
            return;
        }
        this.toolMode = mode;
        if (mode !== 'line') {
            this.lineStart = null;
        }
        console.log(`[setToolMode] ${mode}`);
    }

    setBrushSize(size) {
        this.brushSize = Math.max(1, Math.min(10, parseInt(size, 10) || 1));
        console.log(`[setBrushSize] ${this.brushSize}`);
    }

    applyBrush(x, y, value) {
        const radius = Math.floor(this.brushSize / 2);
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const tx = x + dx;
                const ty = y + dy;
                if (ty < 0 || ty >= this.tiles.length || tx < 0 || tx >= this.tiles[0].length) continue;
                if (this.selectedLayer === 'ground') {
                    this.tiles[ty][tx] = value;
                } else {
                    this.ensureFurnitureLayer();
                    this.furniture[ty][tx] = value;
                }
            }
        }
    }

    lineTo(x0, y0, x1, y1, value) {
        const dx = Math.abs(x1 - x0);
        const sx = x0 < x1 ? 1 : -1;
        const dy = -Math.abs(y1 - y0);
        const sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        let x = x0, y = y0;
        while (true) {
            this.applyBrush(x, y, value);
            if (x === x1 && y === y1) break;
            const e2 = 2 * err;
            if (e2 >= dy) {
                err += dy;
                x += sx;
            }
            if (e2 <= dx) {
                err += dx;
                y += sy;
            }
        }
    }

    bucketFill(x, y, targetValue) {
        if (y < 0 || y >= this.tiles.length || x < 0 || x >= this.tiles[0].length) return;

        const layer = this.selectedLayer === 'ground' ? this.tiles : this.furniture;
        if (this.selectedLayer === 'furniture' && !Array.isArray(this.furniture)) {
            this.ensureFurnitureLayer();
        }

        const startValue = layer[y][x];
        if (startValue === targetValue) return;

        const stack = [[x, y]];
        while (stack.length) {
            const [cx, cy] = stack.pop();
            if (cy < 0 || cy >= layer.length || cx < 0 || cx >= layer[0].length) continue;
            if (layer[cy][cx] !== startValue) continue;
            layer[cy][cx] = targetValue;

            stack.push([cx + 1, cy]);
            stack.push([cx - 1, cy]);
            stack.push([cx, cy + 1]);
            stack.push([cx, cy - 1]);
        }

        if (this.selectedLayer === 'furniture') {
            this.furniture = layer;
        }

        console.log(`[bucketFill] set from ${startValue} to ${targetValue} at ${x},${y}`);
    }

    paintTile(worldX, worldY) {
        const tile = this.worldToTile(worldX, worldY);
        const x = tile.x;
        const y = tile.y;

        if (y < 0 || y >= this.tiles.length || x < 0 || x >= this.tiles[0].length) return;

        const targetValue = this.toolMode === 'eraser' ? 0 : this.selectedTile;

        if (this.toolMode === 'brush' || this.toolMode === 'eraser') {
            this.applyBrush(x, y, targetValue);
        } else if (this.toolMode === 'line') {
            if (!this.lineStart) {
                this.lineStart = [x, y];
                console.log(`[line] start at ${x},${y}`);
            } else {
                const [sx, sy] = this.lineStart;
                this.lineTo(sx, sy, x, y, targetValue);
                this.lineStart = null;
                console.log(`[line] drawn to ${x},${y}`);
            }
        } else if (this.toolMode === 'bucket') {
            this.bucketFill(x, y, targetValue);
        } else {
            // Default fallback paint
            this.applyBrush(x, y, targetValue);
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
            console.log(`TOGGLE_TILE - Ground layer at (${x}, ${y}): set to ${this.tiles[y][x]}`);
        } else {
            this.ensureFurnitureLayer();
            if (this.furniture[y][x] === this.selectedTile) {
                this.furniture[y][x] = 0;
            } else {
                this.furniture[y][x] = this.selectedTile;
            }
            console.log(`TOGGLE_TILE - Furniture layer at (${x}, ${y}): set to ${this.furniture[y][x]}`);
        }
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
        // CRITICAL: Ensure furniture layer exists and is properly sized
        this.ensureFurnitureLayer();
        
        // Verify furniture array is not null/undefined
        if (!Array.isArray(this.furniture)) {
            console.error("CRITICAL ERROR: Furniture array is not an array after ensureFurnitureLayer!");
            this.furniture = this._emptyLayer(this.tiles);
        }
        
        const mapData = {
            tile_size: this.tile_size,
            tiles: this.tiles,
            furniture: this.furniture,
            tile_types: this.tileTypes,
            furniture_types: this.furnitureTypes
        };
        console.log("SAVE ATTEMPT - Furniture array size:", this.furniture.length, "x", this.furniture[0]?.length || 0);
        console.log("SAVE ATTEMPT - Furniture array content:", JSON.stringify(this.furniture.slice(0, 3))); // Log first 3 rows
        console.log("Sending map to backend:", mapData);
        if (socket && typeof socket.saveMap === 'function') {
            socket.saveMap(mapData, (response) => {
                if (response.success) {
                    this.lastSaveTime = Date.now();
                    this.lastSaveError = null;
                    console.log("Map saved to backend successfully!");
                } else {
                    this.lastSaveError = response.error || "Unknown error";
                    console.error("Map save failed:", this.lastSaveError);
                }
            });
        } else {
            console.warn("Socket saveMap not available");
            this.lastSaveError = "Socket not available";
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
        const scaleFactor = 3.5;

        let minX = 0;
        let minY = 0;
        let maxX = this.tiles[0] ? this.tiles[0].length - 1 : 0;
        let maxY = this.tiles.length - 1;

        const worldLeft = camera.cx;
        const worldTop = camera.cy;
        const worldRight = camera.cx + windowWidth / scaleFactor;
        const worldBottom = camera.cy + windowHeight / scaleFactor;

        minX = Math.floor(worldLeft / ts) - 1;
        minY = Math.floor(worldTop / ts) - 1;
        maxX = Math.ceil(worldRight / ts) + 1;
        maxY = Math.ceil(worldBottom / ts) + 1;

        minX = Math.max(0, minX);
        minY = Math.max(0, minY);
        maxX = Math.min(this.tiles[0] ? this.tiles[0].length - 1 : 0, maxX);
        maxY = Math.min(this.tiles.length - 1, maxY);

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                if (!this.tiles[y]) continue;

                const tileType = this.tiles[y][x];
                const meta = this.getTileMeta(tileType);
                if (tileType > 0 && meta) {
                    const drawX = x * ts - camera.cx;
                    const drawY = y * ts - camera.cy;
                    const drawW = meta.width || ts;
                    const drawH = meta.height || ts;

                    const img = this.tileImages[`g_${tileType}`];
                    // Only draw if image exists and is fully loaded
                    if (img && img.width > 0 && img.height > 0) {
                        try {
                            image(img, drawX, drawY, drawW, drawH);
                        } catch (err) {
                            console.warn(`[load] Failed to draw tile ${tileType}:`, err);
                            fill(...(meta.color || [200, 200, 200]));
                            noStroke();
                            rect(drawX, drawY, drawW, drawH);
                        }
                    } else {
                        // Draw placeholder color while image loads or if missing
                        fill(...(meta.color || [200, 200, 200]));
                        noStroke();
                        rect(drawX, drawY, drawW, drawH);
                    }
                }
            }
        }

        const fmMinX = minX;
        const fmMinY = minY;
        const fmMaxX = maxX;
        const fmMaxY = maxY;

        for (let y = fmMinY; y <= fmMaxY; y++) {
            for (let x = fmMinX; x <= fmMaxX; x++) {
                if (!this.furniture[y]) continue;

                const fType = this.furniture[y][x];
                const meta = this.getFurnitureMeta(fType);
                if (fType > 0 && meta) {
                    const drawX = x * ts - camera.cx;
                    const drawY = y * ts - camera.cy;
                    const drawW = meta.width || ts;
                    const drawH = meta.height || ts;

                    const img = this.tileImages[`f_${fType}`];
                    // Only draw if image exists and is fully loaded
                    if (img && img.width > 0 && img.height > 0) {
                        try {
                            image(img, drawX, drawY, drawW, drawH);
                        } catch (err) {
                            console.warn(`[load] Failed to draw furniture ${fType}:`, err);
                            fill(...(meta.color || [255, 255, 0]));
                            noStroke();
                            rect(drawX, drawY, drawW, drawH);
                        }
                    } else {
                        // Draw placeholder color while image loads or if missing
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

            // Draw grid with same bounds as visible tiles
            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
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
            if (this.lastSaveError) {
                fill(255, 0, 0);  // Red for error
                textSize(14);
                text("✗ Save Error: " + this.lastSaveError, 10, 50);
            } else if (this.isSavedRecently()) {
                fill(0, 255, 0);  // Green for success
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
        const cfg = this.selectorConfig;
        const ids = this.selectedLayer === 'ground' ? this.getTileTypeIds() : this.getFurnitureTypeIds();
        const getMeta = this.selectedLayer === 'ground' ? this.getTileMeta.bind(this) : this.getFurnitureMeta.bind(this);
        const getImageKey = this.selectedLayer === 'ground' ? (id) => `g_${id}` : (id) => `f_${id}`;

        for (let index = 0; index < ids.length; index++) {
            const id = ids[index];
            const meta = getMeta(id);
            if (!meta) continue;

            // Calculate grid position
            const col = index % cfg.cols;
            const row = Math.floor(index / cfg.cols);
            const x = cfg.startX + col * (cfg.itemWidth + cfg.padding);
            const y = cfg.startY + row * (cfg.itemHeight + cfg.padding);

            // Draw background rectangle
            fill(...(meta.color || [200, 200, 200]));
            stroke(100);
            strokeWeight(1);
            rect(x, y, cfg.itemWidth, cfg.itemHeight);

            // Try to draw tile image
            const imageKey = getImageKey(id);
            const img = this.tileImages[imageKey];
            if (img && img.width > 0 && img.height > 0) {
                try {
                    image(img, x, y, cfg.itemWidth, cfg.itemHeight);
                } catch (err) {
                    // Image failed, just use the colored background
                }
            }

            // Draw selection highlight
            if (id === this.selectedTile) {
                stroke(255, 255, 0);
                strokeWeight(3);
                noFill();
                rect(x - 2, y - 2, cfg.itemWidth + 4, cfg.itemHeight + 4);
            }

            // Draw ID text
            fill(0);
            noStroke();
            textSize(8);
            text(id, x + 2, y + cfg.itemHeight - 2);
        }
    }

    handleClick(sx, sy) {
        const cfg = this.selectorConfig;
        const ids = this.selectedLayer === 'ground' ? this.getTileTypeIds() : this.getFurnitureTypeIds();

        for (let index = 0; index < ids.length; index++) {
            const id = ids[index];
            const col = index % cfg.cols;
            const row = Math.floor(index / cfg.cols);
            const x = cfg.startX + col * (cfg.itemWidth + cfg.padding);
            const y = cfg.startY + row * (cfg.itemHeight + cfg.padding);

            if (sx >= x && sx <= x + cfg.itemWidth && sy >= y && sy <= y + cfg.itemHeight) {
                this.selectedTile = id;
                console.log(`[selector] Selected ${this.selectedLayer} tile: ${id}`);
                return true; // Clicked on selector
            }
        }
        return false; // Not on selector
    }
}