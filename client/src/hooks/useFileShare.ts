import { useState, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';

export interface FileMessage {
    id: string;
    username: string;
    fileName: string;
    fileType: string;
    fileData: ArrayBuffer | string; // Buffer for small files, base64 for images/others
    timestamp: string;
    type: 'file';
}

export const useFileShare = (
    socket: Socket | null,
    room: string,
    username: string,
    onFileReceived: (msg: FileMessage) => void
) => {
    const [isUploading, setIsUploading] = useState(false);

    // Listener removed. Handled centrally in App.tsx.


    const uploadFile = useCallback((file: File) => {
        console.log("[useFileShare] uploadFile called", { file: file.name, size: file.size, socketExists: !!socket, room });

        if (!socket || !room) {
            console.error("[useFileShare] Missing socket or room!");
            return;
        }

        // 10MB limit
        if (file.size > 10 * 1024 * 1024) {
            alert('Dosya boyutu 10MB\'tan küçük olmalıdır.');
            return;
        }

        setIsUploading(true);
        console.log("[useFileShare] Starting FileReader (Base64 mode)...");
        const reader = new FileReader();

        reader.onload = (e) => {
            console.log("[useFileShare] FileReader loaded");

            if (e.target?.result) {
                const fileData = {
                    fileName: file.name,
                    fileType: file.type,
                    fileData: e.target.result, // Now a Base64 string
                    room
                };

                // Emit to server
                console.log("[useFileShare] Emitting 'file-share' event...", { fileName: file.name });
                try {
                    socket.emit('file-share', fileData, (response: { status: string, message?: string }) => {
                        console.log("[useFileShare] Server acknowledged:", response);
                        if (response.status === 'ok') {
                            setIsUploading(false); // Success
                        } else {
                            alert("Dosya yükleme başarısız: " + response.message);
                            setIsUploading(false);
                        }
                    });
                } catch (err) {
                    console.error("[useFileShare] socket.emit CRASHED:", err);
                    setIsUploading(false);
                }

                // Optimistic UI update
                const optimisticMessage: FileMessage = {
                    id: Date.now().toString(),
                    username: username,
                    fileName: file.name,
                    fileType: file.type,
                    fileData: e.target.result as string,
                    timestamp: new Date().toISOString(),
                    type: 'file'
                };
                onFileReceived(optimisticMessage);
            }
        };

        reader.readAsDataURL(file);
    }, [socket, room, username, onFileReceived]);

    return {
        uploadFile,
        isUploading
    };
};
