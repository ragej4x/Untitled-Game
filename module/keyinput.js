
export function keyinput(){
    if (keyIsDown(LEFT_ARROW))return "left";
        
    if (keyIsDown(RIGHT_ARROW)) return "right";
    
    if (keyIsDown(UP_ARROW)) return "up";

    if (keyIsDown(DOWN_ARROW)) return "down";


  // W = move up
  if (keyIsDown(87)) return "up";

  // S = move down
  if (keyIsDown(83)) return "down";

  // A = move left
  if (keyIsDown(65)) return "left";

  // D = move right
  if (keyIsDown(68)) return "right";
    return "none";

}