
import React from 'react';
import { Socket } from 'socket.io-client';
import { useVoiceChat } from '../hooks/useVoiceChat';

interface VoiceManagerProps {
    socket: Socket;
    room: string;
    isMuted: boolean;
    isDeafened: boolean;
    voiceMode: 'continuous' | 'push-to-talk';
    pttKey: string;
    onIsSpeakingChange: (isSpeaking: boolean) => void;
    users: Map<string, { username: string }>;
    selectedMicId: string;
}

const VoiceManager: React.FC<VoiceManagerProps> = ({ socket, isMuted, isDeafened, voiceMode, pttKey, onIsSpeakingChange, users, selectedMicId }) => {
    const { remoteStreams } = useVoiceChat({
        socket,
        users,
        selectedMicId,
        voiceMode,
        pttKey,
        isMuted,
        onIsSpeakingChange
    });

    return (
        <div id="remote-audio-container">
            {Object.entries(remoteStreams).map(([socketId, stream]) => (
                <audio
                    key={socketId}
                    autoPlay
                    playsInline
                    muted={isDeafened}
                    ref={audioEl => {
                        if (audioEl) audioEl.srcObject = stream;
                    }}
                />
            ))}
        </div>
    );
};

export default VoiceManager;
