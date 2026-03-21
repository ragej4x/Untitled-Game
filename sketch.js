import {Player} from "./module/player.js";
import {keyinput} from "./module/keyinput.js";
import { Tilemap } from "./module/maploader.js";
import {Camera} from "./module/camera.js";
import {VoiceChat} from "./module/voicechat.js";

//socket
import {Socket} from "./module/backend/socket.js";

let socket = new Socket();
socket.init();

//initialization

let player = new Player();
let tilemap = new Tilemap();
let camera = new Camera(player);
let voiceChat = null;

window.preload = function(){
    // put a player image in this project path, or customize path
    // e.g., create a "assets" folder and place "player.png"
    const imgPath = "assets/test.png";
    player.sprite = loadImage(imgPath, () => {
        console.log("Player sprite loaded:", imgPath);
    }, (err) => {
        console.warn("Failed to load player sprite", imgPath, err);
        player.sprite = null;
    });
}

window.setup = function() {
    createCanvas(windowWidth,windowHeight);
    //surface = createGraphics(400,500);
    //surface.fill(255);
    frameRate(1000);
    //player.playerRect();

    // Initialize voice chat after a short delay to ensure socket is connected
    setTimeout(() => {
        voiceChat = new VoiceChat(socket);
        console.log("Voice chat initialized");
    }, 500);
}

window.draw = function() { 
    background(0);
    scale(2);

    if (!tilemap.editorMode) {
        player.move(keyinput());
        player.applyVelocityWithCollision(tilemap);

        // Send current player state to server each frame
        socket.sendPlayer(player);

        camera.update();
    }

    // Consume map data from server one time, then clear
    if (socket.mapData) {
        tilemap.setMap(socket.mapData);
        socket.mapData = null;
    }

    push();
    tilemap.load(camera);

    // draw other players from server state
    if (!tilemap.editorMode) {
        player.addNetworkPlayer(socket, camera);
        // draw this player
        player.draw(camera);
    }

    text(frameRate(), 10, 10);
    
    // Display voice chat status
    if (voiceChat) {
        const vcStatus = voiceChat.getStatus();
        fill(0, 200, 255);
        textSize(12);
        let vcText = "VOICE: ";
        if (vcStatus.enabled) {
            vcText += (vcStatus.muted ? "MUTED" : "ON") + ` (${vcStatus.activePeers} peers)`;
        } else {
            vcText += "OFF";
        }
        text(vcText, 10, 90);
    }
    
    // Display editor mode indicator
    if (tilemap.editorMode) {
        fill(255, 255, 0);
        textSize(16);
        text("EDITOR MODE - Press E to toggle, Click to paint, C to clear, S to save", 10, 30);
    }

    pop();
}

window.mousePressed = function() {
    if (tilemap.editorMode) {
        const world = tilemap.screenToWorld(mouseX, mouseY, camera);
        tilemap.toggleTile(world.x, world.y);
        return false;
    }
}

window.keyPressed = function() {
    // E key - toggle editor mode
    if (key.toLowerCase() === 'e') {
        tilemap.toggleEditorMode();
        return false;
    }
    // C key - clear map
    if (key.toLowerCase() === 'c' && tilemap.editorMode) {
        tilemap.clearMap();
        return false;
    }
    // S key - save/export map
    if (key.toLowerCase() === 's' && tilemap.editorMode) {
        console.log("Saving map...");
        tilemap.exportMapData();
        tilemap.saveMapToBackend(socket);
        return false;
    }
    // V key - toggle voice chat
    if (key.toLowerCase() === 'v') {
        if (voiceChat) {
            if (voiceChat.isEnabled) {
                voiceChat.stopVoiceChat();
            } else {
                voiceChat.startVoiceChat();
            }
        }
        return false;
    }
    // M key - toggle mute
    if (key.toLowerCase() === 'm') {
        if (voiceChat && voiceChat.isEnabled) {
            voiceChat.toggleMute();
        }
        return false;
    }
}

// Add global keydown listener to prevent browser defaults
document.addEventListener('keydown', function(e) {
    if (tilemap && tilemap.editorMode) {
        if (e.key.toLowerCase() === 's') {
            e.preventDefault();
            console.log("Prevented default S key behavior");
        }
        if (e.key.toLowerCase() === 'c') {
            e.preventDefault();
        }
    }
    if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
    }
    if (e.key.toLowerCase() === 'v') {
        e.preventDefault();
    }
    if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
    }
});