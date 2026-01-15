const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Permitem conectarea de oriunde (inclusiv sigura.ro)
        methods: ["GET", "POST"]
    }
});

let rooms = {}; // Aici ținem minte camerele de joc

io.on('connection', (socket) => {
    console.log('Jucător conectat:', socket.id);

    // 1. Creare sau Intrare în cameră
    socket.on('joinRoom', ({ roomCode, playerName }) => {
        socket.join(roomCode);
        
        if (!rooms[roomCode]) {
            rooms[roomCode] = { players: [], gameStarted: false, turn: 0 };
        }

        const room = rooms[roomCode];

        if (room.gameStarted) {
            socket.emit('errorMsg', 'Jocul a început deja în această cameră!');
            return;
        }

        // Adăugăm jucătorul
        const playerIndex = room.players.length;
        const newPlayer = {
            id: socket.id,
            name: playerName,
            index: playerIndex
        };
        room.players.push(newPlayer);

        // Anunțăm pe toată lumea din cameră
        io.to(roomCode).emit('updateLobby', room.players);
    });

    // 2. Start Joc (Doar primul jucator poate da start)
    socket.on('startGame', (roomCode) => {
        if (rooms[roomCode]) {
            rooms[roomCode].gameStarted = true;
            // Trimitem semnal la toți să înceapă
            io.to(roomCode).emit('gameStarted', { 
                players: rooms[roomCode].players,
                dealerIndex: Math.floor(Math.random() * rooms[roomCode].players.length)
            });
        }
    });

    // 3. Jucare Carte (Releu: primește de la unul, trimite la toți)
    socket.on('playCard', ({ roomCode, card, playerIndex }) => {
        // Trimitem cartea jucată către toți ceilalți din cameră
        io.to(roomCode).emit('cardPlayed', { 
            card: card, 
            playerIndex: playerIndex 
        });
    });
    
    // 4. Licitatie (Releu)
    socket.on('bidMade', ({ roomCode, bid, playerIndex }) => {
        io.to(roomCode).emit('bidUpdate', { 
            bid: bid, 
            playerIndex: playerIndex 
        });
    });

    socket.on('disconnect', () => {
        // Căutăm în ce cameră era jucătorul care a ieșit
        for (let roomCode in rooms) {
            let room = rooms[roomCode];
            // Eliminăm jucătorul din lista camerei
            room.players = room.players.filter(p => p.id !== socket.id);
            
            // Dacă nu mai e nimeni în cameră, o ștergem de tot după 30 de secunde
            // (lăsăm 30 de secunde în caz că omul a dat doar un refresh la pagină)
            if (room.players.length === 0) {
                setTimeout(() => {
                    if (rooms[roomCode] && rooms[roomCode].players.length === 0) {
                        delete rooms[roomCode];
                        console.log(`Camera ${roomCode} a fost ștearsă.`);
                    }
                }, 30000); 
            } else {
                // Dacă mai sunt jucători, îi anunțăm că cineva a ieșit
                io.to(roomCode).emit('updateLobby', room.players);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => {
    res.status(200).send('Serverul Whist este activ!');
});
server.listen(PORT, () => {
    console.log(`Serverul rulează pe portul ${PORT}`);

});


