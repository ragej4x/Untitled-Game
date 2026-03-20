
export function keyinput(){
    if (keyIsDown(LEFT_ARROW)){
        return "left";
    }
    if (keyIsDown(RIGHT_ARROW)){
        return "right";
    }
    if (keyIsDown(UP_ARROW)){
        return "up";
    }
    if (keyIsDown(DOWN_ARROW)){
        return "down";
    }
    return "none";

}