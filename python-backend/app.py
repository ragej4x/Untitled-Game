import socketio
import json
import os

sio = socketio.Server(cors_allowed_origins="*")
app = socketio.WSGIApp(sio)

players = {}

# Load map data from file
def _load_csv_map(filepath):
    try:
        with open(filepath, 'r') as f:
            lines = [ln.strip() for ln in f.read().strip().split('\n') if ln.strip()]
            return [list(map(int, line.split(','))) for line in lines]
    except Exception as e:
        print(f"Error loading map from {filepath}: {e}")
        return []


def load_tilemap():
    base_dir = os.path.dirname(__file__)

    tilemap_file = os.path.join(base_dir, 'tilemap_data.txt')
    tiles = _load_csv_map(tilemap_file)

    furniture_file = os.path.join(base_dir, 'layer1.txt')
    furniture = _load_csv_map(furniture_file)

    if not furniture and tiles:
        furniture = [[0 for _ in row] for row in tiles]

    return {
        "tile_size": 16,
        "tiles": tiles,
        "furniture": furniture
    }


tilemap = load_tilemap()

@sio.event
def connect(sid, environ):
    print("Player connected:", sid)
    # Create a default player object for new connection
    players[sid] = {
        "x": 100,
        "y": 100,
        "id": sid,
        "color": "white"
    }
    sio.emit("players", players)
    # Push map data to the newly connected client only
    sio.emit("map_data", tilemap, room=sid)

@sio.event
def request_map(sid):
    sio.emit("map_data", tilemap, room=sid)

@sio.event
def update_player(sid, data):
    players[sid] = data
    sio.emit("players", players)

@sio.event
def save_map(sid, data):
    global tilemap
    if not isinstance(data, dict):
        return

    tile_size = data.get("tile_size", tilemap.get("tile_size", 16))
    tiles = data.get("tiles", tilemap.get("tiles", []))
    furniture = data.get("furniture", tilemap.get("furniture", []))

    # Keep metadata from front-end if present
    tilemap = {
        "tile_size": tile_size,
        "tiles": tiles,
        "furniture": furniture
    }

    base_dir = os.path.dirname(__file__)
    tilemap_file = os.path.join(base_dir, 'tilemap_data.txt')
    layer1_file = os.path.join(base_dir, 'layer1.txt')

    try:
        with open(tilemap_file, 'w') as f:
            for row in tiles:
                f.write(','.join(str(int(v)) for v in row) + '\n')
        print("Saved map data to", tilemap_file)
    except Exception as e:
        print(f"Error saving map data: {e}")

    try:
        with open(layer1_file, 'w') as f:
            for row in furniture:
                f.write(','.join(str(int(v)) for v in row) + '\n')
        print("Saved furniture layer to", layer1_file)
    except Exception as e:
        print(f"Error saving furniture layer: {e}")

    # Broadcast update to all clients so reload is immediate
    sio.emit("map_data", tilemap)

@sio.event
def disconnect(sid):
    print("Player disconnected:", sid)
    if sid in players:
        del players[sid]

if __name__ == '__main__':
    import eventlet
    eventlet.wsgi.server(eventlet.listen(('0.0.0.0', 5000)), app)