export class VoiceChat {
    constructor(socket) {
        this.socket = socket;
        this.localStream = null;
        this.peerConnections = {};
        this.isEnabled = false;
        this.isMuted = false;
        
        // WebRTC configuration
        this.peerConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        this.setupSocketListeners();
    }

    setupSocketListeners() {
        // Listen for offer from other peers
        this.socket.socket.on("voice_offer", (data) => {
            console.log("Received voice offer from:", data.from);
            this.handleVoiceOffer(data);
        });

        // Listen for answer from other peers
        this.socket.socket.on("voice_answer", (data) => {
            console.log("Received voice answer from:", data.from);
            this.handleVoiceAnswer(data);
        });

        // Listen for ICE candidates
        this.socket.socket.on("voice_ice_candidate", (data) => {
            console.log("Received ICE candidate from:", data.from);
            this.handleIceCandidate(data);
        });

        // Listen for new players
        this.socket.socket.on("players", (data) => {
            if (this.isEnabled) {
                this.initiatePeerConnections(data);
            }
        });

        // Listen for user disconnect
        this.socket.socket.on("disconnect", () => {
            this.closePeerConnections();
        });
    }

    // Initiate connections with all players
    async initiatePeerConnections(players) {
        for (let peerId in players) {
            if (peerId === this.socket.ownSid) continue; // Skip self
            if (this.peerConnections[peerId]) continue; // Skip if already connected
            
            // Only initiator creates offer (use alphabetical order to avoid duplicates)
            const shouldInitiate = this.socket.ownSid > peerId;
            if (shouldInitiate) {
                console.log("Initiating connection with:", peerId);
                await this.createPeerConnection(peerId, true);
            }
        }
    }

    async startVoiceChat() {
        if (this.isEnabled) return;

        try {
            // Request microphone access
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: false
            });

            this.isEnabled = true;
            console.log("Voice chat enabled, microphone access granted");

            // Notify server we're ready for voice chat
            this.socket.socket.emit("voice_chat_ready", {
                id: this.socket.ownSid
            });

            // Create connections with all connected players
            console.log("Current network players:", this.socket.networkPlayers);
            if (this.socket.networkPlayers && Object.keys(this.socket.networkPlayers).length > 0) {
                await this.initiatePeerConnections(this.socket.networkPlayers);
            }

        } catch (error) {
            console.error("Error accessing microphone:", error);
            alert("Microphone access denied. Check your browser permissions.");
            this.isEnabled = false;
        }
    }

    stopVoiceChat() {
        if (!this.isEnabled) return;

        // Stop all tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        // Close all peer connections
        this.closePeerConnections();

        this.isEnabled = false;
        console.log("Voice chat disabled");
    }

    toggleMute() {
        if (!this.isEnabled) return;

        this.isMuted = !this.isMuted;
        this.localStream.getTracks().forEach(track => {
            track.enabled = !this.isMuted;
        });

        console.log(this.isMuted ? "Microphone muted" : "Microphone unmuted");
        return this.isMuted;
    }

    closePeerConnections() {
        for (let peerId in this.peerConnections) {
            const peerConnection = this.peerConnections[peerId];
            peerConnection.close();
        }
        this.peerConnections = {};
    }

    async createPeerConnection(peerId, initiator = false) {
        if (this.peerConnections[peerId]) {
            console.log("Peer connection already exists with:", peerId);
            return this.peerConnections[peerId];
        }

        console.log(`Creating peer connection with ${peerId} (initiator: ${initiator})`);

        const peerConnection = new RTCPeerConnection({
            iceServers: this.peerConfig.iceServers
        });

        this.peerConnections[peerId] = peerConnection;

        // Add local stream tracks to peer connection
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream);
                console.log("Added audio track to peer:", peerId);
            });
        } else {
            console.warn("No local stream available for peer:", peerId);
        }

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("Sending ICE candidate to:", peerId);
                this.socket.socket.emit("voice_ice_candidate", {
                    to: peerId,
                    from: this.socket.ownSid,
                    candidate: event.candidate
                });
            }
        };

        // Handle remote stream
        peerConnection.ontrack = (event) => {
            console.log("Received remote audio track from:", peerId);
            // Create audio element for remote stream
            this.playRemoteStream(peerId, event.streams[0]);
        };

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log(`Connection state with ${peerId}:`, peerConnection.connectionState);
            if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
                console.log("Closing failed connection with:", peerId);
                peerConnection.close();
                delete this.peerConnections[peerId];
            }
        };

        // If initiator, create offer
        if (initiator) {
            try {
                console.log("Creating offer for:", peerId);
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                console.log("Sending offer to:", peerId);
                this.socket.socket.emit("voice_offer", {
                    to: peerId,
                    from: this.socket.ownSid,
                    offer: offer
                });
            } catch (error) {
                console.error("Error creating offer for", peerId, ":", error);
            }
        }

        return peerConnection;
    }

    async handleVoiceOffer(data) {
        const { from, offer } = data;

        let peerConnection = await this.createPeerConnection(from, false);

        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            this.socket.socket.emit("voice_answer", {
                to: from,
                from: this.socket.ownSid,
                answer: answer
            });
            console.log("Voice answer sent to:", from);
        } catch (error) {
            console.error("Error handling offer:", error);
        }
    }

    async handleVoiceAnswer(data) {
        const { from, answer } = data;

        if (this.peerConnections[from]) {
            try {
                await this.peerConnections[from].setRemoteDescription(new RTCSessionDescription(answer));
                console.log("Voice answer received from:", from);
            } catch (error) {
                console.error("Error handling answer:", error);
            }
        }
    }

    async handleIceCandidate(data) {
        const { from, candidate } = data;

        if (this.peerConnections[from]) {
            try {
                await this.peerConnections[from].addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error("Error adding ICE candidate:", error);
            }
        }
    }

    playRemoteStream(peerId, stream) {
        // Create audio element for remote stream
        let audioElement = document.getElementById(`audio-${peerId}`);
        
        if (!audioElement) {
            audioElement = document.createElement('audio');
            audioElement.id = `audio-${peerId}`;
            audioElement.autoplay = true;
            audioElement.playsinline = true;
            audioElement.style.display = 'none';  // Hide audio element (audio only)
            document.body.appendChild(audioElement);
            console.log("Created audio element for peer:", peerId);
        }

        audioElement.srcObject = stream;
        console.log("Remote stream connected for peer:", peerId);
    }

    // Get voice chat status
    getStatus() {
        const activePeerCount = Object.keys(this.peerConnections).length;
        console.log(`Voice status - Enabled: ${this.isEnabled}, Muted: ${this.isMuted}, Peers: ${activePeerCount}`);
        return {
            enabled: this.isEnabled,
            muted: this.isMuted,
            activePeers: activePeerCount
        };
    }
}
