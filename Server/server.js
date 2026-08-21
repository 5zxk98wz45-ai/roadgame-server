const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
    if (req.url === "/") {
        res.writeHead(200, {
            "Content-Type": "text/plain; charset=utf-8"
        });

        res.end("RoadGame Multiplayer Server 🟢");
        return;
    }

    res.writeHead(404);
    res.end("Not found");
});

const wss = new WebSocket.Server({ server });


// =====================================================
// DONNÉES
// =====================================================

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, "{}", "utf8");
}

let users = {};

try {
    users = JSON.parse(
        fs.readFileSync(USERS_FILE, "utf8")
    );
} catch {
    users = {};
}

function saveUsers() {
    fs.writeFileSync(
        USERS_FILE,
        JSON.stringify(users, null, 2),
        "utf8"
    );
}


// =====================================================
// CONFIGURATION
// =====================================================

const MAX_PLAYERS = 20;

const VEHICLES = [
    "walk",
    "car",
    "truck",
    "bus",
    "plane",
    "boat"
];

const rooms = new Map();


// =====================================================
// UTILITAIRES
// =====================================================

function createId() {
    return crypto.randomUUID();
}

function hashPassword(password) {
    return crypto
        .createHash("sha256")
        .update(String(password))
        .digest("hex");
}

function cleanName(name) {
    if (typeof name !== "string") {
        return "Joueur";
    }

    name = name.trim();

    if (!name) {
        return "Joueur";
    }

    return name.substring(0, 20);
}

function validNumber(value) {
    return (
        typeof value === "number" &&
        Number.isFinite(value)
    );
}

function send(ws, data) {
    if (
        ws &&
        ws.readyState === WebSocket.OPEN
    ) {
        ws.send(JSON.stringify(data));
    }
}

function broadcast(room, data, except = null) {
    for (const player of room.players.values()) {
        if (player.ws !== except) {
            send(player.ws, data);
        }
    }
}

function publicUser(user) {
    return {
        id: user.id,
        username: user.username,
        friends: user.friends || [],
        friendRequests: user.friendRequests || [],
        vehicles: user.vehicles || ["car"],
        selectedVehicle: user.selectedVehicle || "car",
        settings: user.settings || {
            sound: true,
            music: true
        }
    };
}

function publicPlayer(player) {
    return {
        id: player.id,
        name: player.name,
        vehicle: player.vehicle,
        latitude: player.latitude,
        longitude: player.longitude,
        rotation: player.rotation,
        inVehicle: player.inVehicle
    };
}

function getPlayers(room) {
    return [...room.players.values()]
        .map(publicPlayer);
}

function createRoomCode() {
    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code;

    do {
        code = "";

        for (let i = 0; i < 6; i++) {
            code += chars[
                Math.floor(
                    Math.random() * chars.length
                )
            ];
        }
    } while (rooms.has(code));

    return code;
}


// =====================================================
// UTILISATEUR
// =====================================================

function createUser(username, password) {
    const id = createId();

    users[username.toLowerCase()] = {
        id,
        username,
        password: hashPassword(password),

        friends: [],

        friendRequests: [],

        vehicles: [
            "car"
        ],

        selectedVehicle: "car",

        settings: {
            sound: true,
            music: true
        }
    };

    saveUsers();

    return users[username.toLowerCase()];
}

function findUser(username) {
    if (typeof username !== "string") {
        return null;
    }

    return users[
        username.trim().toLowerCase()
    ] || null;
}


// =====================================================
// CONNECTION
// =====================================================

wss.on("connection", (ws) => {

    console.log("👤 Nouveau joueur connecté");

    ws.user = null;
    ws.player = null;
    ws.room = null;
    ws.isAlive = true;

    send(ws, {
        type: "connected"
    });

    ws.on("pong", () => {
        ws.isAlive = true;
    });

    ws.on("message", (raw) => {

        let data;

        try {
            data = JSON.parse(
                raw.toString()
            );
        } catch {
            send(ws, {
                type: "error",
                message: "Message JSON invalide."
            });

            return;
        }

        handleMessage(ws, data);
    });

    ws.on("close", () => {
        removePlayer(ws);
    });

    ws.on("error", () => {
        removePlayer(ws);
    });
});


// =====================================================
// MESSAGES
// =====================================================

function handleMessage(ws, data) {

    switch (data.type) {

        case "register":
            register(ws, data);
            break;

        case "login":
            login(ws, data);
            break;

        case "change_username":
            changeUsername(ws, data);
            break;

        case "friend_request":
            friendRequest(ws, data);
            break;

        case "friend_accept":
            friendAccept(ws, data);
            break;

        case "settings_update":
            updateSettings(ws, data);
            break;

        case "quick_match":
            quickMatch(ws, data);
            break;

        case "create_room":
            createPublicRoom(ws, data);
            break;

        case "create_private_room":
            createPrivateRoom(ws, data);
            break;

        case "join_room":
            joinRoom(ws, data);
            break;

        case "player_update":
            updatePlayer(ws, data);
            break;

        case "vehicle_update":
            updateVehicle(ws, data);
            break;

        case "enter_vehicle":
            enterVehicle(ws, data);
            break;

        case "exit_vehicle":
            exitVehicle(ws);
            break;

        case "buy_vehicle":
            buyVehicle(ws, data);
            break;

        case "ping":
            send(ws, {
                type: "pong"
            });
            break;

        default:
            send(ws, {
                type: "error",
                message:
                    "Type de message inconnu."
            });
    }
}


// =====================================================
// REGISTER
// =====================================================

function register(ws, data) {

    const username =
        cleanName(data.username);

    const password =
        String(data.password || "");

    if (username.length < 3) {
        send(ws, {
            type: "error",
            message:
                "Le pseudo doit contenir au moins 3 caractères."
        });

        return;
    }

    if (password.length < 4) {
        send(ws, {
            type: "error",
            message:
                "Le mot de passe doit contenir au moins 4 caractères."
        });

        return;
    }

    if (findUser(username)) {
        send(ws, {
            type: "error",
            message:
                "Ce pseudo est déjà utilisé."
        });

        return;
    }

    const user =
        createUser(
            username,
            password
        );

    ws.user = user;

    send(ws, {
        type: "account_created",
        user: publicUser(user)
    });

    console.log(
        `🆕 Compte créé : ${username}`
    );
}


// =====================================================
// LOGIN
// =====================================================

function login(ws, data) {

    const username =
        String(data.username || "")
            .trim();

    const password =
        String(data.password || "");

    const user =
        findUser(username);

    if (!user) {
        send(ws, {
            type: "error",
            message:
                "Pseudo ou mot de passe incorrect."
        });

        return;
    }

    if (
        user.password !==
        hashPassword(password)
    ) {
        send(ws, {
            type: "error",
            message:
                "Pseudo ou mot de passe incorrect."
        });

        return;
    }

    ws.user = user;

    send(ws, {
        type: "login_success",
        user: publicUser(user)
    });

    console.log(
        `🔑 Connexion : ${user.username}`
    );
}


// =====================================================
// CHANGER PSEUDO
// =====================================================

function changeUsername(ws, data) {

    if (!ws.user) {
        send(ws, {
            type: "error",
            message:
                "Connecte-toi d'abord."
        });

        return;
    }

    const newUsername =
        cleanName(data.username);

    if (newUsername.length < 3) {
        send(ws, {
            type: "error",
            message:
                "Pseudo trop court."
        });

        return;
    }

    const oldKey =
        ws.user.username.toLowerCase();

    const newKey =
        newUsername.toLowerCase();

    if (
        oldKey !== newKey &&
        users[newKey]
    ) {
        send(ws, {
            type: "error",
            message:
                "Ce pseudo est déjà utilisé."
        });

        return;
    }

    const userData = {
        ...ws.user,
        username: newUsername
    };

    delete users[oldKey];

    users[newKey] = userData;

    ws.user = users[newKey];

    saveUsers();

    send(ws, {
        type: "username_changed",
        username: newUsername
    });
}


// =====================================================
// AMIS
// =====================================================

function friendRequest(ws, data) {

    if (!ws.user) {
        send(ws, {
            type: "error",
            message:
                "Connecte-toi d'abord."
        });

        return;
    }

    const targetName =
        String(data.username || "")
            .trim();

    const target =
        findUser(targetName);

    if (!target) {
        send(ws, {
            type: "error",
            message:
                "Utilisateur introuvable."
        });

        return;
    }

    if (
        target.id ===
        ws.user.id
    ) {
        send(ws, {
            type: "error",
            message:
                "Tu ne peux pas t'ajouter toi-même."
        });

        return;
    }

    if (
        ws.user.friends.includes(
            target.id
        )
    ) {
        send(ws, {
            type: "error",
            message:
                "Vous êtes déjà amis."
        });

        return;
    }

    if (
        !target.friendRequests.includes(
            ws.user.id
        )
    ) {
        target.friendRequests.push(
            ws.user.id
        );
    }

    saveUsers();

    send(ws, {
        type: "friend_request_sent",
        username: target.username
    });
}

function friendAccept(ws, data) {

    if (!ws.user) {
        return;
    }

    const userId =
        String(data.userId || "");

    const requester =
        Object.values(users)
            .find(
                user =>
                    user.id === userId
            );

    if (!requester) {
        return;
    }

    ws.user.friendRequests =
        ws.user.friendRequests
            .filter(
                id =>
                    id !== userId
            );

    if (
        !ws.user.friends.includes(
            requester.id
        )
    ) {
        ws.user.friends.push(
            requester.id
        );
    }

    if (
        !requester.friends.includes(
            ws.user.id
        )
    ) {
        requester.friends.push(
            ws.user.id
        );
    }

    saveUsers();

    send(ws, {
        type: "friend_added",
        user: publicUser(ws.user)
    });
}


// =====================================================
// PARAMÈTRES
// =====================================================

function updateSettings(ws, data) {

    if (!ws.user) {
        return;
    }

    ws.user.settings = {
        sound:
            data.sound !== false,

        music:
            data.music !== false
    };

    saveUsers();

    send(ws, {
        type: "settings_updated",
        settings:
            ws.user.settings
    });
}


// =====================================================
// CRÉER JOUEUR
// =====================================================

function createPlayer(ws, data) {

    let vehicle =
        data.vehicle;

    if (
        !VEHICLES.includes(vehicle)
    ) {
        vehicle = "car";
    }

    const player = {
        id: createId(),

        name:
            ws.user
                ? ws.user.username
                : cleanName(data.name),

        vehicle,

        inVehicle:
            vehicle !== "walk",

        latitude:
            validNumber(data.latitude)
                ? data.latitude
                : 48.8566,

        longitude:
            validNumber(data.longitude)
                ? data.longitude
                : 2.3522,

        rotation: 0,

        ws
    };

    return player;
}


// =====================================================
// CRÉER PARTIE PUBLIQUE
// =====================================================

function createPublicRoom(ws, data) {

    if (ws.room) {
        send(ws, {
            type: "error",
            message:
                "Tu es déjà dans une partie."
        });

        return;
    }

    const code =
        createRoomCode();

    const player =
        createPlayer(ws, data);

    const room = {
        code,
        private: false,
        password: null,
        players: new Map()
    };

    room.players.set(
        player.id,
        player
    );

    rooms.set(
        code,
        room
    );

    ws.player = player;
    ws.room = room;

    send(ws, {
        type: "room_created",
        room: code,
        playerId: player.id,
        players: getPlayers(room)
    });

    console.log(
        `🌐 Partie publique ${code}`
    );
}


// =====================================================
// SERVEUR PRIVÉ
// =====================================================

function createPrivateRoom(ws, data) {

    if (ws.room) {
        send(ws, {
            type: "error",
            message:
                "Tu es déjà dans une partie."
        });

        return;
    }

    const password =
        String(data.password || "");

    if (!password) {
        send(ws, {
            type: "error",
            message:
                "Mot de passe obligatoire."
        });

        return;
    }

    const code =
        createRoomCode();

    const player =
        createPlayer(ws, data);

    const room = {
        code,
        private: true,
        password,
        players: new Map()
    };

    room.players.set(
        player.id,
        player
    );

    rooms.set(
        code,
        room
    );

    ws.player = player;
    ws.room = room;

    send(ws, {
        type: "room_created",
        room: code,
        playerId: player.id,
        password,
        players: getPlayers(room)
    });

    send(ws, {
        type: "private_room_created",
        room: code,
        password
    });

    console.log(
        `🔒 Serveur privé ${code}`
    );
}


// =====================================================
// REJOINDRE
// =====================================================

function joinRoom(ws, data) {

    if (ws.room) {
        send(ws, {
            type: "error",
            message:
                "Tu es déjà dans une partie."
        });

        return;
    }

    const code =
        String(data.room || "")
            .trim()
            .toUpperCase();

    const room =
        rooms.get(code);

    if (!room) {
        send(ws, {
            type: "error",
            message:
                "Cette partie n'existe pas."
        });

        return;
    }

    if (
        room.players.size >=
        MAX_PLAYERS
    ) {
        send(ws, {
            type: "error",
            message:
                "Cette partie est pleine."
        });

        return;
    }

    if (
        room.private &&
        String(data.password || "") !==
        room.password
    ) {
        send(ws, {
            type: "error",
            message:
                "Mot de passe incorrect."
        });

        return;
    }

    const player =
        createPlayer(ws, data);

    room.players.set(
        player.id,
        player
    );

    ws.player = player;
    ws.room = room;

    send(ws, {
        type: "room_joined",
        room: room.code,
        playerId: player.id,
        players: getPlayers(room)
    });

    broadcast(
        room,
        {
            type: "player_joined",
            player:
                publicPlayer(player)
        },
        ws
    );

    console.log(
        `👤 ${player.name} rejoint ${room.code}`
    );
}


// =====================================================
// PARTIE RAPIDE
// =====================================================

function quickMatch(ws, data) {

    if (ws.room) {
        send(ws, {
            type: "error",
            message:
                "Tu es déjà dans une partie."
        });

        return;
    }

    for (const room of rooms.values()) {

        if (
            room.private ||
            room.players.size >=
            MAX_PLAYERS
        ) {
            continue;
        }

        const player =
            createPlayer(ws, data);

        room.players.set(
            player.id,
            player
        );

        ws.player = player;
        ws.room = room;

        send(ws, {
            type: "quick_match_found",
            room: room.code,
            playerId: player.id,
            players: getPlayers(room)
        });

        broadcast(
            room,
            {
                type: "player_joined",
                player:
                    publicPlayer(player)
            },
            ws
        );

        return;
    }

    send(ws, {
        type:
            "quick_match_searching"
    });

    // Si aucune partie publique n'existe,
    // on crée automatiquement une partie.

    const code =
        createRoomCode();

    const player =
        createPlayer(ws, data);

    const room = {
        code,
        private: false,
        password: null,
        players: new Map()
    };

    room.players.set(
        player.id,
        player
    );

    rooms.set(
        code,
        room
    );

    ws.player = player;
    ws.room = room;

    setTimeout(() => {

        send(ws, {
            type:
                "quick_match_found",
            room: code,
            playerId:
                player.id,
            players:
                getPlayers(room)
        });

    }, 300);
}


// =====================================================
// POSITION
// =====================================================

function updatePlayer(ws, data) {

    if (!ws.player || !ws.room) {
        return;
    }

    if (
        validNumber(data.latitude)
    ) {
        ws.player.latitude =
            data.latitude;
    }

    if (
        validNumber(data.longitude)
    ) {
        ws.player.longitude =
            data.longitude;
    }

    if (
        validNumber(data.rotation)
    ) {
        ws.player.rotation =
            data.rotation;
    }

    broadcast(
        ws.room,
        {
            type:
                "player_update",
            player:
                publicPlayer(ws.player)
        },
        ws
    );
}


// =====================================================
// VÉHICULE
// =====================================================

function updateVehicle(ws, data) {

    if (!ws.player || !ws.room) {
        return;
    }

    if (
        !VEHICLES.includes(
            data.vehicle
        )
    ) {
        return;
    }

    ws.player.vehicle =
        data.vehicle;

    ws.player.inVehicle =
        data.vehicle !== "walk";

    broadcast(
        ws.room,
        {
            type:
                "vehicle_update",

            playerId:
                ws.player.id,

            vehicle:
                ws.player.vehicle,

            inVehicle:
                ws.player.inVehicle
        },
        ws
    );
}


// =====================================================
// ENTRER
// =====================================================

function enterVehicle(ws, data) {

    if (!ws.player || !ws.room) {
        return;
    }

    const vehicle =
        VEHICLES.includes(
            data.vehicle
        )
            ? data.vehicle
            : "car";

    ws.player.vehicle =
        vehicle;

    ws.player.inVehicle =
        true;

    broadcast(
        ws.room,
        {
            type:
                "vehicle_enter",

            playerId:
                ws.player.id,

            vehicle,

            inVehicle: true
        },
        ws
    );
}


// =====================================================
// SORTIR
// =====================================================

function exitVehicle(ws) {

    if (!ws.player || !ws.room) {
        return;
    }

    ws.player.vehicle =
        "walk";

    ws.player.inVehicle =
        false;

    broadcast(
        ws.room,
        {
            type:
                "vehicle_exit",

            playerId:
                ws.player.id,

            vehicle:
                "walk",

            inVehicle:
                false
        },
        ws
    );
}


// =====================================================
// ACHETER VÉHICULE
// =====================================================

function buyVehicle(ws, data) {

    if (!ws.user) {
        send(ws, {
            type: "error",
            message:
                "Connecte-toi pour acheter un véhicule."
        });

        return;
    }

    const vehicle =
        data.vehicle;

    if (
        !VEHICLES.includes(vehicle)
    ) {
        send(ws, {
            type: "error",
            message:
                "Véhicule invalide."
        });

        return;
    }

    if (
        ws.user.vehicles.includes(
            vehicle
        )
    ) {
        send(ws, {
            type: "error",
            message:
                "Tu possèdes déjà ce véhicule."
        });

        return;
    }

    ws.user.vehicles.push(
        vehicle
    );

    saveUsers();

    send(ws, {
        type:
            "vehicle_purchased",

        vehicle,

        vehicles:
            ws.user.vehicles
    });
}


// =====================================================
// SUPPRESSION JOUEUR
// =====================================================

function removePlayer(ws) {

    if (!ws.player || !ws.room) {
        return;
    }

    const room =
        ws.room;

    const player =
        ws.player;

    room.players.delete(
        player.id
    );

    broadcast(
        room,
        {
            type:
                "player_left",

            playerId:
                player.id
        }
    );

    console.log(
        `👋 ${player.name} a quitté ${room.code}`
    );

    if (
        room.players.size === 0
    ) {
        rooms.delete(
            room.code
        );

        console.log(
            `🗑️ Partie ${room.code} supprimée`
        );
    }

    ws.player = null;
    ws.room = null;
}


// =====================================================
// HEARTBEAT
// =====================================================

setInterval(() => {

    wss.clients.forEach(ws => {

        if (ws.isAlive === false) {
            ws.terminate();
            return;
        }

        ws.isAlive = false;

        ws.ping();
    });

}, 30000);


// =====================================================
// SERVEUR
// =====================================================

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `🚀 RoadGame server lancé sur le port ${PORT}`
        );

        console.log(
            `📡 Port : ${PORT}`
        );

        console.log(
            "🔐 Comptes activés"
        );

        console.log(
            "👥 Amis activés"
        );

        console.log(
            "🌐 Multijoueur activé"
        );

    }
);
