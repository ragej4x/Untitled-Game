export class Camera {
    constructor(player) {
        this.player = player;
        this.cx = player.x;
        this.cy = player.y;

        this.offsetX = 0;
        this.offsetY = 0;
    }

    update() {
        this.cx += (this.player.x - this.cx - window.innerWidth / 4) * 0.07;
        this.cy += (this.player.y - this.cy - window.innerHeight /4) * 0.07;

        // store screen center inside camera
        this.offsetX = windowWidth ;
        this.offsetY = windowHeight;


        //console.log(this.cx,this.cy);
    }

    center() {

    }
}