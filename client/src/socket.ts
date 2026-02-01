import { io, Socket } from "socket.io-client";

// KÖK SEBEP ÇÖZÜMÜ:
// Singleton Pattern + Lazy Initialization
// Socket objesi sadece ihtiyaç duyulduğunda ve sadece BİR KEZ oluşturulur.
// React StrictMode'un "double-invoke" davranışından etkilenmez.

class SocketService {
    private static instance: Socket | null = null;

    public static getSocket(): Socket {
        if (!this.instance) {
            console.log("🔌 Initializing Socket Singleton...");

            this.instance = io("http://127.0.0.1:3001", {
                transports: ["polling", "websocket"], // Polling önce gelir, bağlantı garantiye alınır, sonra upgrade olur.
                autoConnect: true,
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 1000,
                timeout: 20000,
            });

            this.setupDebugListeners(this.instance);
        }
        return this.instance;
    }

    private static setupDebugListeners(socket: Socket) {
        socket.on("connect", () => {
            console.log(`✅ CLIENT CONNECTED: ${socket.id}`);
        });

        socket.on("connect_error", (err) => {
            console.error("❌ CLIENT CONNECTION ERROR:", err.message);
        });

        socket.on("disconnect", (reason) => {
            console.warn(`⚠️ CLIENT DISCONNECTED: ${reason}`);
        });
    }
}

// Global erişim noktası - ancak direct export yerine getter kullanımı daha güvenlidir
// fakat mevcut kod yapısını (import { socket } from ...) korumak için:

export const socket = SocketService.getSocket();
