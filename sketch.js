import {Player} from "./module/player.js";
import {keyinput, mobileControls} from "./module/keyinput.js";
import { Tilemap } from "./module/maploader.js";
import {Camera} from "./module/camera.js";
import {PlayerAnimator} from "./module/animation.js";
//import {VoiceChat} from "./module/voicechat.js";

//socket
import {Socket} from "./module/backend/socket.js";

let socket = new Socket();
socket.init();

//initialization

let player = new Player();
let tilemap = new Tilemap();
let camera = new Camera(player);
let animator = null;
let frameGroups = null; // Store globally for network players
//let voiceChat = null;

window.preload = function(){
    // Load animation frames
    frameGroups = {
        idle_default: [
            loadImage("assets/anim/id1.anim"),
            loadImage("assets/anim/id2.anim"),
            loadImage("assets/anim/id3.anim"),
            loadImage("assets/anim/id4.anim"),
            loadImage("assets/anim/id5.anim"),
            loadImage("assets/anim/id6.anim")
        ],
        idle_down: [
            loadImage("assets/anim/idD1.anim"),
            loadImage("assets/anim/idD2.anim"),
            loadImage("assets/anim/idD3.anim"),
            loadImage("assets/anim/idD4.anim"),
            loadImage("assets/anim/idD5.anim"),
            loadImage("assets/anim/idD6.anim")
        ],
        idle_up: [
            loadImage("assets/anim/idU1.anim"),
            loadImage("assets/anim/idU2.anim"),
            loadImage("assets/anim/idU3.anim"),
            loadImage("assets/anim/idU4.anim"),
            loadImage("assets/anim/idU5.anim"),
            loadImage("assets/anim/idU6.anim")
        ],
        idle_left: [
            loadImage("assets/anim/id1.anim"),
            loadImage("assets/anim/id2.anim"),
            loadImage("assets/anim/id3.anim"),
            loadImage("assets/anim/id4.anim"),
            loadImage("assets/anim/id5.anim"),
            loadImage("assets/anim/id6.anim")
        ],
        walk_default: [
            loadImage("assets/anim/r1.anim"),
            loadImage("assets/anim/r2.anim"),
            loadImage("assets/anim/r3.anim"),
            loadImage("assets/anim/r4.anim"),
            loadImage("assets/anim/r5.anim"),
            loadImage("assets/anim/r6.anim")
        ],
        walk_down: [
            loadImage("assets/anim/rD1.anim"),
            loadImage("assets/anim/rD2.anim"),
            loadImage("assets/anim/rD3.anim"),
            loadImage("assets/anim/rD4.anim"),
            loadImage("assets/anim/rD5.anim"),
            loadImage("assets/anim/rD6.anim")
        ],
        walk_up: [
            loadImage("assets/anim/rU1.anim"),
            loadImage("assets/anim/rU2.anim"),
            loadImage("assets/anim/rU3.anim"),
            loadImage("assets/anim/rU4.anim"),
            loadImage("assets/anim/rU5.anim"),
            loadImage("assets/anim/rU6.anim")
        ],
        walk_left: [
            loadImage("assets/anim/r1.anim"),
            loadImage("assets/anim/r2.anim"),
            loadImage("assets/anim/r3.anim"),
            loadImage("assets/anim/r4.anim"),
            loadImage("assets/anim/r5.anim"),
            loadImage("assets/anim/r6.anim")
        ],
        walk_right: [
            loadImage("assets/anim/r1.anim"),
            loadImage("assets/anim/r2.anim"),
            loadImage("assets/anim/r3.anim"),
            loadImage("assets/anim/r4.anim"),
            loadImage("assets/anim/r5.anim"),
            loadImage("assets/anim/r6.anim")
        ]
    };
    
    animator = new PlayerAnimator(frameGroups, { frameDelay: 100 });
    player.setAnimator(animator);
    // Load block/tile metadata from blocks.json
    tilemap.loadBlockConfig('assets/blocks.json');
}

window.setup = function() {
    createCanvas(windowWidth,windowHeight);
    //surface = createGraphics(400,500);
    //surface.fill(255);
    frameRate(1000);
    //player.playerRect();
    noSmooth();

    // Initialize mobile controls
    mobileControls.init();

    // Initialize voice chat after a short delay to ensure socket is connected
    //setTimeout(() => {
    //    voiceChat = new VoiceChat(socket);
    //    console.log("Voice chat initialized");
    //}, 500);
    
}

window.draw = function() { 
    background(0);
    scale(3.5);

    if (!tilemap.editorMode) {
        player.move(keyinput());
        player.applyVelocityWithCollision(tilemap);

        // Send current player state to server each frame
        socket.sendPlayer(player);

        camera.update();
    } else {
        // Editor camera control (i,k,j,l)
        const camInput = keyinput();
        const cameraSpeed = 5;
        if (camInput === 'camUp') camera.cy -= cameraSpeed;
        if (camInput === 'camDown') camera.cy += cameraSpeed;
        if (camInput === 'camLeft') camera.cx -= cameraSpeed;
        if (camInput === 'camRight') camera.cx += cameraSpeed;
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
        player.addNetworkPlayer(socket, camera, frameGroups);
        // draw this player
        player.draw(camera);
    }

    text(frameRate(), 10, 10);
    
    // Display voice chat status - optimized rendering
    //if (voiceChat && voiceChat.isEnabled) {
    //    const vcStatus = voiceChat.getStatus();
    //    fill(0, 200, 255);
    //    textSize(12);
    //    text(`VOICE: ${vcStatus.muted ? "MUTED" : "ON"} (${vcStatus.activePeers}p)`, 10, 90);
    //}
    
    // Display editor mode indicator
    if (tilemap.editorMode) {
        //fill(255, 255, 0);
        textSize(16);
        //text("EDITOR MODE - Press E to toggle, Click to paint, C to clear, S to save", 10, 30);
    }

    pop();

    // Draw mobile controls if on mobile device
    mobileControls.drawControls();
    
    // Handle mobile voice button press
    //if (mobileControls.voiceButtonPressed && voiceChat) {
    //    mobileControls.voiceButtonPressed = false;
    //    if (voiceChat.isEnabled) {
    //        voiceChat.stopVoiceChat();
    //    } else {
    //        voiceChat.startVoiceChat();
    //    }
    //}

    // Handle mobile mute button press
    //if (mobileControls.muteButtonPressed && voiceChat && voiceChat.isEnabled) {
    //    mobileControls.muteButtonPressed = false;
    //    voiceChat.toggleMute();
    //}
}

window.mousePressed = function() {
    if (tilemap.editorMode) {
        if (!tilemap.handleClick(mouseX, mouseY)) {
            const world = tilemap.screenToWorld(mouseX, mouseY, camera);
            tilemap.toggleTile(world.x, world.y);
        }
        return false;
    }
}

window.keyPressed = function() {
    // E key - toggle editor mode
    if (key.toLowerCase() === 'e') {
        tilemap.toggleEditorMode();
        return false;
    }
    // F key - toggle selected editing layer (ground/furniture)
    if (key.toLowerCase() === 'f' && tilemap.editorMode) {
        tilemap.selectedLayer = tilemap.selectedLayer === 'ground' ? 'furniture' : 'ground';
        console.log('Selected layer:', tilemap.selectedLayer);
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
    //if (e.key.toLowerCase() === 'v') {
    //    e.preventDefault();
    //}
    //if (e.key.toLowerCase() === 'm') {
    //    e.preventDefault();
    //}
});

// Touch event handlers for mobile controls
window.touchStarted = function() {
    if (mobileControls.isActive && touches.length > 0) {
        const touch = touches[0];
        mobileControls.checkButtonTouches(touch.x, touch.y);
        return false;
    }
}

window.touchEnded = function() {
    if (mobileControls.isActive) {
        mobileControls.touchInput = "none";
    }
}