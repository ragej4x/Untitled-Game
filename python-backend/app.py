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
                "tile_size": 32,
                "tiles": tiles
            }
    except Exception as e:
        print(f"Error loading tilemap: {e}")
        return {
            "tile_size": 32,
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

@sio.event
def save_map(sid, data):
    global tilemap
    tilemap = data
    save_tilemap_to_file(data)
    print("Map saved by player:", sid)
    sio.emit("map_saved", {"status": "success", "message": "Map saved successfully"}, room=sid)

def save_tilemap_to_file(map_data):
    tilemap_file = os.path.join(os.path.dirname(__file__), 'tilemap_data.txt')
    try:
        with open(tilemap_file, 'w') as f:
            for row in map_data['tiles']:
                f.write(','.join(map(str, row)) + '\n')
        print(f"Tilemap saved to {tilemap_file}")
    except Exception as e:
        print(f"Error saving tilemap: {e}")

# Voice chat events - forward signaling between peers
@sio.event
def voice_chat_ready(sid, data):
    print("Player ready for voice chat:", sid)
    sio.emit("players_online", {"ready_for_voice": list(players.keys())})

@sio.event
def voice_offer(sid, data):
    print(f"Voice offer from {sid} to {data.get('to')}")
    sio.emit("voice_offer", data, room=data.get('to'))

@sio.event
def voice_answer(sid, data):
    print(f"Voice answer from {sid} to {data.get('to')}")
    sio.emit("voice_answer", data, room=data.get('to'))

@sio.event
def voice_ice_candidate(sid, data):
    sio.emit("voice_ice_candidate", data, room=data.get('to'))

if __name__ == '__main__':
    import eventlet
    eventlet.wsgi.server(eventlet.listen(('0.0.0.0', 5000)), app)