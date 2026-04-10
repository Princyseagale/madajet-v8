const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const UserDB = require('./database.js');
const path = require('path'); // Ajouté pour la gestion des fichiers

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Correction pour les fichiers statiques
app.use(express.static(path.join(__dirname)));

let multiplier = 1.00;
let gameStatus = "waiting";
let timeLeft = 10;
let gameHistory = [];

function runEngine() {
    gameStatus = "waiting";
    multiplier = 1.00;
    timeLeft = 10;
    io.sockets.sockets.forEach(s => s.currentBet = null);
    let waitTimer = setInterval(() => {
        timeLeft--;
        io.emit('waiting', { time: timeLeft, history: gameHistory });
        if (timeLeft <= 0) { clearInterval(waitTimer); startFlight(); }
    }, 1000);
}

function startFlight() {
    gameStatus = "flying";
    let rand = Math.random();
    let crashPoint = (rand < 0.08) ? 1.00 : (rand < 0.50 ? (1.00 + Math.random() * 0.4).toFixed(2) : (1.40 + Math.random() * 2.0).toFixed(2));

    let flightTimer = setInterval(() => {
        multiplier += 0.01;
        io.emit('tick', { val: multiplier.toFixed(2) });
        if (multiplier >= crashPoint) {
            clearInterval(flightTimer);
            gameStatus = "crashed";
            gameHistory.unshift(crashPoint);
            if (gameHistory.length > 10) gameHistory.pop();
            io.emit('crash', { final: crashPoint, history: gameHistory });
            setTimeout(runEngine, 4000);
        }
    }, 100);
}

// --- MODIFICATION ADMIN ---
// On désactive readline car il n'y a pas de clavier sur Vercel
// Pour valider les dépôts, tu utiliseras les "Logs" de Vercel
if (process.env.NODE_ENV !== 'production') {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    function adminConsole() {
        rl.question('\n[ADMIN BAIDRO] Entrez (Numéro Montant): ', (input) => {
            const parts = input.split(' ');
            if (parts.length === 2) {
                const phone = parts[0], amount = parseInt(parts[1]);
                const res = UserDB.updateBalance(phone, amount, true);
                if (res !== null) {
                    console.log(`\n✅ VALIDÉ: +${amount} Ar pour ${phone}`);
                    const user = UserDB.getUser(phone);
                    io.emit('bal_res', user);
                } else { console.log("\n❌ ERREUR: Numéro introuvable."); }
            }
            adminConsole();
        });
    }
    adminConsole();
}

io.on('connection', (socket) => {
    socket.on('auth_attempt', (data) => {
        if (data.mode === 'register') {
            const res = UserDB.register(data.phone, data.pass);
            if (res.success) socket.emit('auth_success', res.user);
            else socket.emit('auth_error', res.error);
        } else {
            const user = UserDB.login(data.phone, data.pass);
            if (user) socket.emit('auth_success', user);
            else socket.emit('auth_error', "Identifiants incorrects");
        }
    });

    socket.on('get_balance', (data) => {
        const user = UserDB.getUser(data.phone);
        if (user) socket.emit('bal_res', user);
    });

    socket.on('request_deposit', (data) => {
        console.log(`🔔 DEPOT: ${data.phone} - ${data.amount} Ar - Ref: ${data.ref}`);
    });

    socket.on('request_retrait', (data) => {
        const user = UserDB.getUser(data.phone);
        if (user && user.balance_real >= data.amount) {
            UserDB.updateBalance(data.phone, -data.amount, true);
            console.log(`⚠️ RETRAIT: ${data.phone} - ${data.amount} Ar - Vers: ${data.destPhone}`);
            socket.emit('bal_res', UserDB.getUser(data.phone));
        } else {
            socket.emit('auth_error', "Solde insuffisant !");
        }
    });

    socket.on('place_bet', (data) => {
        if (gameStatus !== "waiting") return;
        const user = UserDB.getUser(data.phone);
        if (!user) return;
        const amount = parseInt(data.amount);
        const isReal = (data.mode === 'real');
        const currentBal = isReal ? user.balance_real : user.balance_demo;

        if (currentBal < amount) {
            return socket.emit('auth_error', "Solde insuffisant !");
        }

        const newBal = UserDB.updateBalance(data.phone, -amount, isReal);
        socket.currentBet = { phone: data.phone, amount: amount, mode: data.mode };
        socket.emit('bet_confirmed', { balance: newBal });
    });

    socket.on('cashout', (data) => {
        if (socket.currentBet && gameStatus === "flying") {
            const win = Math.floor(socket.currentBet.amount * multiplier);
            const finalBal = UserDB.updateBalance(data.phone, win, (socket.currentBet.mode === 'real'));
            socket.currentBet = null;
            socket.emit('cashout_ok', { win: win, balance: finalBal });
        }
    });
});

runEngine();

// Port dynamique pour Vercel
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`SERVER MADA JET RUNNING ON PORT ${PORT}`));

// LA LIGNE INDISPENSABLE POUR VERCEL
module.exports = app;
