export class VoiceChat {
    constructor(socket) {
        this.socket = socket;
        this.localStream = null;
        this.peerConnections = {};
        this.isEnabled = false;
        this.isMuted = false;
        this.maxPeers = 4; // Limit max peer connections
        this.iceCandidateQueue = {}; // Batch ICE candidates
        this.lastStatusUpdate = 0;
        this.statusUpdateInterval = 500; // Only update status every 500ms
        
        // WebRTC configuration - optimized for performance
        this.peerConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ],
            iceGatheringPolicy: "gather", // Default
        };

        this.setupSocketListeners();
    }

    setupSocketListeners() {
        // Listen for offer from other peers
        this.socket.socket.on("voice_offer", (data) => {
            this.handleVoiceOffer(data);
        });

        // Listen for answer from other peers
        this.socket.socket.on("voice_answer", (data) => {
            this.handleVoiceAnswer(data);
        });

        // Listen for ICE candidates - batched processing
        this.socket.socket.on("voice_ice_candidate", (data) => {
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
        const playerIds = Object.keys(players).filter(id => id !== this.socket.ownSid);
        
        // Limit connections to max peers
        if (playerIds.length > this.maxPeers) {
            playerIds.length = this.maxPeers;
        }

        for (let peerId of playerIds) {
            if (this.peerConnections[peerId]) continue;
            
            const shouldInitiate = this.socket.ownSid > peerId;
            if (shouldInitiate) {
                this.createPeerConnection(peerId, true);
            }
        }
    }

    async startVoiceChat() {
        if (this.isEnabled) return;

        try {
            // Request microphone with minimal processing for performance
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,  // Disable for performance
                    noiseSuppression: false,  // Disable for performance
                    autoGainControl: false    // Disable for performance
                },
                video: false
            });

            this.isEnabled = true;

            // Notify server we're ready for voice chat
            this.socket.socket.emit("voice_chat_ready", {
                id: this.socket.ownSid
            });

            // Create connections with all connected players
            if (this.socket.networkPlayers && Object.keys(this.socket.networkPlayers).length > 0) {
                this.initiatePeerConnections(this.socket.networkPlayers);
            }

        } catch (error) {
            console.error("Voice chat error:", error);
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
            delete this.iceCandidateQueue[peerId];
        }
        this.peerConnections = {};
    }

    async createPeerConnection(peerId, initiator = false) {
        if (this.peerConnections[peerId]) {
            return this.peerConnections[peerId];
        }

        // Check peer connection limit
        if (Object.keys(this.peerConnections).length >= this.maxPeers) {
            return null;
        }

        const peerConnection = new RTCPeerConnection(this.peerConfig);
        this.peerConnections[peerId] = peerConnection;
        this.iceCandidateQueue[peerId] = [];

        // Add local stream tracks to peer connection
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream);
            });
        }

        // Handle ICE candidates - batch them to reduce network traffic
        let candidateTimer = null;
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                // Queue candidate for batching
                this.iceCandidateQueue[peerId].push(event.candidate);
                
                // Send batched candidates every 100ms
                if (!candidateTimer) {
                    candidateTimer = setTimeout(() => {
                        if (this.iceCandidateQueue[peerId].length > 0) {
                            this.socket.socket.emit("voice_ice_candidate", {
                                to: peerId,
                                from: this.socket.ownSid,
                                candidate: this.iceCandidateQueue[peerId][this.iceCandidateQueue[peerId].length - 1]
                            });
                            this.iceCandidateQueue[peerId] = [];
                        }
                        candidateTimer = null;
                    }, 100);
                }
            }
        };

        // Handle remote stream
        peerConnection.ontrack = (event) => {
            this.playRemoteStream(peerId, event.streams[0]);
        };

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
                peerConnection.close();
                delete this.peerConnections[peerId];
                delete this.iceCandidateQueue[peerId];
            }
        };

        // If initiator, create offer
        if (initiator) {
            try {
                const offer = await peerConnection.createOffer({
                    offerToReceiveAudio: true,
                    voiceActivityDetection: false
                });
                await peerConnection.setLocalDescription(offer);
                this.socket.socket.emit("voice_offer", {
                    to: peerId,
                    from: this.socket.ownSid,
                    offer: offer
                });
            } catch (error) {
                console.error("Voice error:", error);
            }
        }

        return peerConnection;
    }

    async handleVoiceOffer(data) {
        const { from, offer } = data;

        let peerConnection = await this.createPeerConnection(from, false);
        if (!peerConnection) return;

        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.createAnswer({
                voiceActivityDetection: false
            });
            await peerConnection.setLocalDescription(answer);

            this.socket.socket.emit("voice_answer", {
                to: from,
                from: this.socket.ownSid,
                answer: answer
            });
        } catch (error) {
            console.error("Voice error:", error);
        }
    }

    async handleVoiceAnswer(data) {
        const { from, answer } = data;

        if (this.peerConnections[from]) {
            try {
                await this.peerConnections[from].setRemoteDescription(new RTCSessionDescription(answer));
            } catch (error) {
                console.error("Voice error:", error);
            }
        }
    }

    async handleIceCandidate(data) {
        const { from, candidate } = data;

        if (this.peerConnections[from]) {
            try {
                await this.peerConnections[from].addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                // Ignore ICE errors - they're expected
            }
        }
    }

    playRemoteStream(peerId, stream) {
        let audioElement = document.getElementById(`audio-${peerId}`);
        
        if (!audioElement) {
            audioElement = document.createElement('audio');
            audioElement.id = `audio-${peerId}`;
            audioElement.autoplay = true;
            audioElement.playsinline = true;
            audioElement.style.display = 'none';
            document.body.appendChild(audioElement);
        }

        audioElement.srcObject = stream;
    }

    // Get voice chat status - throttled to prevent excessive updates
    getStatus() {
        const now = Date.now();
        
        // Only recalculate every interval
        if (now - this.lastStatusUpdate < this.statusUpdateInterval) {
            return this._cachedStatus || {
                enabled: this.isEnabled,
                muted: this.isMuted,
                activePeers: 0
            };
        }

        this.lastStatusUpdate = now;
        this._cachedStatus = {
            enabled: this.isEnabled,
            muted: this.isMuted,
            activePeers: Object.keys(this.peerConnections).length
        };
        
        return this._cachedStatus;
    }
}
