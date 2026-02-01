import { useState, useRef, useEffect } from 'react';
import { Socket } from 'socket.io-client';

const rtcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

interface UseVoiceChatProps {
    socket: Socket;
    users: Map<string, { username: string }>;
    selectedMicId: string;
    voiceMode: 'continuous' | 'push-to-talk';
    pttKey: string;
    isMuted: boolean;
    onIsSpeakingChange: (isSpeaking: boolean) => void;
}

export const useVoiceChat = ({ socket, users, selectedMicId, voiceMode, pttKey, isMuted, onIsSpeakingChange }: UseVoiceChatProps) => {
    const [micStream, setMicStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<{ [key: string]: MediaStream }>({});
    const [isPttActive, setIsPttActive] = useState(false);

    const audioPeersRef = useRef<{ [key: string]: RTCPeerConnection }>({});
    const activeStreamRef = useRef<MediaStream | null>(null);
    const animationFrameRef = useRef<number | undefined>(undefined);
    const onIsSpeakingChangeRef = useRef(onIsSpeakingChange);
    const candidateQueueRef = useRef<{ [key: string]: RTCIceCandidateInit[] }>({});

    useEffect(() => {
        onIsSpeakingChangeRef.current = onIsSpeakingChange;
    }, [onIsSpeakingChange]);

    // Effect for starting and stopping microphone
    useEffect(() => {
        const startMic = async () => {
            try {
                const audioConstraint = selectedMicId === 'default'
                    ? { echoCancellation: true, noiseSuppression: true }
                    : { deviceId: { exact: selectedMicId }, echoCancellation: true, noiseSuppression: true };

                const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraint });
                activeStreamRef.current = stream;
                setMicStream(stream);
            } catch (error) {
                console.error("Could not get microphone access", error);
                alert("Mikrofon erişimi alınamadı. Lütfen izinleri kontrol edin.");
            }
        };
        startMic();
        return () => {
            activeStreamRef.current?.getTracks().forEach(track => track.stop());
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            Object.values(audioPeersRef.current).forEach(pc => pc.close());
            audioPeersRef.current = {};
        }
    }, [selectedMicId]); // removed audioPeersRef from dependency to avoid cycles

    // Effect for Voice Activity Detection
    useEffect(() => {
        if (!micStream) return;
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(micStream);
        source.connect(analyser);
        analyser.fftSize = 512;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        let isSpeaking = false;
        const speakingThreshold = 10;
        const silenceThreshold = 5;
        let silenceCount = 0;

        const loop = () => {
            analyser.getByteFrequencyData(dataArray);
            const avg = dataArray.reduce((acc, v) => acc + v, 0) / bufferLength;
            if (avg > speakingThreshold) {
                silenceCount = 0;
                if (!isSpeaking) {
                    isSpeaking = true;
                    onIsSpeakingChangeRef.current(true);
                }
            } else {
                silenceCount++;
                if (isSpeaking && silenceCount > silenceThreshold) {
                    isSpeaking = false;
                    onIsSpeakingChangeRef.current(false);
                }
            }
            animationFrameRef.current = requestAnimationFrame(loop);
        };
        loop();

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            source.disconnect();
            analyser.disconnect();
            audioContext.close();
        };
    }, [micStream]);

    // Effect for handling mute, PTT, and voice mode
    useEffect(() => {
        if (micStream?.getAudioTracks()[0]) {
            micStream.getAudioTracks()[0].enabled = !isMuted && (voiceMode === 'continuous' || isPttActive);
        }
    }, [isMuted, micStream, voiceMode, isPttActive]);

    // Effect for PTT key listeners
    useEffect(() => {
        if (voiceMode !== 'push-to-talk') return;
        const handleKeyDown = (e: KeyboardEvent) => { if (e.code === pttKey && !e.repeat) setIsPttActive(true); };
        const handleKeyUp = (e: KeyboardEvent) => { if (e.code === pttKey) setIsPttActive(false); };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            setIsPttActive(false);
        };
    }, [voiceMode, pttKey]);

    // Main WebRTC connection management effect
    useEffect(() => {
        if (!micStream || !socket || users.size === 0) return;

        // Connect to new users
        users.forEach(async (_, userId) => {
            if (userId === socket.id || audioPeersRef.current[userId]) return;

            console.log(`VoiceManager: Found new user ${userId}, creating audio offer.`);
            const pc = new RTCPeerConnection(rtcConfig);
            micStream.getTracks().forEach(track => pc.addTrack(track, micStream));
            pc.onicecandidate = e => { if (e.candidate) socket.emit('ice-candidate', { to: userId, candidate: e.candidate, type: 'audio' }) };
            pc.ontrack = e => setRemoteStreams(prev => ({ ...prev, [userId]: e.streams[0] }));
            audioPeersRef.current[userId] = pc;

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('offer', { to: userId, offer, type: 'audio' });
        });

        // Clean up disconnected users
        Object.keys(audioPeersRef.current).forEach(peerId => {
            if (!users.has(peerId)) {
                console.log(`VoiceManager: Cleaning up disconnected user ${peerId}`);
                audioPeersRef.current[peerId].close();
                delete audioPeersRef.current[peerId];
                setRemoteStreams(prev => {
                    const newStreams = { ...prev };
                    delete newStreams[peerId];
                    return newStreams;
                });
            }
        });

    }, [users, micStream, socket]);

    // Signaling listener effect
    useEffect(() => {
        if (!socket || !micStream) return;

        const handleOffer = async (data: { offer: RTCSessionDescriptionInit, from: string, type?: string }) => {
            if (data.type !== 'audio') return;

            console.log(`VoiceManager: received audio offer from ${data.from}`);
            const pc = new RTCPeerConnection(rtcConfig);
            micStream.getTracks().forEach(track => pc.addTrack(track, micStream));
            pc.onicecandidate = e => { if (e.candidate) socket.emit('ice-candidate', { to: data.from, candidate: e.candidate, type: 'audio' }) };
            pc.ontrack = e => setRemoteStreams(prev => ({ ...prev, [data.from]: e.streams[0] }));
            audioPeersRef.current[data.from] = pc;

            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

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

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('answer', { to: data.from, answer, type: 'audio' });
        };
        const handleAnswer = async (data: { answer: RTCSessionDescriptionInit, from: string, type?: string }) => {
            if (data.type !== 'audio') return;
            const pc = audioPeersRef.current[data.from];
            if (pc) {
                if (pc.signalingState === 'stable') {
                    console.warn("Received answer but connection is already stable. Ignoring.");
                    return;
                }
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
            if (data.type !== 'audio') return;
            const pc = audioPeersRef.current[data.from];
            if (pc && pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } else {
                // Queue it
                if (!candidateQueueRef.current[data.from]) {
                    candidateQueueRef.current[data.from] = [];
                }
                candidateQueueRef.current[data.from].push(data.candidate);
            }
        };

        socket.on('offer', handleOffer);
        socket.on('answer', handleAnswer);
        socket.on('ice-candidate', handleIceCandidate);

        return () => {
            socket.off('offer', handleOffer);
            socket.off('answer', handleAnswer);
            socket.off('ice-candidate', handleIceCandidate);
        }
    }, [socket, micStream]);

    return { remoteStreams };
};
