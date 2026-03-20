export class Tilemap {
    tile_size = 32;

    tile = [
        [0,0,0,0,0,0,0,0,0,0,0],
        [0,0,1,0,0,0,0,0,0,0,0],
        [0,0,1,0,0,0,0,0,0,0,0],
        [0,0,1,0,0,0,1,1,0,0,0],
        [0,0,1,0,0,0,0,1,0,0,0],
        [0,0,1,0,0,0,0,1,1,1,1],
    ];

    // Returns world-space rects of all solid tiles overlapping the player
    getOverlappingTiles(player) {
        let overlapping = [];

        for (let y = 0; y < this.tile.length; y++) {
            for (let x = 0; x < this.tile[y].length; x++) {
                if (this.tile[y][x] !== 1) continue;

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
        for (let y = 0; y < this.tile.length; y++) {
            for (let x = 0; x < this.tile[y].length; x++) {
                if (this.tile[y][x] === 1) {
                    rect(
                        x * this.tile_size - camera.cx,
                        y * this.tile_size - camera.cy,
                        this.tile_size,
                        this.tile_size
                    );
                }
            }
        }
    }
}