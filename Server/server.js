// ============================================================
// ROADGAME - SERVER.JS V2
// Comptes + sauvegarde + amis + parties rapides
// Serveurs privés + mots de passe + véhicules + multijoueur
// ============================================================

const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");


// ============================================================
// CONFIGURATION
// ============================================================

const PORT = process.env.PORT || 10000;

const MAX_PLAYERS = 20;

const MAX_NAME_LENGTH = 20;

const MAX_PASSWORD_LENGTH = 50;


// ============================================================
// BASE DE DONNÉES
// ============================================================

const DATABASE_DIR =
    path.join(__dirname, "database");

const USERS_FILE =
    path.join(DATABASE_DIR, "users.json");


if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, {
        recursive: true
    });
}


if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(
        USERS_FILE,
        "{}",
        "utf8"
    );
}


function loadUsers() {

    try {

        const content =
            fs.readFileSync(
                USERS_FILE,
                "utf8"
            );

        return JSON.parse(content || "{}");

    } catch (error) {

        console.error(
            "❌ Impossible de lire users.json :",
            error
        );

        return {};
    }
}


let users = loadUsers();


function saveUsers() {

    try {

        fs.writeFileSync(
            USERS_FILE,
            JSON.stringify(
                users,
                null,
                2
            ),
            "utf8"
        );

    } catch (error) {

        console.error(
            "❌ Impossible de sauvegarder users.json :",
            error
        );
    }
}


// ============================================================
// SERVEUR HTTP
// ============================================================

const server =
    http.createServer(
        (req, res) => {

            if (req.url === "/") {

                res.writeHead(
                    200,
                    {
                        "Content-Type":
                            "text/plain; charset=utf-8"
                    }
                );

                res.end(
                    "RoadGame V2 Server 🟢"
                );

                return;
            }


            if (req.url === "/health") {

                res.writeHead(
                    200,
                    {
                        "Content-Type":
                            "application/json"
                    }
                );

                res.end(
                    JSON.stringify({
                        online: true,
                        players:
                            wss.clients.size,
                        rooms:
                            rooms.size
                    })
                );

                return;
            }


            res.writeHead(404);

            res.end();
        }
    );


// ============================================================
// WEBSOCKET
// ============================================================

const wss =
    new WebSocket.Server({
        server
    });


// ============================================================
// DONNÉES DU SERVEUR
// ============================================================

const rooms =
    new Map();

const quickMatchQueue =
    new Set();


// ============================================================
// VÉHICULES
// ============================================================

const VEHICLES = {

    walk: {
        name: "À pied",
        speed: 0.5
    },

    car: {
        name: "Voiture",
        speed: 1
    },

    truck: {
        name: "Camion",
        speed: 0.7
    },

    bus: {
        name: "Bus",
        speed: 0.65
    },

    plane: {
        name: "Avion",
        speed: 1.5
    },

    boat: {
        name: "Bateau",
        speed: 0.6
    }

};


// ============================================================
// UTILITAIRES
// ============================================================

function createId() {

    return crypto.randomUUID();

}


function hashPassword(password) {

    return crypto
        .createHash("sha256")
        .update(password)
        .digest("hex");

}


function cleanName(name) {

    if (
        typeof name !== "string"
    ) {

        return "Joueur";

    }


    name =
        name.trim();


    if (!name) {

        return "Joueur";

    }


    return name.substring(
        0,
        MAX_NAME_LENGTH
    );
}


function cleanPassword(password) {

    if (
        typeof password !== "string"
    ) {

        return "";

    }


    return password
        .trim()
        .substring(
            0,
            MAX_PASSWORD_LENGTH
        );
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
        ws.readyState ===
            WebSocket.OPEN
    ) {

        ws.send(
            JSON.stringify(data)
        );

    }

}


function broadcast(
    room,
    data,
    except = null
) {

    for (
        const player of
        room.players.values()
    ) {

        if (
            player.ws !== except
        ) {

            send(
                player.ws,
                data
            );

        }

    }

}


function publicPlayer(player) {

    return {

        id:
            player.id,

        userId:
            player.userId,

        name:
            player.name,

        vehicle:
            player.vehicle,

        inVehicle:
            player.inVehicle,

        latitude:
            player.latitude,

        longitude:
            player.longitude,

        rotation:
            player.rotation
    };

}


function getPlayers(room) {

    return [
        ...room.players.values()
    ].map(
        publicPlayer
    );

}


// ============================================================
// CRÉER UN COMPTE
// ============================================================

function registerAccount(
    ws,
    data
) {

    const username =
        cleanName(
            data.username
        );

    const password =
        cleanPassword(
            data.password
        );


    if (
        username.length < 3
    ) {

        send(ws, {
            type: "error",
            message:
                "Le pseudo doit contenir au moins 3 caractères."
        });

        return;

    }


    if (
        password.length < 4
    ) {

        send(ws, {
            type: "error",
            message:
                "Le mot de passe doit contenir au moins 4 caractères."
        });

        return;

    }


    const existing =
        Object.values(users)
            .find(
                user =>
                    user.username
                        .toLowerCase() ===
                    username.toLowerCase()
            );


    if (existing) {

        send(ws, {
            type: "error",
            message:
                "Ce pseudo est déjà utilisé."
        });

        return;

    }


    const userId =
        createId();


    users[userId] = {

        id:
            userId,

        username:
            username,

        password:
            hashPassword(password),

        friends: [],

        friendRequests: [],

        vehicles: [
            "car"
        ],

        selectedVehicle:
            "car",

        settings: {

            sound: true,

            music: true

        },

        createdAt:
            Date.now()

    };


    saveUsers();


    ws.userId =
        userId;


    send(ws, {

        type:
            "account_created",

        user:
            publicUser(
                users[userId]
            )

    });


    console.log(
        `👤 Compte créé : ${username}`
    );

}


// ============================================================
// CONNEXION
// ============================================================

function loginAccount(
    ws,
    data
) {

    const username =
        cleanName(
            data.username
        );

    const password =
        cleanPassword(
            data.password
        );


    const passwordHash =
        hashPassword(
            password
        );


    const user =
        Object.values(users)
            .find(
                user =>
                    user.username
                        .toLowerCase() ===
                    username.toLowerCase() &&
                    user.password ===
                    passwordHash
            );


    if (!user) {

        send(ws, {
            type: "error",
            message:
                "Pseudo ou mot de passe incorrect."
        });

        return;

    }


    ws.userId =
        user.id;


    send(ws, {

        type:
            "login_success",

        user:
            publicUser(user)

    });


    console.log(
        `🟢 Connexion : ${user.username}`
    );

}


// ============================================================
// DONNÉES PUBLIQUES DU COMPTE
// ============================================================

function publicUser(user) {

    return {

        id:
            user.id,

        username:
            user.username,

        friends:
            user.friends || [],

        friendRequests:
            user.friendRequests || [],

        vehicles:
            user.vehicles || [],

        selectedVehicle:
            user.selectedVehicle ||
            "car",

        settings:
            user.settings || {}

    };

}


// ============================================================
// AUTHENTIFICATION
// ============================================================

function getUser(ws) {

    if (!ws.userId) {

        return null;

    }


    return users[
        ws.userId
    ] || null;

}


// ============================================================
// CHANGER DE PSEUDO
// ============================================================

function changeUsername(
    ws,
    data
) {

    const user =
        getUser(ws);


    if (!user) {

        send(ws, {
            type: "error",
            message:
                "Connecte-toi d'abord."
        });

        return;

    }


    const newName =
        cleanName(
            data.username
        );


    if (
        newName.length < 3
    ) {

        send(ws, {
            type: "error",
            message:
                "Le pseudo est trop court."
        });

        return;

    }


    const existing =
        Object.values(users)
            .find(
                other =>
                    other.id !== user.id &&
                    other.username
                        .toLowerCase() ===
                    newName.toLowerCase()
            );


    if (existing) {

        send(ws, {
            type: "error",
            message:
                "Ce pseudo est déjà utilisé."
        });

        return;

    }


    user.username =
        newName;


    saveUsers();


    if (ws.player) {

        ws.player.name =
            newName;

    }


    send(ws, {

        type:
            "username_changed",

        username:
            newName

    });

}


// ============================================================
// AMIS
// ============================================================

function sendFriendRequest(
    ws,
    data
) {

    const user =
        getUser(ws);


    if (!user) {

        send(ws, {
            type: "error",
            message:
                "Connecte-toi d'abord."
        });

        return;

    }


    const username =
        cleanName(
            data.username
        );


    const target =
        Object.values(users)
            .find(
                other =>
                    other.username
                        .toLowerCase() ===
                    username.toLowerCase()
            );


    if (!target) {

        send(ws, {
            type: "error",
            message:
                "Utilisateur introuvable."
        });

        return;

    }


    if (
        target.id === user.id
    ) {

        send(ws, {
            type: "error",
            message:
                "Tu ne peux pas t'ajouter toi-même."
        });

        return;

    }


    if (
        user.friends.includes(
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
        !target.friendRequests
    ) {

        target.friendRequests = [];

    }


    if (
        target.friendRequests
            .includes(user.id)
    ) {

        send(ws, {
            type: "error",
            message:
                "Demande déjà envoyée."
        });

        return;

    }


    target.friendRequests.push(
        user.id
    );


    saveUsers();


    send(ws, {

        type:
            "friend_request_sent",

        username:
            target.username

    });

}


function acceptFriendRequest(
    ws,
    data
) {

    const user =
        getUser(ws);


    if (!user) {
        return;
    }


    const requestId =
        String(
            data.userId || ""
        );


    if (
        !user.friendRequests
            .includes(requestId)
    ) {

        send(ws, {
            type: "error",
            message:
                "Demande introuvable."
        });

        return;

    }


    const other =
        users[requestId];


    if (!other) {

        send(ws, {
            type: "error",
            message:
                "Utilisateur introuvable."
        });

        return;

    }


    if (!user.friends.includes(
        other.id
    )) {

        user.friends.push(
            other.id
        );

    }


    if (!other.friends.includes(
        user.id
    )) {

        other.friends.push(
            user.id
        );

    }


    user.friendRequests =
        user.friendRequests.filter(
            id => id !== other.id
        );


    saveUsers();


    send(ws, {

        type:
            "friend_added",

        user:
            publicUser(user)

    });

}


// ============================================================
// PARTIES
// ============================================================

function createRoomCode() {

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code;


    do {

        code = "";


        for (
            let i = 0;
            i < 6;
            i++
        ) {

            code +=
                chars[
                    Math.floor(
                        Math.random() *
                        chars.length
                    )
                ];

        }

    } while (
        rooms.has(code)
    );


    return code;

}


function createPlayer(
    ws,
    data
) {

    const user =
        getUser(ws);


    const selectedVehicle =
        user &&
        VEHICLES[
            user.selectedVehicle
        ]
            ? user.selectedVehicle
            : "car";


    let vehicle =
        data.vehicle;


    if (
        !VEHICLES[vehicle]
    ) {

        vehicle =
            selectedVehicle;

    }


    return {

        id:
            createId(),

        userId:
            ws.userId || null,

        name:
            user
                ? user.username
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

        rotation:
            validNumber(data.rotation)
                ? data.rotation
                : 0,

        ws

    };

}


// ============================================================
// CRÉER SERVEUR PUBLIC
// ============================================================

function createRoom(
    ws,
    data,
    isQuickMatch = false
) {

    if (ws.room) {

        send(ws, {
            type: "error",
            message:
                "Tu es déjà dans une partie."
        });

        return;

    }


    const roomCode =
        createRoomCode();


    const room = {

        code:
            roomCode,

        private:
            false,

        password:
            null,

        players:
            new Map(),

        quickMatch:
            isQuickMatch

    };


    const player =
        createPlayer(
            ws,
            data
        );


    room.players.set(
        player.id,
        player
    );


    rooms.set(
        roomCode,
        room
    );


    ws.player =
        player;

    ws.room =
        room;


    send(ws, {

        type:
            "room_created",

        room:
            roomCode,

        private:
            false,

        playerId:
            player.id,

        players:
            getPlayers(room)

    });


    console.log(
        `🏠 Partie ${roomCode} créée`
    );

}


// ============================================================
// SERVEUR PRIVÉ
// ============================================================

function createPrivateRoom(
    ws,
    data
) {

    const password =
        cleanPassword(
            data.password
        );


    if (
        password.length < 1
    ) {

        send(ws, {
            type: "error",
            message:
                "Entre un mot de passe."
        });

        return;

    }


    if (password.length >
        MAX_PASSWORD_LENGTH
    ) {

        send(ws, {
            type: "error",
            message:
                "Mot de passe trop long."
        });

        return;

    }


    createRoom(
        ws,
        data,
        false
    );


    if (!ws.room) {
        return;
    }


    ws.room.private =
        true;


    ws.room.password =
        hashPassword(
            password
        );


    send(ws, {

        type:
            "private_room_created",

        room:
            ws.room.code

    });

}


// ============================================================
// REJOINDRE UNE PARTIE
// ============================================================

function joinRoom(
    ws,
    data
) {

    if (ws.room) {

        send(ws, {
            type: "error",
            message:
                "Tu es déjà dans une partie."
        });

        return;

    }


    const code =
        String(
            data.room || ""
        )
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
        room.private
    ) {

        const password =
            cleanPassword(
                data.password
            );


        if (
            hashPassword(password) !==
            room.password
        ) {

            send(ws, {
                type: "error",
                message:
                    "Mot de passe incorrect."
            });

            return;

        }

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


    const player =
        createPlayer(
            ws,
            data
        );


    room.players.set(
        player.id,
        player
    );


    ws.player =
        player;

    ws.room =
        room;


    send(ws, {

        type:
            "room_joined",

        room:
            room.code,

        private:
            room.private,

        playerId:
            player.id,

        players:
            getPlayers(room)

    });


    broadcast(
        room,
        {
            type:
                "player_joined",

            player:
                publicPlayer(player)
        },
        ws
    );


    console.log(
        `👤 ${player.name} rejoint ${room.code}`
    );

}


// ============================================================
// PARTIE RAPIDE
// ============================================================

function quickMatch(
    ws,
    data
) {

    if (ws.room) {

        send(ws, {
            type: "error",
            message:
                "Tu es déjà dans une partie."
        });

        return;

    }


    quickMatchQueue.add(ws);


    send(ws, {

        type:
            "quick_match_searching"

    });


    tryCreateQuickMatch();

}


function tryCreateQuickMatch() {

    const available =
        [...quickMatchQueue]
            .filter(
                ws =>
                    ws.readyState ===
                        WebSocket.OPEN &&
                    !ws.room
            );


    if (
        available.length < 2
    ) {

        return;

    }


    const players =
        available.slice(
            0,
            MAX_PLAYERS
        );


    players.forEach(
        ws =>
            quickMatchQueue.delete(ws)
    );


    const first =
        players[0];


    createRoom(
        first,
        {},
        true
    );


    if (!first.room) {
        return;
    }


    const room =
        first.room;


    for (
        let i = 1;
        i < players.length;
        i++
    ) {

        const ws =
            players[i];


        if (
            ws.room
        ) {
            continue;
        }


        const player =
            createPlayer(
                ws,
                {}
            );


        room.players.set(
            player.id,
            player
        );


        ws.player =
            player;

        ws.room =
            room;


        send(ws, {

            type:
                "quick_match_found",

            room:
                room.code,

            playerId:
                player.id,

            players:
                getPlayers(room)

        });


        broadcast(
            room,
            {
                type:
                    "player_joined",

                player:
                    publicPlayer(player)
            },
            ws
        );

    }


    send(
        first,
        {

            type:
                "quick_match_found",

            room:
                room.code,

            playerId:
                first.player.id,

            players:
                getPlayers(room)

        }
    );


}


// ============================================================
// POSITION DU JOUEUR
// ============================================================

function updatePlayer(
    ws,
    data
) {

    if (
        !ws.player ||
        !ws.room
    ) {

        return;

    }


    if (
        !validNumber(data.latitude) ||
        !validNumber(data.longitude)
    ) {

        return;

    }


    ws.player.latitude =
        data.latitude;

    ws.player.longitude =
        data.longitude;


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
                publicPlayer(
                    ws.player
                )
        },
        ws
    );

}


// ============================================================
// CHANGEMENT DE VÉHICULE
// ============================================================

function updateVehicle(
    ws,
    data
) {

    if (
        !ws.player ||
        !ws.room
    ) {

        return;

    }


    const vehicle =
        data.vehicle;


    if (
        !VEHICLES[vehicle]
    ) {

        return;

    }


    const user =
        getUser(ws);


    if (
        user &&
        !user.vehicles.includes(
            vehicle
        )
    ) {

        send(ws, {
            type: "error",
            message:
                "Tu ne possèdes pas ce véhicule."
        });

        return;

    }


    ws.player.vehicle =
        vehicle;

    ws.player.inVehicle =
        vehicle !== "walk";


    if (user) {

        user.selectedVehicle =
            vehicle;

        saveUsers();

    }


    broadcast(
        ws.room,
        {
            type:
                "vehicle_update",

            playerId:
                ws.player.id,

            vehicle,

            inVehicle:
                ws.player.inVehicle

        }
    );

}


// ============================================================
// ENTRER DANS UN VÉHICULE
// ============================================================

function enterVehicle(
    ws,
    data
) {

    if (
        !ws.player ||
        !ws.room
    ) {
        return;
    }


    const vehicle =
        data.vehicle;


    if (
        !VEHICLES[vehicle] ||
        vehicle === "walk"
    ) {

        return;

    }


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

            vehicle

        }
    );

}


// ============================================================
// SORTIR DU VÉHICULE
// ============================================================

function exitVehicle(
    ws
) {

    if (
        !ws.player ||
        !ws.room
    ) {
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
                ws.player.id

        }
    );

}


// ============================================================
// PARAMÈTRES
// ============================================================

function updateSettings(
    ws,
    data
) {

    const user =
        getUser(ws);


    if (!user) {
        return;
    }


    if (
        typeof data.sound ===
        "boolean"
    ) {

        user.settings.sound =
            data.sound;

    }


    if (
        typeof data.music ===
        "boolean"
    ) {

        user.settings.music =
            data.music;

    }


    saveUsers();


    send(ws, {

        type:
            "settings_updated",

        settings:
            user.settings

    });

}


// ============================================================
// MAGASIN
// ============================================================

function buyVehicle(
    ws,
    data
) {

    const user =
        getUser(ws);


    if (!user) {

        send(ws, {
            type: "error",
            message:
                "Connecte-toi d'abord."
        });

        return;

    }


    const vehicle =
        data.vehicle;


    if (
        !VEHICLES[vehicle]
    ) {

        send(ws, {
            type: "error",
            message:
                "Véhicule inconnu."
        });

        return;

    }


    if (
        user.vehicles.includes(
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


    // Pour l'instant les véhicules
    // sont gratuits dans la V2.

    user.vehicles.push(
        vehicle
    );


    saveUsers();


    send(ws, {

        type:
            "vehicle_purchased",

        vehicle,

        vehicles:
            user.vehicles

    });

}


// ============================================================
// SUPPRIMER UN JOUEUR
// ============================================================

function removePlayer(
    ws
) {

    quickMatchQueue.delete(
        ws
    );


    if (
        !ws.player ||
        !ws.room
    ) {

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


    ws.player =
        null;

    ws.room =
        null;

}


// ============================================================
// GESTION DES MESSAGES
// ============================================================

function handleMessage(
    ws,
    data
) {

    if (
        !data ||
        typeof data.type !==
            "string"
    ) {

        return;

    }


    switch (
        data.type
    ) {

        case "register":
            registerAccount(
                ws,
                data
            );
            break;


        case "login":
            loginAccount(
                ws,
                data
            );
            break;


        case "change_username":
            changeUsername(
                ws,
                data
            );
            break;


        case "friend_request":
            sendFriendRequest(
                ws,
                data
            );
            break;


        case "friend_accept":
            acceptFriendRequest(
                ws,
                data
            );
            break;


        case "create_room":
            createRoom(
                ws,
                data
            );
            break;


        case "create_private_room":
            createPrivateRoom(
                ws,
                data
            );
            break;


        case "join_room":
            joinRoom(
                ws,
                data
            );
            break;


        case "quick_match":
            quickMatch(
                ws,
                data
            );
            break;


        case "player_update":
            updatePlayer(
                ws,
                data
            );
            break;


        case "vehicle_update":
            updateVehicle(
                ws,
                data
            );
            break;


        case "enter_vehicle":
            enterVehicle(
                ws,
                data
            );
            break;


        case "exit_vehicle":
            exitVehicle(
                ws
            );
            break;


        case "buy_vehicle":
            buyVehicle(
                ws,
                data
            );
            break;


        case "settings_update":
            updateSettings(
                ws,
                data
            );
            break;


        case "ping":

            send(ws, {
                type:
                    "pong"
            });

            break;


        default:

            send(ws, {
                type:
                    "error",

                message:
                    "Type de message inconnu."
            });

    }

}


// ============================================================
// CONNEXIONS
// ============================================================

wss.on(
    "connection",
    ws => {

        console.log(
            "👤 Nouveau joueur connecté"
        );


        ws.userId =
            null;

        ws.player =
            null;

        ws.room =
            null;


        ws.isAlive =
            true;


        send(ws, {
            type:
                "connected"
        });


        ws.on(
            "pong",
            () => {

                ws.isAlive =
                    true;

            }
        );


        ws.on(
            "message",
            raw => {

                try {

                    const data =
                        JSON.parse(
                            raw.toString()
                        );


                    handleMessage(
                        ws,
                        data
                    );

                } catch {

                    send(ws, {

                        type:
                            "error",

                        message:
                            "Message JSON invalide."

                    });

                }

            }
        );


        ws.on(
            "close",
            () => {

                removePlayer(
                    ws
                );

            }
        );


        ws.on(
            "error",
            () => {

                removePlayer(
                    ws
                );

            }
        );

    }
);


// ============================================================
// HEARTBEAT
// ============================================================

setInterval(
    () => {

        wss.clients.forEach(
            ws => {

                if (
                    ws.isAlive ===
                    false
                ) {

                    ws.terminate();

                    return;

                }


                ws.isAlive =
                    false;


                ws.ping();

            }
        );

    },
    30000
);


// ============================================================
// NETTOYAGE DES PARTIES RAPIDES
// ============================================================

setInterval(
    tryCreateQuickMatch,
    2000
);


// ============================================================
// DÉMARRAGE
// ============================================================

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `🚀 RoadGame V2 lancé sur le port ${PORT}`
        );

    }
);
