// src/App.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Container, Form, Button } from 'react-bootstrap';
import { socket } from './socket';
import ScreenViewer from './components/ScreenViewer';
import Chat from './components/Chat';
import VoiceManager from './components/VoiceManager';
import Settings from './components/Settings';
import { FaMicrophone, FaMicrophoneSlash, FaHeadphones, FaVolumeMute } from 'react-icons/fa';
import './App.css';
import { useParticipants } from './hooks/useParticipants';
import ParticipantsPanel from './components/ParticipantsPanel';

function App() {
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');
  const [roomJoined, setRoomJoined] = useState(false);
  const [inputRoomId, setInputRoomId] = useState('');
  const [inputUsername, setInputUsername] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [voiceMode, setVoiceMode] = useState<'continuous' | 'push-to-talk'>('continuous');
  const [pttKey, setPttKey] = useState('Backquote');
  const [selectedMicId, setSelectedMicId] = useState<string>('default');
  const [isSelfSpeaking, setIsSelfSpeaking] = useState(false);

  // Legacy State for ScreenViewer (Now derived from participants)
  const [users, setUsers] = useState<Map<string, { username: string }>>(new Map());

  const [isConnected, setIsConnected] = useState(socket.connected);
  const [messages, setMessages] = useState<any[]>([]);

  // Hook Integration (Single Source of Truth)
  const { participants, setMute, setSpeaking, setDeafened } = useParticipants(socket);

  // Sync participants to legacy 'users' map
  useEffect(() => {
    const newMap = new Map<string, { username: string }>();
    participants.forEach(p => {
      newMap.set(p.id, { username: p.username });
    });
    setUsers(newMap);
  }, [participants]);

  // Sync Local Voice State to Server
  useEffect(() => {
    setMute(isMuted);
  }, [isMuted, setMute]);

  useEffect(() => {
    setDeafened(isDeafened);
  }, [isDeafened, setDeafened]);

  useEffect(() => {
    setSpeaking(isSelfSpeaking);
  }, [isSelfSpeaking, setSpeaking]);

  // Effect 1: Connection Lifecycle
  useEffect(() => {
    const onConnect = () => {
      console.log('Connected to server with ID:', socket.id);
      setIsConnected(true);

      if (roomJoined && room && inputUsername) {
        console.log("CLIENT: Re-establishing room connection for", room);
        socket.emit('join-room', {
          roomId: room,
          username: inputUsername,
          password: inputPassword
        });
      }
    };

    const onDisconnect = () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    };

    const onConnectError = (err: Error) => {
      console.error("Connection error:", err);
      setIsConnected(false);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    if (socket.connected) setIsConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, [roomJoined, room, inputUsername, inputPassword]);

  // Effect 2: Room Logic & Chat Listeners
  useEffect(() => {
    console.log("CLIENT: Listeners setup for socket", socket.id);

    const onChatHistory = (history: any[]) => {
      console.log('CLIENT: Received chat history', history);
      setMessages(Array.isArray(history) ? history : []);
    };

    const onChatMessage = (msg: any) => {
      // DEĞİŞİKLİK: 5) Double message problemini önleme (Deduplication)
      setMessages(prev => {
        const isDuplicate = prev.some(m =>
          m.username === msg.username &&
          m.text === msg.text &&
          m.timestamp === msg.timestamp
        );
        if (isDuplicate) return prev;

        return [...prev, { ...msg, type: 'text', timestamp: msg.timestamp || new Date().toISOString() }];
      });
    };

    const onFileShare = (file: any) => {
      setMessages(prev => [...prev, file]);
    };

    const onJoinSuccess = (data: { roomId: string }) => {
      console.log('Successfully joined room:', data.roomId);
      // Removed: legacy usersMap logic (now handled by useParticipants hook)
      setUsername(inputUsername);
      setRoom(inputRoomId);
      setRoomJoined(true);
    };

    const onJoinError = (message: string) => {
      alert(`Odaya katılım başarısız: ${message}`);
      setRoomJoined(false);
    };

    // Removed: onUserConnected & onUserDisconnected 
    // (Handled automatically by hook via 'participants-sync')

    socket.on('chat-history', onChatHistory);
    socket.on('chat-message', onChatMessage);
    socket.on('file-share', onFileShare);
    socket.on('join-success', onJoinSuccess);
    socket.on('join-error', onJoinError);

    return () => {
      socket.off('chat-history', onChatHistory);
      socket.off('chat-message', onChatMessage);
      socket.off('file-share', onFileShare);
      socket.off('join-success', onJoinSuccess);
      socket.off('join-error', onJoinError);
    };
  }, [inputRoomId, inputUsername]);

  // Prevent accidental back/close
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (roomJoined) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [roomJoined]);

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();

    if (socket && inputRoomId && inputUsername) {
      const join = () => {
        console.log("CLIENT: Emitting join-room");
        setMessages([]);
        socket.emit('join-room', {
          roomId: inputRoomId,
          username: inputUsername,
          password: inputPassword,
        });
      };

      if (socket.connected) {
        join();
      } else {
        socket.connect();
        socket.once('connect', join);
      }
    }
  };

  const handleLeaveRoom = useCallback(() => {
    if (socket && roomJoined) {
      console.log("Leaving room...");
      socket.emit('leave-room');

      setRoomJoined(false);
      setRoom('');
      setUsers(new Map());
      setUsername('');
      setInputRoomId('');
      setMessages([]);
    }
  }, [roomJoined]);

  if (!roomJoined) {
    return (
      <div className="app-root">
        <div className="login-card p-5 rounded shadow-lg" style={{ background: '#1e1e1e', maxWidth: '400px', width: '100%' }}>
          <h2 className="text-center mb-1 fw-bold text-gradient">Screen Sharing</h2>
          <p className="text-center text-muted mb-4" style={{ fontSize: '0.9rem', opacity: 0.8, letterSpacing: '0.5px' }}>When you need!!!</p>
          <Form onSubmit={handleJoinRoom}>
            <Form.Group className="mb-3">
              <Form.Label>Kullanıcı Adı</Form.Label>
              <Form.Control
                type="text"
                placeholder="Adınız"
                value={inputUsername}
                onChange={(e) => setInputUsername(e.target.value)}
                required
                className="bg-dark text-white border-secondary"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Oda ID</Form.Label>
              <Form.Control
                type="text"
                placeholder="Oda ID"
                value={inputRoomId}
                onChange={(e) => setInputRoomId(e.target.value)}
                required
                className="bg-dark text-white border-secondary"
              />
            </Form.Group>
            <Form.Group className="mb-4">
              <Form.Label>Oda Şifresi (Opsiyonel)</Form.Label>
              <Form.Control
                type="password"
                placeholder="Varsa şifre"
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                className="bg-dark text-white border-secondary"
              />
            </Form.Group>
            <Button variant="primary" type="submit" className="w-100 gradient-btn fw-bold" disabled={!isConnected}>
              {isConnected ? 'Odaya Katıl' : 'Sunucuya Bağlanılıyor...'}
            </Button>
          </Form>
        </div>
      </div>
    );
  }

  return (
    <>
      <Settings
        show={showSettings}
        onHide={() => setShowSettings(false)}
        voiceMode={voiceMode}
        onVoiceModeChange={setVoiceMode}
        pttKey={pttKey}
        onPttKeyChange={setPttKey}
        selectedMicId={selectedMicId}
        onMicrophoneChange={setSelectedMicId}
      />
      <Container fluid className="p-0 m-0 d-flex flex-column overflow-hidden"
        style={{
          height: '100dvh', /* Dynamic viewport height */
          width: '100vw',
          backgroundColor: 'var(--bg-dark)',
          background: 'var(--bg-dark)' /* Fallback */
        }}>
        <div className="d-flex justify-content-between align-items-center px-4 py-3 border-bottom" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-dark)' }}>
          <div className="d-flex align-items-center"><span className="fw-bold text-gradient me-3" style={{ fontSize: '1.2rem' }}>Screen Sharing</span><span className="badge bg-secondary rounded-pill px-3 py-2">Oda: {room} ({users.size} kişi)</span></div>
          <div className="d-flex align-items-center gap-3">
            <div className="d-flex align-items-center">
              <div className={`icon-btn ${isMuted ? 'muted' : ''} ${isSelfSpeaking && !isMuted ? 'speaking' : ''}`} onClick={() => setIsMuted(prev => !prev)}>
                {isMuted ? <FaMicrophoneSlash size={20} /> : <FaMicrophone size={20} />}
              </div>
              <div className={`icon-btn ${isDeafened ? 'muted' : ''}`} onClick={() => setIsDeafened(prev => !prev)}>
                {isDeafened ? <FaVolumeMute size={20} /> : <FaHeadphones size={20} />}
              </div>
            </div>
            <Button variant="outline-info" size="sm" onClick={() => setShowSettings(true)}>Ayarlar</Button>
            <Button variant="outline-danger" size="sm" onClick={handleLeaveRoom}>Odadan Ayrıl</Button>
          </div>
        </div>

        {roomJoined && socket && <VoiceManager
          socket={socket}
          room={room}
          isMuted={isMuted}
          isDeafened={isDeafened}
          voiceMode={voiceMode}
          pttKey={pttKey}
          onIsSpeakingChange={setIsSelfSpeaking}
          users={users}
          selectedMicId={selectedMicId}
        />}

        <div className="d-flex flex-grow-1 overflow-hidden">
          <div className="flex-grow-1 p-4 d-flex align-items-center justify-content-center" style={{ background: '#000' }}>
            <div style={{ width: '100%', maxWidth: '1200px' }}>
              {socket && room && <ScreenViewer
                socket={socket}
                room={room}
                users={users}
              />}
            </div>
          </div>
          <div className="d-flex flex-column border-start" style={{ width: '350px', background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
            {/* Participants Panel */}
            {socket && <ParticipantsPanel participants={participants} currentUserId={socket.id || ''} />}

            {/* Chat Component */}
            {socket && room && username && <Chat key={room} socket={socket} room={room} username={username} messages={messages} users={users} onNewMessage={(msg) => setMessages(prev => [...prev, msg])} />}
          </div>
        </div>
      </Container>
    </>
  );
}

export default App;
