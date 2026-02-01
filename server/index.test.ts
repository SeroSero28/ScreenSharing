import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest';
import { server, io } from './index.js';
import { io as Client } from 'socket.io-client';
import type { Socket as ClientSocket } from 'socket.io-client';
import type { AddressInfo } from 'net';

describe('Socket.IO Server', () => {
  let clientSocket: ClientSocket;
  let port: number;

  beforeAll(() => new Promise<void>((resolve) => {
    server.listen(() => {
      port = (server.address() as AddressInfo).port;
      resolve();
    });
  }));

  afterAll(() => {
    io.close();
    server.close();
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  it('should allow a user to connect', () => new Promise<void>((resolve, reject) => {
    clientSocket = Client(`http://localhost:${port}`);
    clientSocket.on('connect', () => {
      expect(clientSocket.connected).toBe(true);
      resolve();
    });
    clientSocket.on('connect_error', reject);
  }));

  it('should broadcast room counts on connection', () => new Promise<void>((resolve, reject) => {
    clientSocket = Client(`http://localhost:${port}`);
    clientSocket.on('update-room-list', (roomsData) => {
      expect(roomsData).toBeDefined();
      expect(typeof roomsData).toBe('object');
      resolve();
    });
    clientSocket.on('connect_error', reject);
  }));

  it('should allow a user to join a room', () => new Promise<void>((resolve, reject) => {
    clientSocket = Client(`http://localhost:${port}`);
    const roomData = { roomId: 'test-room', password: '123', username: 'tester' };
    
    clientSocket.on('connect', () => {
      clientSocket.emit('join-room', roomData);
    });

    clientSocket.on('join-success', (data) => {
      expect(data).toBeDefined();
      expect(data.allUsers).toBeInstanceOf(Array);
      expect(data.allUsers.length).toBe(1);
      expect(data.allUsers[0].username).toBe('tester');
      resolve();
    });

    clientSocket.on('join-error', reject);
  }));
});
