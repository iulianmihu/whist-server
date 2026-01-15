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
        console.log('Jucător deconectat');
        // Logică simplificată: momentan nu ștergem camera ca să nu stricăm jocul dacă cineva dă refresh
    });
});

const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => {
    res.send('Serverul Whist este activ!');
});
server.listen(PORT, () => {
    console.log(`Serverul rulează pe portul ${PORT}`);

});
