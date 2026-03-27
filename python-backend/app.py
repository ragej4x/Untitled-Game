import socketio
import json
import os
from flask import Flask, request, jsonify, make_response

# Create Flask app for HTTP endpoints
flask_app = Flask(__name__)

# Add CORS support to Flask app
@flask_app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

@flask_app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        return response

# Increase buffer size to handle large tile maps (default is 1MB, set to 100MB)
sio = socketio.Server(
    cors_allowed_origins="*",
    max_http_buffer_size=100 * 1024 * 1024,  # 100MB
    ping_timeout=120,
    ping_interval=25
)
app = socketio.WSGIApp(sio, flask_app)

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

# HTTP endpoint to list and auto-generate tile metadata from folder contents
@flask_app.route('/api/list-images', methods=['GET'])
def list_images():
    """
    List images in a folder and optionally auto-generate tile metadata.
    Query params:
      - folder: path/to/folder (required)
      - startID: starting tile ID for auto-generation (optional)
      - tag: category name for auto-generated tiles (optional)
      - fileExtension: file extension to filter (default: .png)
    
    Returns JSON:
      - Without startID: {"images": ["file1.png", ...], "count": N}
      - With startID: {"tiles": [{"id": 1, "name": "tag", "image": "path/file.png"}, ...], "count": N}
    """
    folder_path = request.args.get('folder', '')
    start_id = request.args.get('startID', None)
    tag = request.args.get('tag', '')
    file_extension = request.args.get('fileExtension', '.png').lower()
    
    if not folder_path:
        return jsonify({"error": "folder parameter required"}), 400
    
    # Security: prevent directory traversal attacks
    if '..' in folder_path or folder_path.startswith('/'):
        return jsonify({"error": "invalid folder path"}), 400
    
    # Get absolute path relative to server
    base_dir = os.path.dirname(__file__)
    abs_path = os.path.join(base_dir, '..', folder_path)
    abs_path = os.path.abspath(abs_path)
    
    # Verify folder exists and is within project
    project_root = os.path.abspath(os.path.join(base_dir, '..'))
    if not abs_path.startswith(project_root) or not os.path.isdir(abs_path):
        return jsonify({"error": f"folder not found: {folder_path}"}), 404
    
    try:
        # Ensure file extension starts with a dot
        if not file_extension.startswith('.'):
            file_extension = '.' + file_extension
        
        # List all files matching extension
        filtered_files = sorted([f for f in os.listdir(abs_path) if f.lower().endswith(file_extension)])
        
        # Auto-generate tile metadata if startID and tag are provided
        if start_id is not None and tag:
            try:
                start_id_int = int(start_id)
                tiles = []
                for idx, filename in enumerate(filtered_files):
                    tile_id = start_id_int + idx
                    relative_path = os.path.join(folder_path, filename).replace('\\', '/')
                    tiles.append({
                        "id": tile_id,
                        "name": tag,
                        "image": relative_path,
                        "filename": filename
                    })
                return jsonify({"tiles": tiles, "count": len(tiles)})
            except ValueError:
                return jsonify({"error": "startID must be an integer"}), 400
        else:
            # Simple file listing without tile metadata
            relative_paths = [os.path.join(folder_path, f).replace('\\', '/') for f in filtered_files]
            return jsonify({"images": relative_paths, "count": len(relative_paths)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# HTTP endpoint for health check
@flask_app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})

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
        print("ERROR: save_map received non-dict data:", type(data))
        return {"success": False, "error": "Invalid data format"}

    tile_size = data.get("tile_size", tilemap.get("tile_size", 16))
    tiles = data.get("tiles", tilemap.get("tiles", []))
    furniture = data.get("furniture", tilemap.get("furniture", []))

    print(f"\n=== SAVE_MAP EVENT ===")
    print(f"Received {len(tiles)} tile rows")
    if tiles and len(tiles) > 0:
        print(f"  Tile[0] has {len(tiles[0])} columns")
        tiles_count = sum(sum(1 for cell in row if cell != 0) for row in tiles)
        print(f"  Total non-zero tile cells: {tiles_count}")
    
    print(f"Received {len(furniture)} furniture rows")
    if furniture and len(furniture) > 0:
        print(f"  Furniture[0] has {len(furniture[0])} columns")
        furniture_count = sum(sum(1 for cell in row if cell != 0) for row in furniture)
        print(f"  Total non-zero furniture cells: {furniture_count}")
    else:
        print("  WARNING: Furniture is empty or not provided!")

    # Keep metadata from front-end if present
    tilemap = {
        "tile_size": tile_size,
        "tiles": tiles,
        "furniture": furniture
    }

    base_dir = os.path.dirname(__file__)
    tilemap_file = os.path.join(base_dir, 'tilemap_data.txt')
    layer1_file = os.path.join(base_dir, 'layer1.txt')
    
    errors = []

    try:
        with open(tilemap_file, 'w') as f:
            for row in tiles:
                f.write(','.join(str(int(v)) for v in row) + '\n')
        print(f"✓ Saved map data to {tilemap_file} ({len(tiles)} rows)")
    except Exception as e:
        error_msg = f"Error saving map data: {e}"
        print(f"✗ {error_msg}")
        errors.append(error_msg)

    try:
        with open(layer1_file, 'w') as f:
            for row in furniture:
                f.write(','.join(str(int(v)) for v in row) + '\n')
        print(f"✓ Saved furniture layer to {layer1_file} ({len(furniture)} rows)")
    except Exception as e:
        error_msg = f"Error saving furniture layer: {e}"
        print(f"✗ {error_msg}")
        errors.append(error_msg)

    print(f"=== END SAVE_MAP ===\n")

    # Broadcast update to all clients so reload is immediate
    sio.emit("map_data", tilemap)
    
    # Return success/failure response
    if errors:
        return {"success": False, "error": " | ".join(errors)}
    else:
        return {"success": True}

@sio.event
def disconnect(sid):
    print("Player disconnected:", sid)
    if sid in players:
        del players[sid]

if __name__ == '__main__':
    import eventlet
    eventlet.wsgi.server(eventlet.listen(('0.0.0.0', 5000)), app)