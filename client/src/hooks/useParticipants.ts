import { useState, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';

export interface Participant {
    id: string;
    username: string;
    isMuted: boolean;
    isSpeaking: boolean;
    isPresenter: boolean;
}

export const useParticipants = (socket: Socket) => {
    const [participants, setParticipants] = useState<Participant[]>([]);

    useEffect(() => {
        if (!socket) return;

        // Listen for the snapshot update
        const handleSync = (list: Participant[]) => {
            console.log("👥 Participants Sync:", list);
            setParticipants(list);
        };

        socket.on('participants-sync', handleSync);

        return () => {
            socket.off('participants-sync', handleSync);
        };
    }, [socket]);

    // Explicit Mute Wrappers
    const setMute = useCallback((isMuted: boolean) => {
        if (!socket) return;
        socket.emit(isMuted ? 'mic-muted' : 'mic-unmuted');
    }, [socket]);

    // Explicit Speaking Wrappers
    const setSpeaking = useCallback((isSpeaking: boolean) => {
        if (!socket) return;
        socket.emit(isSpeaking ? 'speaking-start' : 'speaking-stop');
    }, [socket]);

    // Explicit Presenter Wrappers
    const setPresenter = useCallback((isPresenter: boolean) => {
        if (!socket) return;
        socket.emit(isPresenter ? 'presenter-start' : 'presenter-stop');
    }, [socket]);

    return {
        participants,
        setMute,
        setSpeaking,
        setPresenter
    };
};
