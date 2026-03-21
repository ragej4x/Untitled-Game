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

        // Listen for user disconnect
        this.socket.socket.on("disconnect", () => {
            this.closePeerConnections();
        });
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

        } catch (error) {
            console.error("Error accessing microphone:", error);
            alert("Microphone access denied. Check your browser permissions.");
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
            return this.peerConnections[peerId];
        }

        const peerConnection = new RTCPeerConnection({
            iceServers: this.peerConfig.iceServers
        });

        this.peerConnections[peerId] = peerConnection;

        // Add local stream tracks to peer connection
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream);
            });
        }

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
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
                peerConnection.close();
                delete this.peerConnections[peerId];
            }
        };

        // If initiator, create offer
        if (initiator) {
            try {
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                this.socket.socket.emit("voice_offer", {
                    to: peerId,
                    from: this.socket.ownSid,
                    offer: offer
                });
            } catch (error) {
                console.error("Error creating offer:", error);
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
        } catch (error) {
            console.error("Error handling offer:", error);
        }
    }

    async handleVoiceAnswer(data) {
        const { from, answer } = data;

        if (this.peerConnections[from]) {
            try {
                await this.peerConnections[from].setRemoteDescription(new RTCSessionDescription(answer));
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
            document.body.appendChild(audioElement);
        }

        audioElement.srcObject = stream;
    }

    // Get voice chat status
    getStatus() {
        return {
            enabled: this.isEnabled,
            muted: this.isMuted,
            activePeers: Object.keys(this.peerConnections).length
        };
    }
}
