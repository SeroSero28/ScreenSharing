import { useState, useEffect, useRef, useCallback } from 'react';
import type { FC, FormEvent, DragEvent, ChangeEvent } from 'react';
import { Form, Button, FormControl } from 'react-bootstrap';
import { Socket } from 'socket.io-client';
import { useFileShare, type FileMessage } from '../hooks/useFileShare';
import { FaFileDownload, FaFileAlt, FaPaperclip } from 'react-icons/fa';
import { useTyping } from '../hooks/useTyping';

interface ChatProps {
  socket: Socket;
  room: string;
  username: string;
  messages: Message[];
  users: Map<string, { username: string }>; // New prop
  onNewMessage: (msg: Message) => void;
}

interface TextMessage {
  username: string;
  text: string;
  type: 'text';
  timestamp?: string;
  id?: string;
  fileData?: undefined;
  fileType?: undefined;
  fileName?: undefined;
}

type Message = TextMessage | FileMessage;

const Chat: FC<ChatProps> = ({ socket, room, username, messages, users, onNewMessage }) => {
  const [currentMessage, setCurrentMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Typing Hook
  const { typingUsers, handleTyping, stopTypingNow } = useTyping(socket);

  // File Share Hook Integration
  const onFileReceived = useCallback((fileMsg: FileMessage) => {
    onNewMessage(fileMsg);
  }, [onNewMessage]);

  const { uploadFile, isUploading } = useFileShare(socket, room, username, onFileReceived);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages, typingUsers]); // Scroll when typing changes too

  const sendMessage = (e: FormEvent) => {
    e.preventDefault();
    if (currentMessage.trim()) {
      const messageData = { room, username, text: currentMessage };
      socket.emit('chat-message', messageData);

      stopTypingNow(); // ZORUNLU KURAL: Mesaj gönderilince typing durmalı
      setCurrentMessage('');
    }
  };

  // Drag & Drop Handlers
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      uploadFile(file);
    }
  };

  // File rendering helper
  const renderContent = (msg: Message) => {
    if (msg.type === 'text') {
      return msg.text;
    }

    if (msg.type === 'file') {
      const isImage = msg.fileType.startsWith('image/');
      let url: string;

      if (typeof msg.fileData === 'string') {
        // Base64 string or URL
        url = msg.fileData;
      } else {
        // ArrayBuffer or Blob
        const blob = new Blob([msg.fileData], { type: msg.fileType });
        url = URL.createObjectURL(blob);
      }

      if (isImage) {
        return (
          <div className="mt-2">
            <img
              src={url}
              alt={msg.fileName}
              style={{ maxWidth: '100%', borderRadius: '8px', maxHeight: '200px', objectFit: 'cover' }}
              onLoad={() => scrollToBottom()} // Scroll when image loads
            />
          </div>
        );
      }

      return (
        <div className="d-flex align-items-center gap-2 mt-2 p-2 rounded" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <FaFileAlt size={20} />
          <div className="text-truncate" style={{ maxWidth: '150px' }}>{msg.fileName}</div>
          <a href={url} download={msg.fileName} className="ms-auto text-white">
            <FaFileDownload size={16} />
          </a>
        </div>
      );
    }
    return null;
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFile(e.target.files[0]);
    }
  };

  // Generate Typing Text
  const getTypingText = () => {
    if (typingUsers.size === 0) return null;

    // Convert Set<userId> to Array<username>
    const names: string[] = [];
    typingUsers.forEach((userId) => {
      const user = users.get(userId);
      if (user) names.push(user.username);
    });

    if (names.length === 0) return null;

    if (names.length === 1) return `${names[0]} yazıyor...`;
    if (names.length === 2) return `${names[0]} ve ${names[1]} yazıyor...`;
    return `${names.join(', ')} yazıyor...`;
  };

  const typingText = getTypingText();

  return (
    <div
      className="chat-container h-100 d-flex flex-column position-relative"
      style={{ background: 'transparent' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div
          className="position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center"
          style={{
            background: 'rgba(0,0,0,0.7)',
            zIndex: 100,
            border: '2px dashed var(--primary-color)',
            borderRadius: '8px',
            pointerEvents: 'none'
          }}
        >
          <h4 className="text-white">Dosyayı Bırak</h4>
        </div>
      )}

      <div className="px-3 py-3 border-bottom d-flex align-items-center" style={{ borderColor: 'var(--border-color)' }}>
        <h5 className="mb-0 fw-bold text-white">Sohbet</h5>
        <span className="ms-2 badge bg-dark text-muted border border-secondary">{messages.length}</span>
      </div>

      <div className="messages-area flex-grow-1 overflow-auto p-3" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.map((msg, index) => {
          const isSelf = msg.username === username;
          return (
            <div key={index} className={`d-flex flex-column ${isSelf ? 'align-items-end' : 'align-items-start'}`}>
              <span className="mb-1 small" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{msg.username}</span>
              <div
                className={`p-3 rounded-4 ${isSelf ? 'rounded-tr-0' : 'rounded-tl-0'}`}
                style={{
                  maxWidth: '85%',
                  background: isSelf ? 'linear-gradient(135deg, var(--primary-color), var(--accent-color))' : '#27272a',
                  color: 'white',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                  borderTopRightRadius: isSelf ? '0' : '1rem',
                  borderTopLeftRadius: isSelf ? '1rem' : '0'
                }}>
                {renderContent(msg)}
              </div>
            </div>
          );
        })}
        {/* Typing Indicator inside scroll area */}
        {typingText && (
          <div className="d-flex align-items-center gap-2 text-muted small ms-2 mt-2 fst-italic">
            <div className="typing-dot-animation">
              <span>.</span><span>.</span><span>.</span>
            </div>
            {typingText}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <style>
        {`
          .file-upload-btn {
            width: 40px;
            height: 40px;
            cursor: pointer;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(5px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            color: #fff;
          }
          .file-upload-btn:hover {
            background: rgba(255, 255, 255, 0.25);
            transform: scale(1.1) rotate(5deg);
            box-shadow: 0 0 15px rgba(255, 255, 255, 0.3);
            border-color: rgba(255, 255, 255, 0.5);
          }
          .file-upload-btn:active {
            transform: scale(0.95);
          }
          .typing-dot-animation span {
            animation: typingDots 1.4s infinite ease-in-out both; 
            margin-right: 1px;
            font-weight: bold;
          }
          .typing-dot-animation span:nth-child(1) { animation-delay: -0.32s; }
          .typing-dot-animation span:nth-child(2) { animation-delay: -0.16s; }
          @keyframes typingDots {
            0%, 80%, 100% { transform: scale(0); opacity: 0; }
            40% { transform: scale(1); opacity: 1; }
          }
        `}
      </style>
      <div className="p-3 border-top position-relative" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
        <Form onSubmit={sendMessage}>
          <div className="d-flex gap-2 align-items-center">
            <label className="file-upload-btn" title="Dosya Ekle">
              <FaPaperclip size={18} />
              <input type="file" className="d-none" onChange={handleFileInput} />
            </label>
            <FormControl
              placeholder={isUploading ? "Yükleniyor..." : "Mesaj yaz..."}
              disabled={isUploading}
              aria-label="Mesaj yaz..."
              value={currentMessage}
              onChange={(e) => {
                setCurrentMessage(e.target.value);
                handleTyping();
              }}
              className="bg-dark text-white border-secondary rounded-pill ps-3"
              style={{ boxShadow: 'none' }}
            />
            <Button disabled={isUploading} type="submit" className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px', background: 'var(--primary-color)', border: 'none' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576 6.636 10.07Zm6.787-8.201L1.591 6.602l4.339 2.76 7.494-7.493Z" />
              </svg>
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
};

export default Chat;
