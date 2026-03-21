import socketio
import json
import os

sio = socketio.Server(cors_allowed_origins="*")
app = socketio.WSGIApp(sio)

players = {}

# Load map data from file
def load_tilemap():
    tilemap_file = os.path.join(os.path.dirname(__file__), 'tilemap_data.txt')
    try:
        with open(tilemap_file, 'r') as f:
            lines = f.read().strip().split('\n')
            tiles = [list(map(int, line.split(','))) for line in lines]
            return {
                "tile_size": 16,
                "tiles": tiles
            }
    except Exception as e:
        print(f"Error loading tilemap: {e}")
        return {
            "tile_size": 16,
            "tiles": []
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
def disconnect(sid):
    print("Player disconnected:", sid)
    if sid in players:
        del players[sid]

if __name__ == '__main__':
    import eventlet
    eventlet.wsgi.server(eventlet.listen(('0.0.0.0', 5000)), app)