import {Player} from "./module/player.js";
import {keyinput} from "./module/keyinput.js";
import { Tilemap } from "./module/maploader.js";
import {Camera} from "./module/camera.js";

//socket
import {Socket} from "./module/backend/socket.js";

let socket = new Socket();

socket.init();

//initialization

let player = new Player();
let tilemap = new Tilemap();
let camera = new Camera(player);


window.setup = function() {
    createCanvas(windowWidth,windowHeight);
    //surface = createGraphics(400,500);
    //surface.fill(255);
    frameRate(1000);

    
}

window.draw = function() { 
    background(0);
    scale(2);

    player.move(keyinput());
    player.applyVelocityWithCollision(tilemap);

    // Send current player state to server each frame
    socket.sendPlayer(player);

    camera.update();

    push();
    tilemap.load(camera);

    // draw other players from server state
    player.addNetworkPlayer(socket,camera);

    // draw this player
    //fill(0, 255, 0);
    player.draw(camera);
    text(frameRate(),10,10);
    pop();
    
}



