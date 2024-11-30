import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import generateNickname from './nickName.js';
import dotenv from 'dotenv'
dotenv.config()

const app = express();

const server = createServer(app);
const io = new Server(server, {
   cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

app.get("/", (req, res) => {
    res.send("Backend is running successfully!");
});
let peers = {};
let activeRooms = new Set();
let roomTimeouts = {};
let usedNicknames = new Set();
let peerNicknames = {};
const ROOM_TIMEOUT = 10 * 60 * 1000;

io.on('connection', (socket) => {
    console.log(`A User connected: ${socket.id}`);

    socket.on('createRoom', (roomId, peerId) => {
        if (!activeRooms.has(roomId)) {
            socket.join(roomId);
            console.log(`${peerId} Created Room : ${roomId}`);

            if (!peers[roomId]) peers[roomId] = {};

            if (!peerNicknames[peerId]) {
                const nickname = generateNickname(usedNicknames);
                peerNicknames[peerId] = nickname;
                usedNicknames.add(nickname);
            }

            peers[roomId][peerId] = { socketId: socket.id, nickname: peerNicknames[peerId] };
            activeRooms.add(roomId);

            resetRoomTimeout(roomId);

            socket.to(roomId).emit('newPeer', peerId);
            socket.emit('roomCreated', roomId);
            socket.emit('nicknameAssigned', peerNicknames[peerId]); 
            io.to(roomId).emit('allPeers', getAllPeers(roomId));
        } else {
            socket.emit('roomExists', roomId);
        }
    });

    socket.on('joinRoom', (roomId, peerId) => {
        if (activeRooms.has(roomId)) {
            socket.join(roomId);
            console.log(`${peerId} joined room ${roomId}`);

            if (!peers[roomId]) peers[roomId] = {};

            if (!peerNicknames[peerId]) {
                const nickname = generateNickname(usedNicknames);
                peerNicknames[peerId] = nickname;
                usedNicknames.add(nickname);
            }

            peers[roomId][peerId] = { socketId: socket.id, nickname: peerNicknames[peerId] };

            resetRoomTimeout(roomId);

            socket.to(roomId).emit('newPeer', { id: peerId, nickname: peerNicknames[peerId] });
            io.to(roomId).emit('allPeers', getAllPeers(roomId));
            socket.emit('roomJoined', roomId);
            socket.emit('nicknameAssigned', peerNicknames[peerId]); 
        } else {
            socket.emit('roomNotFound', roomId);
        }
    });

    socket.on('sendFile', (roomId, fileData, fileName, senderId) => {
        if (!activeRooms.has(roomId)) {
            socket.emit('roomCleared', roomId);
        }
        socket.to(roomId).emit('recieveFile', fileData, fileName, senderId);
        resetRoomTimeout(roomId);
    });

    socket.on('peerLeft', (peerId) => {
        for (const roomId in peers) {
            if (peers[roomId][peerId]) {
                console.log(`${peerId} left room: ${roomId}`);

                socket.to(roomId).emit('peerLeft', {
                    id: peerId,
                    nickname: peers[roomId][peerId]?.nickname || "Unknown",
                });
                delete peers[roomId][peerId];

                if (Object.keys(peers[roomId]).length === 0) {
                    console.log(`Room ${roomId} is empty and will be cleared.`);
                    activeRooms.delete(roomId);
                    delete peers[roomId];
                } else {
                    io.to(roomId).emit('allPeers', getAllPeers(roomId));
                }
                break;
            }
        }
    });

    socket.on('disconnect', () => {
        for (const roomId in peers) {
            for (const peerId in peers[roomId]) {
                if (peers[roomId][peerId].socketId === socket.id) {
                    console.log(`${peerId} disconnected from room ${roomId}`);
                    socket.to(roomId).emit('peerLeft', {
                        id: peerId,
                        nickname: peers[roomId][peerId]?.nickname || "Unknown",
                    });
                    delete peers[roomId][peerId];
                    if (Object.keys(peers[roomId]).length === 0) {
                        console.log(`Room ${roomId} has been cleared due to inactivity.`);
                        clearRoomTimeout(roomId);
                        activeRooms.delete(roomId);
                        delete peers[roomId];
                    } else {
                        io.to(roomId).emit('allPeers', getAllPeers(roomId));
                    }
                    if (!Object.values(peers).some(roomPeers => peerId in roomPeers)) {
                        usedNicknames.delete(peerNicknames[peerId]);
                        delete peerNicknames[peerId];
                    }
                    break;
                }
            }
        }
    });

    socket.on('requestNickname', (peerId) => {
        if (!peerNicknames[peerId]) {
            const nickname = generateNickname(usedNicknames);
            usedNicknames.add(nickname);
            peerNicknames[peerId] = nickname;
        }
        socket.emit('nicknameAssigned', peerNicknames[peerId]);
    });

    function resetRoomTimeout(roomId) {
        clearTimeout(roomTimeouts[roomId]);
        roomTimeouts[roomId] = setTimeout(() => {
            console.log(`Room ${roomId} has been automatically cleared due to inactivity.`);
            activeRooms.delete(roomId);
            delete peers[roomId];

            io.to(roomId).emit('roomCleared', roomId);
        }, ROOM_TIMEOUT);
    }

    function clearRoomTimeout(roomId) {
        clearTimeout(roomTimeouts[roomId]);
        delete roomTimeouts[roomId];
    }

    function getAllPeers(roomId) {
        return Object.entries(peers[roomId] || {}).map(([peerId, { nickname }]) => ({
            id: peerId,
            nickname,
        }));
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running at PORT:${PORT}`);
});
