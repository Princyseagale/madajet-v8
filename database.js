const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'users.json');

function readDB() {
    if (!fs.existsSync(dbPath)) return {};
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function writeDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

const UserDB = {
    register: (phone, pass) => {
        const db = readDB();
        if (db[phone]) return { success: false, error: "Numéro déjà utilisé" };
        db[phone] = { phone, pass, balance_real: 0, balance_demo: 500000 };
        writeDB(db);
        return { success: true, user: db[phone] };
    },

    login: (phone, pass) => {
        const db = readDB();
        const user = db[phone];
        if (user && user.pass === pass) return user;
        return null;
    },

    getUser: (phone) => {
        const db = readDB();
        let user = db[phone];
        if (user) {
            // ANTI-NÉGATIF : Raha sanatria misy négatif ao anaty fichier dia averina 0
            if (user.balance_real < 0) user.balance_real = 0;
            if (user.balance_demo < 0) user.balance_demo = 0;
        }
        return user;
    },

    updateBalance: (phone, amount, isReal) => {
        const db = readDB();
        const user = db[phone];
        if (!user) return null;

        const key = isReal ? 'balance_real' : 'balance_demo';
        
        // Fanamarinana farany alohan'ny hanova ny fichier
        if (user[key] + amount < 0) {
            user[key] = 0; // Tsy avela ho latsaky ny 0
        } else {
            user[key] += amount;
        }

        writeDB(db);
        return user[key];
    }
};

module.exports = UserDB;
