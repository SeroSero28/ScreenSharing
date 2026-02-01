// src/components/Settings.tsx
import React, { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

interface SettingsProps {
    show: boolean;
    onHide: () => void;
    voiceMode: 'continuous' | 'push-to-talk';
    onVoiceModeChange: (mode: 'continuous' | 'push-to-talk') => void;
    pttKey: string;
    onPttKeyChange: (key: string) => void;
    selectedMicId: string;
    onMicrophoneChange: (deviceId: string) => void;
}

const Settings: React.FC<SettingsProps> = ({
    show,
    onHide,
    voiceMode,
    onVoiceModeChange,
    pttKey,
    onPttKeyChange,
    selectedMicId,
    onMicrophoneChange
}) => {
    const [isListening, setIsListening] = useState(false);
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);

    useEffect(() => {
        if (show) {
            navigator.mediaDevices.enumerateDevices()
                .then(devices => {
                    const mics = devices.filter(device => device.kind === 'audioinput');
                    setAudioDevices(mics);
                })
                .catch(err => console.error("Could not enumerate devices:", err));
        }
    }, [show]);

    useEffect(() => {
        if (!isListening) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            // We can add validation for disallowed keys here if needed
            onPttKeyChange(e.code);
            setIsListening(false);
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isListening, onPttKeyChange]);


    return (
        <Modal show={show} onHide={onHide} centered>
            <Modal.Header closeButton>
                <Modal.Title>Ayarlar</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form.Group className="mb-4">
                    <Form.Label><h5>Mikrofon</h5></Form.Label>
                    <Form.Select
                        value={selectedMicId}
                        onChange={(e) => onMicrophoneChange(e.target.value)}
                        aria-label="Microphone selection"
                    >
                        <option value="default">Varsayılan</option>
                        {audioDevices.map(device => (
                            <option key={device.deviceId} value={device.deviceId}>
                                {device.label || `Microphone ${audioDevices.indexOf(device) + 1}`}
                            </option>
                        ))}
                    </Form.Select>
                </Form.Group>

                <hr />

                <h5>Sesli Konuşma Modu</h5>
                <Form>
                    <Form.Check
                        type="radio"
                        label="Devamlı Konuş (Ses Aktivasyonu)"
                        id="continuous-mode"
                        name="voiceMode"
                        value="continuous"
                        checked={voiceMode === 'continuous'}
                        onChange={(e) => onVoiceModeChange(e.target.value as 'continuous' | 'push-to-talk')}
                    />
                    <Form.Check
                        type="radio"
                        label="Bas Konuş"
                        id="push-to-talk-mode"
                        name="voiceMode"
                        value="push-to-talk"
                        checked={voiceMode === 'push-to-talk'}
                        onChange={(e) => onVoiceModeChange(e.target.value as 'continuous' | 'push-to-talk')}
                    />
                </Form>
                {voiceMode === 'push-to-talk' && (
                    <div className="mt-4">
                        <h5>Bas Konuş Tuşu</h5>
                        <Button
                            variant="outline-primary"
                            onClick={() => setIsListening(true)}
                            disabled={isListening}
                        >
                            {isListening ? 'Bir tuşa basın...' : pttKey}
                        </Button>
                        <Form.Text className="d-block mt-2">
                            Tuşu değiştirmek için butona tıklayın ve yeni bir tuşa basın.
                        </Form.Text>
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide}>
                    Kapat
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default Settings;
