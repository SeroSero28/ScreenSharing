import { useState, useRef, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';

const rtcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

interface UseScreenShareProps {
    socket: Socket;
    room: string;
    users: Map<string, { username: string }>;
}

export const useScreenShare = ({ socket, room, users }: UseScreenShareProps) => {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
    const [isSharing, setIsSharing] = useState(false);
    const isSharingRef = useRef(isSharing);
    const peersRef = useRef<{ [key: string]: RTCPeerConnection }>({});
    const candidateQueueRef = useRef<{ [key: string]: RTCIceCandidateInit[] }>({});

    useEffect(() => {
        isSharingRef.current = isSharing;
    }, [isSharing]);

    const cleanupPeer = useCallback((userId: string) => {
        const pc = peersRef.current[userId];
        if (pc) {
            pc.onicecandidate = null;
            pc.ontrack = null;
            pc.onnegotiationneeded = null;
            pc.close();
            delete peersRef.current[userId];
        }
        setRemoteStreams(prev => {
            const newMap = new Map(prev);
            if (newMap.has(userId)) {
                newMap.delete(userId);
                return newMap;
            }
            return prev;
        });
    }, []);

    const createPeerConnection = useCallback((userId: string) => {
        if (peersRef.current[userId]) return peersRef.current[userId];

        const pc = new RTCPeerConnection(rtcConfig);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', { to: userId, candidate: event.candidate, type: 'video' });
            }
        };

        pc.ontrack = (event) => {
            setRemoteStreams(prev => new Map(prev).set(userId, event.streams[0]));
        };

        pc.onnegotiationneeded = async () => {
            // Only negotiate if we are the ones initiating/sharing
            if (isSharingRef.current) {
                try {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    socket.emit('offer', { to: userId, offer: pc.localDescription, type: 'video' });
                } catch (err) {
                    console.error("Negotiation failed for user:", userId, err);
                }
            }
        };

        peersRef.current[userId] = pc;
        return pc;
    }, [socket]);

    const stopScreenShare = useCallback(() => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        setLocalStream(null);
        setIsSharing(false);
        if (socket) {
            socket.emit('stop-sharing', { room });
        }
    }, [localStream, socket, room]);

    const startScreenShare = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            stream.getVideoTracks()[0].onended = stopScreenShare;
            setIsSharing(true);
            setLocalStream(stream);
        } catch (err) {
            console.error("Error starting screen share:", err);
            setIsSharing(false);
        }
    }, [stopScreenShare]);

    // Effect to manage Peer Connection initiation when sharing
    useEffect(() => {
        if (!socket || !isSharing) {
            return;
        };

        // Ensure we have connections to all users when we are sharing
        users.forEach((_, userId) => {
            if (userId === socket.id) return;

            let pc = peersRef.current[userId];
            if (!pc) {
                pc = createPeerConnection(userId);
            }

            if (localStream) {
                localStream.getTracks().forEach(track => {
                    const senders = pc.getSenders();
                    if (!senders.find(s => s.track === track)) {
                        pc.addTrack(track, localStream);
                    }
                });
            }
        });

    }, [isSharing, users, socket, createPeerConnection, localStream]);

    // Main effect for handling signaling from other peers
    useEffect(() => {
        if (!socket) return;

        const handleOffer = async (data: { offer: RTCSessionDescriptionInit, from: string, type?: string }) => {
            if (data.type !== 'video') return;

            let pc = peersRef.current[data.from];
            if (!pc) {
                console.log(`[handleOffer] Creating missing peer connection for ${data.from}`);
                pc = createPeerConnection(data.from);
            }

            try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

                // Process queued candidates
                if (candidateQueueRef.current[data.from]) {
                    const queue = candidateQueueRef.current[data.from];
                    console.log(`[handleOffer] Processing ${queue.length} queued ICE candidates for ${data.from}`);
                    for (const candidate of queue) {
                        try {
                            await pc.addIceCandidate(new RTCIceCandidate(candidate));
                        } catch (e) {
                            console.error('Error adding queued ice candidate', e);
                        }
                    }
                    delete candidateQueueRef.current[data.from];
                }

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('answer', { to: data.from, answer, type: 'video' });
            } catch (err) {
                console.error("Failed to handle offer:", err);
            }
        };

        const handleAnswer = async (data: { answer: RTCSessionDescriptionInit, from: string, type?: string }) => {
            if (data.type !== 'video') return;
            const pc = peersRef.current[data.from];
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));

                // Process queued candidates
                if (candidateQueueRef.current[data.from]) {
                    const queue = candidateQueueRef.current[data.from];
                    for (const candidate of queue) {
                        try {
                            await pc.addIceCandidate(new RTCIceCandidate(candidate));
                        } catch (e) {
                            console.error('Error adding queued ice candidate', e);
                        }
                    }
                    delete candidateQueueRef.current[data.from];
                }
            }
        };

        const handleIceCandidate = async (data: { candidate: RTCIceCandidateInit, from: string, type?: string }) => {
            if (data.type !== 'video') return;
            const pc = peersRef.current[data.from];
            if (pc && pc.remoteDescription) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (e) {
                    console.error('Error adding received ice candidate', e);
                }
            } else {
                console.warn(`[handleIceCandidate] Peer connection not ready for ICE candidate from ${data.from}. Queueing.`);
                if (!candidateQueueRef.current[data.from]) {
                    candidateQueueRef.current[data.from] = [];
                }
                candidateQueueRef.current[data.from].push(data.candidate);
            }
        };

        const handleStopSharing = (data: { from: string }) => cleanupPeer(data.from);
        const handleUserDisconnected = (userId: string) => cleanupPeer(userId);

        socket.on('offer', handleOffer);
        socket.on('answer', handleAnswer);
        socket.on('ice-candidate', handleIceCandidate);
        socket.on('stop-sharing', handleStopSharing);
        socket.on('user-disconnected', handleUserDisconnected);

        return () => {
            socket.off('offer', handleOffer);
            socket.off('answer', handleAnswer);
            socket.off('ice-candidate', handleIceCandidate);
            socket.off('stop-sharing', handleStopSharing);
            socket.off('user-disconnected', handleUserDisconnected);
        };
    }, [socket, cleanupPeer, localStream, createPeerConnection]);

    return {
        localStream,
        remoteStreams,
        isSharing,
        startScreenShare,
        stopScreenShare
    };
};
