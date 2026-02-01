import { useState, useEffect, useCallback, useRef } from 'react';
import type { Socket } from 'socket.io-client';

export const useTypingIndicator = (socket: Socket) => {
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isTypingRef = useRef(false);

    useEffect(() => {
        if (!socket) return;

        const onUserTyping = (data: { username: string }) => {
            setTypingUsers((prev) => {
                if (!prev.includes(data.username)) {
                    return [...prev, data.username];
                }
                return prev;
            });
        };

        const onUserStoppedTyping = (data: { username: string }) => {
            setTypingUsers((prev) => prev.filter((u) => u !== data.username));
        };

        socket.on('user-typing', onUserTyping);
        socket.on('user-stopped-typing', onUserStoppedTyping);

        return () => {
            socket.off('user-typing', onUserTyping);
            socket.off('user-stopped-typing', onUserStoppedTyping);
        };
    }, [socket]);

    const handleTyping = useCallback(() => {
        if (!socket) return;

        // Emit start only if not already marked as typing
        if (!isTypingRef.current) {
            isTypingRef.current = true;
            socket.emit('typing-start');
        }

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Set new timeout to stop
        typingTimeoutRef.current = setTimeout(() => {
            isTypingRef.current = false;
            socket.emit('typing-stop');
        }, 2000); // 2 seconds debounce
    }, [socket]);

    // Force stop (e.g. on send)
    const stopTypingNow = useCallback(() => {
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        if (isTypingRef.current && socket) {
            isTypingRef.current = false;
            socket.emit('typing-stop');
        }
    }, [socket]);

    return { typingUsers, handleTyping, stopTypingNow };
};
