import socketio

sio = socketio.Server(cors_allowed_origins="*")
app = socketio.WSGIApp(sio)

players = {}

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