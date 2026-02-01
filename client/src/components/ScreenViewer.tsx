import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Button, Container } from 'react-bootstrap';
import { Socket } from 'socket.io-client';
import { useScreenShare } from '../hooks/useScreenShare';

interface ScreenViewerProps {
    socket: Socket;
    room: string;
    users: Map<string, { username: string }>;
}

const ScreenViewer: React.FC<ScreenViewerProps> = ({ socket, room, users }) => {
    const { localStream, remoteStreams, isSharing, startScreenShare, stopScreenShare } = useScreenShare({ socket, room, users });
    const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);

    const primaryVideoRef = useRef<HTMLVideoElement>(null);
    const thumbnailRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

    const allStreams = useMemo(() => {
        const streams = new Map<string, MediaStream>();
        if (localStream) streams.set('local', localStream);
        remoteStreams.forEach((stream, id) => streams.set(id, stream));
        return streams;
    }, [localStream, remoteStreams]);

    const primaryStream = useMemo(() => {
        if (selectedStreamId && allStreams.has(selectedStreamId)) {
            return { id: selectedStreamId, stream: allStreams.get(selectedStreamId)! };
        }
        if (allStreams.has('local')) {
            return { id: 'local', stream: allStreams.get('local')! };
        }
        if (allStreams.size > 0) {
            const entry = allStreams.entries().next().value;
            if (entry) return { id: entry[0], stream: entry[1] };
        }
        return null;
    }, [selectedStreamId, allStreams]);

    // Effects to connect streams to video elements
    useEffect(() => {
        if (primaryVideoRef.current && primaryStream) {
            primaryVideoRef.current.srcObject = primaryStream.stream;
        }
    }, [primaryStream]);

    // Effect to manage thumbnail video elements
    useEffect(() => {
        allStreams.forEach((stream, id) => {
            if (thumbnailRefs.current[id]) {
                thumbnailRefs.current[id]!.srcObject = stream;
            }
        });
    }, [allStreams, primaryStream]);

    const handleThumbnailClick = (id: string) => {
        setSelectedStreamId(id);
    };

    return (
        <Container fluid className="d-flex flex-column h-100 p-0">
            <div className="flex-grow-1" style={{ background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {primaryStream ? (
                    <video key={primaryStream.id} ref={primaryVideoRef} autoPlay playsInline controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                    <div className="text-center">
                        <p className="text-white mb-4 fs-5">Henüz kimse ekran paylaşmıyor.</p>
                        <div className="spinner-grow text-primary" role="status"></div>
                    </div>
                )}

                {allStreams.size > 1 && (
                    <div className="thumbnail-gallery-container bg-black bg-opacity-50 p-2">
                        <div className="d-flex gap-3">
                            {Array.from(allStreams.entries()).map(([id]) => {
                                if (primaryStream && id === primaryStream.id) return null; // Don't show primary in thumbnails
                                const isLocal = id === 'local';
                                return (
                                    <div key={id} className="thumbnail" onClick={() => handleThumbnailClick(id)}>
                                        <video
                                            ref={el => { thumbnailRefs.current[id] = el; }}
                                            autoPlay
                                            playsInline
                                            muted
                                        />
                                        <div className="thumbnail-label">{isLocal ? "Ekranınız" : users.get(id)?.username || 'Bilinmeyen Kullanıcı'}</div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            <div className="screen-share-bar" style={{ flexShrink: 0 }}>
                <div className="d-flex justify-content-center align-items-center gap-3">
                    {!isSharing ? (
                        <Button variant="primary" onClick={startScreenShare}>Ekranı Paylaş</Button>
                    ) : (
                        <Button variant="danger" onClick={stopScreenShare}>Paylaşımı Durdur</Button>
                    )}
                </div>
            </div>
        </Container>
    );
};

export default ScreenViewer;