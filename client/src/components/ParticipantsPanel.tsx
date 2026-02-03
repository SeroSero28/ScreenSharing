import React from 'react';
import { FaMicrophone, FaMicrophoneSlash, FaDesktop, FaUser, FaHeadphones, FaVolumeMute } from 'react-icons/fa';
import type { Participant } from '../hooks/useParticipants';

interface ParticipantsPanelProps {
    participants: Participant[];
    currentUserId: string;
}

const ParticipantsPanel: React.FC<ParticipantsPanelProps> = ({ participants, currentUserId }) => {
    // 4) Katılımcı sayısı: participants.length ile türetilmeli
    const count = participants ? participants.length : 0;

    // DEBUG: Rendering check to console
    console.log(`[PANEL-RENDER] Count: ${count}`, participants);

    return (
        <div className="glass-card mt-3 p-3 overflow-auto" style={{ maxHeight: '300px' }}>
            {/* Header with Badge Count */}
            <h6 className="text-white border-bottom pb-2 mb-3 fw-bold d-flex justify-content-between align-items-center">
                <span>Katılımcılar</span>
                <span className="badge bg-primary rounded-pill">{count}</span>
            </h6>

            {/* Empty State */}
            {count === 0 && <div className="text-muted small text-center">Yükleniyor...</div>}

            {/* List */}
            <div className="d-flex flex-column gap-2">
                {participants.map((user) => {
                    const isSelf = user.id === currentUserId;
                    const isSpeaking = user.isSpeaking && !user.isMuted; // Boolean logic

                    return (
                        <div
                            key={user.id}
                            className="d-flex align-items-center p-2 rounded justify-content-between"
                            style={{
                                background: isSelf ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                                border: isSpeaking ? '1px solid #22c55e' : '1px solid transparent',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <div className="d-flex align-items-center gap-2">
                                <div className="rounded-circle d-flex align-items-center justify-content-center bg-dark text-white"
                                    style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
                                    <FaUser />
                                </div>
                                <div className="text-white d-flex flex-column" style={{ lineHeight: '1.2' }}>
                                    <span style={{ fontSize: '0.9rem', fontWeight: isSelf ? 'bold' : 'normal' }}>
                                        {user.username || 'Anonim'} {isSelf && '(Ben)'}
                                    </span>
                                    {user.isPresenter &&
                                        <span className="text-warning" style={{ fontSize: '0.7rem' }}>
                                            <FaDesktop className="me-1" /> Sunum yapıyor
                                        </span>
                                    }
                                </div>
                            </div>

                            <div className="text-muted d-flex gap-2">
                                {/* Speaker/Headphone Status */}
                                {user.isDeafened ? (
                                    <FaVolumeMute className="text-danger" title="Sesi Kapalı" />
                                ) : (
                                    <FaHeadphones className="text-secondary" title="Sesi Açık" />
                                )}

                                {/* Microphone Status */}
                                {user.isMuted ? (
                                    <FaMicrophoneSlash className="text-danger" title="Mikrofon Kapalı" />
                                ) : (
                                    <FaMicrophone className={isSpeaking ? "text-success pulse-animation" : "text-secondary"} title="Mikrofon Açık" />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            <style>{`
                .pulse-animation {
                    animation: pulse-green 1.5s infinite;
                }
                @keyframes pulse-green {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.2); opacity: 0.8; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default ParticipantsPanel;
