export class Animation {
    constructor(frames = [], flipH = false, colorKey = null) {
        this.frames = frames; // Array of image objects
        this.currentFrame = 0;
        this.elapsedTime = 0; // Time elapsed in milliseconds
        this.frameDelay = 100; // Delay between frames in milliseconds
        this.isPlaying = true;
        this.isLooping = true;
        this.flipH = flipH; // Flip horizontally
        this.colorKey = colorKey; // Color key for transparency [r, g, b]
    }

    setFrameDelay(delay) {
        this.frameDelay = delay;
    }

    setFrames(frames) {
        this.frames = frames;
        this.currentFrame = 0;
    }

    setFlipH(flip) {
        this.flipH = flip;
    }

    setColorKey(r, g, b) {
        this.colorKey = [r, g, b];
    }

    update(deltaTime = 16.67) {
        if (!this.isPlaying || this.frames.length === 0) return;

        this.elapsedTime += deltaTime;
        while (this.elapsedTime >= this.frameDelay) {
            this.elapsedTime -= this.frameDelay;
            this.currentFrame++;

            if (this.currentFrame >= this.frames.length) {
                if (this.isLooping) {
                    this.currentFrame = 0;
                } else {
                    this.currentFrame = this.frames.length - 1;
                    this.isPlaying = false;
                    break;
                }
            }
        }
    }

    draw(x, y, width, height) {
        if (!this.frames || this.frames.length === 0) return;
        if (!this.frames[this.currentFrame]) return;

        const frame = this.frames[this.currentFrame];

        if (this.flipH) {
            push();
            translate(x + width / 2, y);
            scale(-1, 1);
            if (this.colorKey) {
                this._drawWithColorKey(frame, -width / 2, 0, width, height);
            } else {
                image(frame, -width / 2, 0, width, height);
            }
            pop();
        } else {
            if (this.colorKey) {
                this._drawWithColorKey(frame, x, y, width, height);
            } else {
                image(frame, x, y, width, height);
            }
        }
    }

    _drawWithColorKey(frame, x, y, width, height) {
        // Draw frame with color key transparency
        // Color key pixels will be skipped (not drawn)
        const [keyR, keyG, keyB] = this.colorKey;
        const tolerance = 5; // Tolerance for color matching

        frame.loadPixels();
        const pixelData = frame.pixels;
        const srcW = frame.width;
        const srcH = frame.height;

        // Create temporary image for color-keyed version
        let tempImg = createImage(srcW, srcH);
        tempImg.loadPixels();

        for (let i = 0; i < pixelData.length; i += 4) {
            const r = pixelData[i];
            const g = pixelData[i + 1];
            const b = pixelData[i + 2];
            const a = pixelData[i + 3];

            // Check if pixel matches color key
            if (Math.abs(r - keyR) < tolerance &&
                Math.abs(g - keyG) < tolerance &&
                Math.abs(b - keyB) < tolerance) {
                // Make transparent
                tempImg.pixels[i + 3] = 0;
            } else {
                // Copy pixel as-is
                tempImg.pixels[i] = r;
                tempImg.pixels[i + 1] = g;
                tempImg.pixels[i + 2] = b;
                tempImg.pixels[i + 3] = a;
            }
        }

        tempImg.updatePixels();
        image(tempImg, x, y, width, height);
    }

    reset() {
        this.currentFrame = 0;
        this.elapsedTime = 0;
        this.isPlaying = true;
    }

    stop() {
        this.isPlaying = false;
    }

    play() {
        this.isPlaying = true;
    }

    getCurrentFrame() {
        return this.currentFrame;
    }
}

export class PlayerAnimator {
    constructor(frameGroups = {}, config = {}) {
        this.animations = {};
        this.currentAnimation = null;
        this.currentDirection = 'down'; // Default facing direction
        
        // Configuration
        this.config = {
            frameDelay: config.frameDelay || 100, // milliseconds
            ...config
        };

        this.initAnimations(frameGroups);
    }

    initAnimations(frameGroups) {
        // Create animations from frame groups
        // Expected structure:
        // {
        //   idle_default: [img1, img2, ...],
        //   walk_right: [img1, img2, ...],
        //   walk_left: [img1, img2, ...], // flipped versions
        //   ...
        // }
        
        for (const [name, frameData] of Object.entries(frameGroups)) {
            let frames = frameData;
            let flipH = false;
            
            // Check if this is a flipped animation (name end with _flipped)
            if (name.includes('_left')) {
                flipH = true;
            }
            
            if (Array.isArray(frames) && frames.length > 0) {
                const anim = new Animation(frames, flipH, [255, 0, 255]); // Magenta color key
                anim.setFrameDelay(this.config.frameDelay);
                anim.isLooping = true;
                this.animations[name] = anim;
            }
        }

        // Set default animation
        if (this.animations['idle_default']) {
            this.setAnimation('idle_default');
        } else if (this.animations['idle_down']) {
            this.setAnimation('idle_down');
        } else {
            // Fallback to first animation
            const firstKey = Object.keys(this.animations)[0];
            if (firstKey) {
                this.setAnimation(firstKey);
            }
        }
    }

    setAnimation(name) {
        if (!this.animations[name]) return;

        if (this.currentAnimation) {
            this.currentAnimation.stop();
        }

        this.currentAnimation = this.animations[name];
        this.currentAnimation.reset();
        this.currentAnimation.play();
    }

    playAnimation(name) {
        if (this.currentAnimation && this.currentAnimation === this.animations[name]) {
            return; // Already playing
        }
        this.setAnimation(name);
    }

    update(direction, lastDirection = 'down', deltaTime = 16.67) {
        if (!this.currentAnimation) return;

        // Update current direction
        if (direction && direction !== "none") {
            this.currentDirection = direction;
        }

        // Select animation based on movement and direction
        let animName;
        const normalizedDir = lastDirection || this.currentDirection;
        
        if (direction && direction !== "none") {
            // Player is moving - use walk animation
            animName = `walk_${normalizedDir}`;
        } else {
            // Player is idle - use idle animation
            animName = `idle_${normalizedDir}`;
        }

        // Fallback to available animations if exact direction not found
        if (!this.animations[animName]) {
            if (direction && direction !== "none") {
                // Try to find any walk animation
                const walkAnims = Object.keys(this.animations).filter(k => k.startsWith('walk_'));
                if (walkAnims.length > 0) {
                    animName = walkAnims[0];
                }
            } else {
                // Try to find any idle animation
                const idleAnims = Object.keys(this.animations).filter(k => k.startsWith('idle_'));
                if (idleAnims.length > 0) {
                    animName = idleAnims[0];
                }
            }
        }

        // Switch to the appropriate animation
        if (this.animations[animName] && this.currentAnimation !== this.animations[animName]) {
            this.playAnimation(animName);
        }

        this.currentAnimation.update(deltaTime);
    }

    draw(x, y, width, height) {
        if (this.currentAnimation) {
            this.currentAnimation.draw(x, y, width, height);
        }
    }

    getAnimationNames() {
        return Object.keys(this.animations);
    }
}
