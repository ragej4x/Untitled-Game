
// Detect if device is mobile/Android
export function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Mobile touch controls state
export const mobileControls = {
    isActive: false,
    buttonSize: 60,
    padding: 20,
    touchInput: "none",
    voiceButtonPressed: false,
    muteButtonPressed: false,

    init() {
        if (isMobileDevice()) {
            this.isActive = true;
            console.log("Mobile device detected - activating touch controls");
            
            // Request landscape orientation
            if (window.screen && window.screen.orientation) {
                window.screen.orientation.lock('landscape').catch(err => {
                    console.log("Could not lock landscape orientation:", err);
                });
            }
        }
    },

    // Check if touch is on a button
    checkButtonTouches(x, y) {
        const buttonSize = this.buttonSize;
        const padding = this.padding;
        
        // Movement buttons (left side)
        const btnUp = { x: padding + buttonSize, y: padding, size: buttonSize };
        const btnDown = { x: padding + buttonSize, y: padding + buttonSize * 2, size: buttonSize };
        const btnLeft = { x: padding, y: padding + buttonSize, size: buttonSize };
        const btnRight = { x: padding + buttonSize * 2, y: padding + buttonSize, size: buttonSize };
        
        // Voice buttons (right side)
        const vcWidth = (windowWidth || 800) - padding - buttonSize;
        const btnVoice = { x: vcWidth, y: padding, size: buttonSize };
        const btnMute = { x: vcWidth, y: padding + buttonSize + 10, size: buttonSize };

        // Check movement buttons
        if (x >= btnUp.x && x <= btnUp.x + btnUp.size && y >= btnUp.y && y <= btnUp.y + btnUp.size) {
            this.touchInput = "up";
            return;
        }
        if (x >= btnDown.x && x <= btnDown.x + btnDown.size && y >= btnDown.y && y <= btnDown.y + btnDown.size) {
            this.touchInput = "down";
            return;
        }
        if (x >= btnLeft.x && x <= btnLeft.x + btnLeft.size && y >= btnLeft.y && y <= btnLeft.y + btnLeft.size) {
            this.touchInput = "left";
            return;
        }
        if (x >= btnRight.x && x <= btnRight.x + btnRight.size && y >= btnRight.y && y <= btnRight.y + btnRight.size) {
            this.touchInput = "right";
            return;
        }

        // Check voice buttons
        if (x >= btnVoice.x && x <= btnVoice.x + btnVoice.size && y >= btnVoice.y && y <= btnVoice.y + btnVoice.size) {
            this.voiceButtonPressed = true;
            return;
        }
        if (x >= btnMute.x && x <= btnMute.x + btnMute.size && y >= btnMute.y && y <= btnMute.y + btnMute.size) {
            this.muteButtonPressed = true;
            return;
        }
    },

    drawControls() {
        if (!this.isActive) return;

        const buttonSize = this.buttonSize;
        const padding = this.padding;
        
        // Cache window dimensions
        const vcWidth = (windowWidth || 800) - padding - buttonSize;

        // Optimize: set styles once
        stroke(200);
        strokeWeight(2);
        textSize(20);
        textAlign(CENTER, CENTER);

        // Draw movement buttons (left side) - simplified
        fill(100, 150, 255);
        
        // Up
        rect(padding + buttonSize, padding, buttonSize, buttonSize);
        fill(0);
        text("↑", padding + 1.5 * buttonSize, padding + buttonSize / 2);

        // Down
        fill(100, 150, 255);
        rect(padding + buttonSize, padding + buttonSize * 2, buttonSize, buttonSize);
        fill(0);
        text("↓", padding + 1.5 * buttonSize, padding + 2.5 * buttonSize);

        // Left
        fill(100, 150, 255);
        rect(padding, padding + buttonSize, buttonSize, buttonSize);
        fill(0);
        text("←", padding + buttonSize / 2, padding + 1.5 * buttonSize);

        // Right
        fill(100, 150, 255);
        rect(padding + buttonSize * 2, padding + buttonSize, buttonSize, buttonSize);
        fill(0);
        text("→", padding + 2.5 * buttonSize, padding + 1.5 * buttonSize);

        // Voice buttons - only render if mobile enabled
        fill(100, 255, 150);
        rect(vcWidth, padding, buttonSize, buttonSize);
        fill(0);
        textSize(14);
        text("VOICE", vcWidth + buttonSize / 2, padding + buttonSize / 2);

        fill(255, 150, 100);
        rect(vcWidth, padding + buttonSize + 10, buttonSize, buttonSize);
        fill(0);
        text("MUTE", vcWidth + buttonSize / 2, padding + buttonSize / 2 + buttonSize + 10);

        textAlign(LEFT, TOP);
    }
};

export function keyinput() {
    // Mobile touch input
    if (mobileControls.isActive && mobileControls.touchInput !== "none") {
        const input = mobileControls.touchInput;
        mobileControls.touchInput = "none";
        return input;
    }

    // Desktop keyboard input
    if (keyIsDown(73)) return "camUp";      // I
    if (keyIsDown(75)) return "camDown";    // K
    if (keyIsDown(74)) return "camLeft";    // J
    if (keyIsDown(76)) return "camRight";   // L

    if (keyIsDown(LEFT_ARROW)) return "left";
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