console.log("!!! SERVER CODE RELOADED - STRICT PARTICIPANTS ACTIVE !!!");
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  maxHttpBufferSize: 1e7,
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["websocket", "polling"],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Helper: Broadcast full participant list to a room
const broadcastParticipants = (roomId) => {
  // rooms objesi aşağıda tanımlı ama burada kullanıyoruz, js hoisting yok ama scope var.
  // rooms değişkeni global scope'da olacak.
  if (!rooms[roomId] || !rooms[roomId].participants) return;
  const list = Object.values(rooms[roomId].participants);
  io.to(roomId).emit('participants-sync', list); // ZORUNLU KURAL: participants-sync
};

const users = {}; // socket.id -> username
const rooms = {}; // roomId -> { participants, messages, ... }

io.on('connection', (socket) => {
  console.log(`✅ CONNECTED: ${socket.id} | Transport: ${socket.conn.transport.name}`);

  let userCurrentRoom = null; // Closure variable for this socket

  socket.conn.on("upgrade", (transport) => {
    console.log(`🚀 UPGRADED: ${socket.id} -> ${transport.name}`);
  });

  socket.on('join-room', (data) => {
    console.log(`SERVER: join-room triggered for ${socket.id}`, data);
    const { roomId, password, username } = data;

    // Room Initialization (KURAL 2)
    if (!rooms[roomId]) {
      rooms[roomId] = {
        password: password || null,
        presenterId: null,
        messages: [],
        participants: {}
      };
    }

    if (rooms[roomId].password && rooms[roomId].password !== password) {
      return socket.emit('join-error', 'Yanlış şifre!');
    }

    // Join Room
    socket.join(roomId);
    userCurrentRoom = roomId;
    users[socket.id] = username;

    // Participant State Initialization (KURAL 2)
    rooms[roomId].participants[socket.id] = {
      id: socket.id,
      username: username,
      isMuted: false,     // Varsayılan
      isSpeaking: false,  // Varsayılan
      isPresenter: false, // Varsayılan
      isDeafened: false   // Varsayılan (Yeni)
    };

    // 1. Chat History
    const history = (rooms[roomId] && Array.isArray(rooms[roomId].messages)) ? rooms[roomId].messages : [];
    socket.emit('chat-history', history);

    // 2. Join Success
    socket.emit('join-success', { roomId });

    // 3. Notify & Sync
    socket.to(roomId).emit('user-joined', { id: socket.id, username }); // ZORUNLU KURAL: user-joined
    broadcastParticipants(roomId); // ZORUNLU KURAL: participants-sync

    // Existing Presenter Check
    if (rooms[roomId].presenterId) {
      socket.emit('existing-presenter', { presenterId: rooms[roomId].presenterId });
    }
  });

  // --- ZORUNLU EVENT HANDLERS ---

  socket.on('mic-muted', () => {
    if (userCurrentRoom && rooms[userCurrentRoom]?.participants[socket.id]) {
      rooms[userCurrentRoom].participants[socket.id].isMuted = true;
      broadcastParticipants(userCurrentRoom);
      socket.to(userCurrentRoom).emit('mic-muted', { id: socket.id });
    }
  });

  socket.on('mic-unmuted', () => {
    if (userCurrentRoom && rooms[userCurrentRoom]?.participants[socket.id]) {
      rooms[userCurrentRoom].participants[socket.id].isMuted = false;
      broadcastParticipants(userCurrentRoom);
      socket.to(userCurrentRoom).emit('mic-unmuted', { id: socket.id });
    }
  });

  socket.on('speaker-muted', () => {
    if (userCurrentRoom && rooms[userCurrentRoom]?.participants[socket.id]) {
      rooms[userCurrentRoom].participants[socket.id].isDeafened = true;
      broadcastParticipants(userCurrentRoom);
      socket.to(userCurrentRoom).emit('speaker-muted', { id: socket.id });
    }
  });

  socket.on('speaker-unmuted', () => {
    if (userCurrentRoom && rooms[userCurrentRoom]?.participants[socket.id]) {
      rooms[userCurrentRoom].participants[socket.id].isDeafened = false;
      broadcastParticipants(userCurrentRoom);
      socket.to(userCurrentRoom).emit('speaker-unmuted', { id: socket.id });
    }
  });

  socket.on('speaking-start', () => {
    if (userCurrentRoom && rooms[userCurrentRoom]?.participants[socket.id]) {
      rooms[userCurrentRoom].participants[socket.id].isSpeaking = true;
      broadcastParticipants(userCurrentRoom);
      socket.to(userCurrentRoom).emit('speaking-start', { id: socket.id });
    }
  });

  socket.on('speaking-stop', () => {
    if (userCurrentRoom && rooms[userCurrentRoom]?.participants[socket.id]) {
      rooms[userCurrentRoom].participants[socket.id].isSpeaking = false;
      broadcastParticipants(userCurrentRoom);
      socket.to(userCurrentRoom).emit('speaking-stop', { id: socket.id });
    }
  });

  socket.on('presenter-start', () => {
    if (userCurrentRoom && rooms[userCurrentRoom]?.participants[socket.id]) {
      rooms[userCurrentRoom].presenterId = socket.id;
      rooms[userCurrentRoom].participants[socket.id].isPresenter = true;
      broadcastParticipants(userCurrentRoom);
      socket.to(userCurrentRoom).emit('presenter-start', { id: socket.id });
    }
  });

  socket.on('presenter-stop', () => {
    if (userCurrentRoom && rooms[userCurrentRoom]?.participants[socket.id]) {
      rooms[userCurrentRoom].presenterId = null;
      rooms[userCurrentRoom].participants[socket.id].isPresenter = false;
      broadcastParticipants(userCurrentRoom);
      socket.to(userCurrentRoom).emit('presenter-stop', { id: socket.id });
    }
  });

  // TYPING INDICATOR EVENTS (STRICT RELAY)
  socket.on('typing-start', () => {
    if (userCurrentRoom) {
      console.log(`SERVER: typing-start from ${socket.id}`);
      socket.to(userCurrentRoom).emit('user-typing', { userId: socket.id });
    }
  });

  socket.on('typing-stop', () => {
    if (userCurrentRoom) {
      console.log(`SERVER: typing-stop from ${socket.id}`);
      socket.to(userCurrentRoom).emit('user-stopped-typing', { userId: socket.id });
    }
  });

  // ------------------------------

  // WebRTC Signaling
  socket.on('offer', (data) => {
    // Side-effect: Update state if video offer (Presenter)
    if (data.type === 'video' && userCurrentRoom && rooms[userCurrentRoom]) {
      rooms[userCurrentRoom].presenterId = socket.id;
      if (rooms[userCurrentRoom].participants[socket.id]) {
        rooms[userCurrentRoom].participants[socket.id].isPresenter = true;
        broadcastParticipants(userCurrentRoom);
      }
      socket.to(userCurrentRoom).emit('presenter-start', { id: socket.id });
    }
    io.to(data.to).emit('offer', { offer: data.offer, from: socket.id, type: data.type });
  });

  socket.on('answer', (data) => {
    io.to(data.to).emit('answer', { answer: data.answer, from: socket.id, type: data.type });
  });

  socket.on('ice-candidate', (data) => {
    io.to(data.to).emit('ice-candidate', { candidate: data.candidate, from: socket.id, type: data.type });
  });

  socket.on('chat-message', (data) => {
    if (userCurrentRoom) {
      const msg = {
        username: data.username,
        text: data.text,
        type: 'text',
        timestamp: new Date().toISOString()
      };
      if (rooms[userCurrentRoom]) {
        if (!rooms[userCurrentRoom].messages) rooms[userCurrentRoom].messages = [];
        rooms[userCurrentRoom].messages.push(msg);
      }
      io.to(userCurrentRoom).emit('chat-message', msg);
    }
  });

  const handleDisconnect = () => {
    if (!userCurrentRoom || !rooms[userCurrentRoom]) return;

    const roomId = userCurrentRoom;

    // Cleanup Presenter State
    if (rooms[roomId].presenterId === socket.id) {
      rooms[roomId].presenterId = null;
      socket.to(roomId).emit('presenter-stop', { id: socket.id });
    }

    // Cleanup Participant State
    if (rooms[roomId].participants[socket.id]) {
      delete rooms[roomId].participants[socket.id];
    }

    // Notify & Sync
    socket.to(roomId).emit('user-left', { id: socket.id });
    socket.to(roomId).emit('user-stopped-typing', { userId: socket.id }); // Strict Rule: Clear typing on disconnect
    broadcastParticipants(roomId);

    // Leave socket room
    socket.leave(roomId);

    // Destroy room if empty
    // Check adapter for TRUE active sockets count
    const roomAdapter = io.sockets.adapter.rooms.get(roomId);
    if (!roomAdapter || roomAdapter.size === 0) {
      console.log(`Room ${roomId} deleted (empty).`);
      delete rooms[roomId];
    }

    userCurrentRoom = null;
  };

  socket.on('leave-room', () => {
    handleDisconnect();
    socket.emit('left-room');
  });

  socket.on('disconnect', (reason) => {
    console.log(`❌ DISCONNECTED: ${socket.id} | Reason: ${reason}`);
    handleDisconnect();
    delete users[socket.id];
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`✅ SERVER LISTENING ON PORT ${PORT}`);
});

module.exports = { app, server, io };
