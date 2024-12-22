import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    },
});

const rooms = new Map(); // Map of roomId -> { users: Set, code: string }

io.on("connection", (socket) => {
    let currentRoom = null;
    let currentUser = null;

    // Join a room
    socket.on("join", ({ roomId, userName }) => {
        // Leave the current room if already joined
        if (currentRoom) {
            socket.leave(currentRoom);
            const room = rooms.get(currentRoom);
            if (room) {
                room.users.delete(currentUser);
                if (room.users.size === 0) {
                    rooms.delete(currentRoom); // Cleanup empty room
                } else {
                    io.to(currentRoom).emit("userJoined", Array.from(room.users));
                }
            }
        }

        // Join the new room
        currentRoom = roomId;
        currentUser = userName;
        socket.join(roomId);

        // Add user to the room
        if (!rooms.has(roomId)) {
            rooms.set(roomId, { users: new Set(), code: "" });
        }
        rooms.get(roomId).users.add(userName);

        // Notify others in the room
        io.to(roomId).emit("userJoined", Array.from(rooms.get(roomId).users));

        // Send the current code in the room to the new user
        const currentCode = rooms.get(roomId).code || "";
        socket.emit("codeUpdate", currentCode);
    });

    socket.on("codeChange", ({ roomId, code }) => {
        if (rooms.has(roomId)) {
            rooms.get(roomId).code = code;
            socket.to(roomId).emit("codeUpdate", code); // Broadcast to others
        }
    });
    socket.on("leaveRoom", () => {
        if (currentRoom && currentUser) {
            const room = rooms.get(currentRoom);
            if (room) {
                room.users.delete(currentUser);
                io.to(currentRoom).emit("userJoined", Array.from(room.users));
                if (room.users.size === 0) {
                    rooms.delete(currentRoom);
                }
            }
            socket.leave(currentRoom);
            currentRoom = null;
            currentUser = null;
        }
    });

    socket.on("typing", ({ roomId, userName }) => {
        socket.to(roomId).emit("userTyping", userName);
    });
    socket.on("languageChange", ({ roomId, language }) => {
        io.to(roomId).emit("languageUpdate", language);
    });

    socket.on("disconnect", () => {
        if (currentRoom && currentUser) {
            const room = rooms.get(currentRoom);
            if (room) {
                room.users.delete(currentUser);
                if (room.users.size === 0) {
                    rooms.delete(currentRoom);
                } else {
                    io.to(currentRoom).emit("userJoined", Array.from(room.users));
                }
            }
        }
        console.log("user disconnected");
    });

});
const port = process.env.PORT || 5000;
server.listen(port, () => {
    console.log("Server is running on", port);
}); 