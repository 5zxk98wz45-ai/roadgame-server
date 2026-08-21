// ============================================================
// ROADGAME - SERVER.JS V2
// Comptes + sauvegarde + amis + demandes d'amis
// Parties rapides + serveurs privés avec mot de passe
// Véhicules + entrée/sortie + multijoueur
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

const USERS_FILE =
    path.join(__dirname, "users.json");

const MAX_PLAYERS_PER_ROOM = 20;


// ============================================================
// VÉHICULES DISPONIBLES
// ============================================================

const VEHICLES = {
    walk: {
        name: "À pied",
        price: 0
    },

    car: {
        name: "Voiture",
        price: 0
    },

    truck: {
        name: "Camion",
        price: 500
    },

    bus: {
        name: "Bus",
        price: 1000
    },

    sports: {
        name: "Voiture sportive",
        price: 2500
    },

    police: {
        name: "Voiture de police",
        price: 5000
    }
};


// ============================================================
// CHARGER USERS.JSON
// ============================================================

function loadUsers() {

    try {

        if (!fs.existsSync(USERS_FILE)) {

            fs.writeFileSync(
                USERS_FILE,
                "[]",
                "utf8"
            );

            return [];
        }

        const data =
            fs.readFileSync(
                USERS_FILE,
                "utf8"
            );

        const users =
            JSON.parse(data);

        if (!Array.isArray(users)) {
            return [];
        }

        return users;

    } catch (error) {

        console.error(
            "❌ Erreur users.json :",
            error
        );

        return [];
    }
}


let users = loadUsers();


// ============================================================
// SAUVEGARDER USERS.JSON
// ============================================================

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
// OUTILS
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
        20
    );
}


function cleanUsername(username) {

    if (
        typeof username !== "string"
    ) {

        return "";
    }

    return username
        .trim()
        .toLowerCase()
        .replace(
            /[^a-z0-9_]/g,
            ""
        )
        .substring(
            0,
            20
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
        ws.readyState === WebSocket.OPEN
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
        const player
        of room.players.values()
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
// SERVEUR HTTP
// ============================================================

const server =
    http.createServer(
        (req, res) => {

            if (
                req.url === "/"
            ) {

                res.writeHead(
                    200,
                    {
                        "Content-Type":
                            "text/plain; charset=utf-8"
                    }
                );

                res.end(
                    "RoadGame Server V2 🟢"
                );

                return;
            }


            if (
                req.url === "/status"
            ) {

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

                        rooms:
                            rooms.size,

                        users:
                            users.length

                    })
                );

                return;
            }


            res.writeHead(
                404
            );

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
// PARTIES
// ============================================================

const rooms =
    new Map();


// ============================================================
// CRÉER CODE DE PARTIE
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


// ============================================================
// CRÉER PARTIE
// ============================================================

function createRoom(
    options = {}
) {

    let code =
        options.code ||
        createRoomCode();

    while (
        rooms.has(code)
    ) {

        code =
            createRoomCode();
    }


    const room = {

        code,

        private:
            Boolean(
                options.private
            ),

        password:
            options.password || null,

        players:
            new Map(),

        createdAt:
            Date.now()
    };


    rooms.set(
        code,
        room
    );


    return room;
}


// ============================================================
// TROUVER PARTIE RAPIDE
// ============================================================

function findQuickRoom() {

    for (
        const room
        of rooms.values()
    ) {

        if (
            room.private
        ) {

            continue;
        }

        if (
            room.players.size <
            MAX_PLAYERS_PER_ROOM
        ) {

            return room;
        }
    }


    return createRoom();
}


// ============================================================
// CRÉER JOUEUR
// ============================================================

function createPlayer(
    ws,
    data
) {

    let vehicle =
        data.vehicle;


    if (
        !VEHICLES[vehicle]
    ) {

        vehicle =
            "car";
    }


    const latitude =
        validNumber(
            data.latitude
        )
            ? data.latitude
            : 48.8566;


    const longitude =
        validNumber(
            data.longitude
        )
            ? data.longitude
            : 2.3522;


    return {

        id:
            createId(),

        userId:
            ws.user
                ? ws.user.id
                : null,

        name:
            ws.user
                ? ws.user.username
                : cleanName(
                    data.name
                ),

        vehicle,

        inVehicle:
            vehicle !== "walk",

        latitude,

        longitude,

        rotation: 0,

        ws
    };
}


// ============================================================
// CONNEXION
// ============================================================

wss.on(
    "connection",
    ws => {

        console.log(
            "👤 Nouveau joueur connecté"
        );


        ws.user =
            null;

        ws.player =
            null;

        ws.room =
            null;


        send(
            ws,
            {
                type:
                    "connected",

                version:
                    "2.0.0"
            }
        );


        ws.on(
            "message",
            raw => {

                let data;


                try {

                    data =
                        JSON.parse(
                            raw.toString()
                        );

                } catch {

                    send(
                        ws,
                        {
                            type:
                                "error",

                            message:
                                "JSON invalide."
                        }
                    );

                    return;
                }


                handleMessage(
                    ws,
                    data
                );
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
// GESTION DES MESSAGES
// ============================================================

function handleMessage(
    ws,
    data
) {

    switch (
        data.type
    ) {

        // ==============================
        // COMPTES
        // ==============================

        case "register":
            register(
                ws,
                data
            );
            break;


        case "login":
            login(
                ws,
                data
            );
            break;


        case "logout":
            logout(
                ws
            );
            break;


        case "change_username":
            changeUsername(
                ws,
                data
            );
            break;


        // ==============================
        // AMIS
        // ==============================

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


        case "friend_decline":
            declineFriendRequest(
                ws,
                data
            );
            break;


        case "friends":
            sendFriends(
                ws
            );
            break;


        // ==============================
        // PARTIES
        // ==============================

        case "quick_play":
            quickPlay(
                ws,
                data
            );
            break;


        case "create_room":
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


        case "leave_room":
            removePlayer(
                ws
            );
            break;


        // ==============================
        // JOUEUR
        // ==============================

        case "player_update":
            updatePlayer(
                ws,
                data
            );
            break;


        // ==============================
        // VÉHICULE
        // ==============================

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


        case "vehicle_update":
            updateVehicle(
                ws,
                data
            );
            break;


        case "buy_vehicle":
            buyVehicle(
                ws,
                data
            );
            break;


        // ==============================
        // PING
        // ==============================

        case "ping":

            send(
                ws,
                {
                    type:
                        "pong"
                }
            );

            break;


        default:

            send(
                ws,
                {
                    type:
                        "error",

                    message:
                        "Type de message inconnu."
                }
            );
    }
}


// ============================================================
// INSCRIPTION
// ============================================================

function register(
    ws,
    data
) {

    if (
        ws.user
    ) {

        send(
            ws,
            {
                type:
                    "error",

                message:
                    "Tu es déjà connecté."
            }
        );

        return;
    }


    const username =
        cleanUsername(
            data.username
        );


    const password =
        String(
            data.password || ""
        );


    if (
        username.length < 3
    ) {

        send(
            ws,
            {
                type:
                    "error",

                message:
                    "Le pseudo doit contenir au moins 3 caractères."
            }
        );

        return;
    }


    if (
        password.length < 6
    ) {

        send(
            ws,
            {
                type:
                    "error",

                message:
                    "Le mot de passe doit contenir au moins 6 caractères."
            }
        );

        return;
    }


    const exists =
        users.find(
            user =>
                user.username ===
                username
        );


    if (
        exists
    ) {

        send(
            ws,
            {
                type:
                    "error",

                message:
                    "Ce pseudo existe déjà."
            }
        );

        return;
    }


    const user = {

        id:
            createId(),

        username,

        password:
            hashPassword(
                password
            ),

        friends: [],

        incomingRequests: [],

        outgoingRequests: [],

        ownedVehicles: [
            "car"
        ],

        money: 500,

        createdAt:
            Date.now()
    };


    users.push(
        user
    );


    saveUsers();


    ws.user =
        user;


    sendUserData(
        ws
    );


    console.log(
        `🆕 Compte créé : ${username}`
    );
}


// ============================================================
// CONNEXION COMPTE
// ============================================================

function login(
    ws,
    data
) {

    const username =
        cleanUsername(
            data.username
        );


    const password =
        String(
            data.password || ""
        );


    const hashed =
        hashPassword(
            password
        );


    const user =
        users.find(
            u =>
                u.username ===
                    username &&
                u.password ===
                    hashed
        );


    if (
        !user
    ) {

        send(
            ws,
            {
                type:
                    "error",

                message:
                    "Pseudo ou mot de passe incorrect."
            }
        );

        return;
    }


    ws.user =
        user;


    sendUserData(
        ws
    );


    console.log(
        `🔑 ${username} connecté`
    );
}


// ============================================================
// DONNÉES UTILISATEUR
// ============================================================

function sendUserData(
    ws
) {

    if (
        !ws.user
    ) {

        return;
    }


    send(
        ws,
        {

            type:
                "login_success",

            user: {

                id:
                    ws.user.id,

                username:
                    ws.user.username,

                friends:
                    ws.user.friends,

                incomingRequests:
                    ws.user.incomingRequests,

                outgoingRequests:
                    ws.user.outgoingRequests,

                ownedVehicles:
                    ws.user.ownedVehicles,

                money:
                    ws.user.money
            }

        }
    );
}


// ============================================================
// DÉCONNEXION
// ============================================================

function logout(
    ws
) {

    ws.user =
        null;


    send(
        ws,
        {
            type:
                "logout_success"
        }
    );
}


// ============================================================
// CHANGER PSEUDO
// ============================================================

function changeUsername(
    ws,
    data
) {

    if (
        !ws.user
    ) {

        send(
            ws,
            {
                type:
                    "error",

                message:
                    "Connecte-toi d'abord."
            }
        );

        return;
    }


    const newUsername =
        cleanUsername(
            data.username
        );


    if (
        newUsername.length < 3
    ) {

        send(
            ws,
            {
                type:
                    "error",

                message:
                    "Pseudo invalide."
            }
        );

        return;
    }


    const exists =
        users.find(
            user =>
                user.username ===
                    newUsername &&
                user.id !==
                    ws.user.id
        );


    if (
        exists
    ) {

        send(
            ws,
            {
                type:
                    "error",

                message:
                    "Ce pseudo est déjà utilisé."
            }
        );

        return;
    }


    ws.user.username =
        newUsername;


    saveUsers();


    sendUserData(
        ws
    );
}


// ============================================================
// TROUVER UTILISATEUR
// ============================================================

function findUserByUsername(
    username
) {

    username =
        cleanUsername(
            username
        );


    return users.find(
        user =>
            user.username ===
            username
    );
}


// ============================================================
// DEMANDE D'AMI
// ============================================================

function sendFriendRequest(
    ws,
    data
) {

    if (
        !ws.user
    ) {

        send(
            ws,
            {
                type:
                    "error",

                message:
                    "Connecte-toi d'abord."
            }
        );

        return;
    }


    const target =
        findUserByUsername(
            data.username
        );


    if (
        !target
    ) {

        send(
            ws,
            {
                type:
                    "error",

                message:
                    "Joueur introuvable."
            }
        );

        return;
    }


    if (
        target.id ===
        ws.user.id
    ) {

        return;
    }


    if (
        ws.user.friends.includes(
            target.id
        )
    ) {

        return;
    }


    if (
        target.incomingRequests.includes(
            ws.user.id
        )
    ) {

        return;
    }


    target.incomingRequests.push(
        ws.user.id
    );


    ws.user.outgoingRequests.push(
        target.id
    );


    saveUsers();


    send(
        ws,
        {
            type:
                "friend_request_sent",

            username:
                target.username
        }
    );
}


// ============================================================
// ACCEPTER AMI
// ============================================================

function acceptFriendRequest(
    ws,
    data
) {

    if (
        !ws.user
    ) {

        return;
    }


    const requester =
        findUserByUsername(
            data.username
        );


    if (
        !requester
    ) {

        return;
    }


    if (
        !ws.user.incomingRequests.includes(
            requester.id
        )
    ) {

        return;
    }


    ws.user.incomingRequests =
        ws.user.incomingRequests.filter(
            id =>
                id !==
                requester.id
        );


    requester.outgoingRequests =
        requester.outgoingRequests.filter(
            id =>
                id !==
                ws.user.id
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


    sendUserData(
        ws
    );
}


// ============================================================
// REFUSER AMI
// ============================================================

function declineFriendRequest(
    ws,
    data
) {

    if (
        !ws.user
    ) {

        return;
    }


    const requester =
        findUserByUsername(
            data.username
        );


    if (
        !requester
    ) {

        return;
    }


    ws.user.incomingRequests =
        ws.user.incomingRequests.filter(
            id =>
                id !==
                requester.id
        );


    requester.outgoingRequests =
        requester.outgoingRequests.filter(
            id =>
                id !==
                ws.user.id
        );


    saveUsers();


    sendUserData(
        ws
    );
}


// ============================================================
// LISTE AMIS
// ============================================================

function sendFriends(
    ws
) {

    if (
        !ws.user
    ) {

        return;
    }


    const friends =
        ws.user.friends.map(
            id => {

                const user =
                    users.find(
                        u =>
                            u.id ===
                            id
                    );


                if (!user)
                    return null;


                return {

                    id:
                        user.id,

                    username:
                        user.username
                };
            }
        ).filter(Boolean);


    send(
        ws,
        {

            type:
                "friends",

            friends
        }
    );
}


// ============================================================
// PARTIE RAPIDE
// ============================================================

function quickPlay(
    ws,
    data
) {

    if (
        ws.room
    ) {

        removePlayer(
            ws
        );
    }


    const room =
        findQuickRoom();


    if (
        room.players.size >=
        MAX_PLAYERS_PER_ROOM
    ) {

        send(
            ws,
            {
                type:
                    "error",

                message:
                    "La partie est pleine."
            }
        );

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


    send(
        ws,
        {

            type:
                "room_joined",

            mode:
                "quick",

            room:
                room.code,

            playerId:
                player.id,

            players:
                getPlayers(room)
        }
    );


    broadcast(
        room,
        {

            type:
                "player_joined",

            player:
                publicPlayer(
                    player
                )

        },
        ws
    );
}


// ============================================================
// SERVEUR PRIVÉ
// ============================================================

function createPrivateRoom(
    ws,
    data
) {

    if (
        ws.room
    ) {

        removePlayer(
            ws
        );
    }


    const password =
        String(
            data.password || ""
        );


    if (
        password.length < 3
    ) {

        send(
            ws,
            {
                type:
                    "error",

                message:
                    "Le mot de passe doit contenir au moins 3 caractères."
            }
        );

        return;
    }


    const room =
        createRoom({

            private:
                true,

            password:
                password
        });


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


    send(
        ws,
        {

            type:
                "room_created",

            private:
                true,

            room:
                room.code,

            password:
                password,

            playerId:
                player.id,

            players:
                getPlayers(room)
        }
    );


    console.log(
        `🔒 Serveur privé ${room.code} créé`
    );
}


// ============================================================
// REJOINDRE UNE PARTIE
// ============================================================

function joinRoom(
    ws,
    data
) {

    if (
        ws.room
    ) {

        removePlayer(
            ws
        );
    }


    const code =
        String(
            data.room || ""
        )
        .trim()
        .toUpperCase();


    const room =
        rooms.get(
            code
        );


    if (
        !room
    ) {

        send(
            ws,
            {
                type:
                    "error",

                message:
                    "Serveur introuvable."
            }
        );

        return;
    }


    if (
        room.private &&
        room.password !==
            String(
                data.password || ""
            )
    ) {

        send(
            ws,
            {
                type:
                    "error",

                message:
                    "Mot de passe incorrect."
            }
        );

        return;
    }


    if (
        room.players.size >=
        MAX_PLAYERS_PER_ROOM
    ) {

        send(
            ws,
            {
                type:
                    "error",

                message:
                    "Serveur complet."
            }
        );

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


    send(
        ws,
        {

            type:
                "room_joined",

            room:
                room.code,

            playerId:
                player.id,

            players:
                getPlayers(room)
        }
    );


    broadcast(
        room,
        {

            type:
                "player_joined",

            player:
                publicPlayer(
                    player
                )

        },
        ws
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
        validNumber(
            data.latitude
        )
    ) {

        ws.player.latitude =
            data.latitude;
    }


    if (
        validNumber(
            data.longitude
        )
    ) {

        ws.player.longitude =
            data.longitude;
    }


    if (
        validNumber(
            data.rotation
        )
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
// ENTRER DANS UN VÉHICULE
// ============================================================

function enterVehicle(
    ws,
    data
) {

    if (
        !ws.player
    ) {

        return;
    }


    if (
        !VEHICLES[data.vehicle]
    ) {

        return;
    }


    const user =
        ws.user;


    if (
        user &&
        !user.ownedVehicles.includes(
            data.vehicle
        )
    ) {

        send(
            ws,
            {
                type:
                    "error",

                message:
                    "Tu ne possèdes pas ce véhicule."
            }
        );

        return;
    }


    ws.player.vehicle =
        data.vehicle;


    ws.player.inVehicle =
        true;


    broadcast(
        ws.room,
        {

            type:
                "player_vehicle_enter",

            player:
                publicPlayer(
                    ws.player
                )

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
        !ws.player
    ) {

        return;
    }


    ws.player.inVehicle =
        false;


    ws.player.vehicle =
        "walk";


    broadcast(
        ws.room,
        {

            type:
                "player_vehicle_exit",

            player:
                publicPlayer(
                    ws.player
                )

        }
    );
}


// ============================================================
// CHANGER DE VÉHICULE
// ============================================================

function updateVehicle(
    ws,
    data
) {

    if (
        !ws.player
    ) {

        return;
    }


    if (
        !VEHICLES[data.vehicle]
    ) {

        return;
    }


    if (
        ws.user &&
        !ws.user.ownedVehicles.includes(
            data.vehicle
        )
    ) {

        send(
            ws,
            {
                type:
                    "error",

                message:
                    "Véhicule non acheté."
            }
        );

        return;
    }


    ws.player.vehicle =
        data.vehicle;


    ws.player.inVehicle =
        data.vehicle !==
        "walk";


    broadcast(
        ws.room,
        {

            type:
                "vehicle_update",

            playerId:
                ws.player.id,

            vehicle:
                data.vehicle,

            inVehicle:
                ws.player.inVehicle
        }
    );
}


// ============================================================
// ACHETER UN VÉHICULE
// ============================================================

function buyVehicle(
    ws,
    data
) {

    if (
        !ws.user
    ) {

        send(
            ws,
            {
                type:
                    "error",

                message:
                    "Connecte-toi pour acheter un véhicule."
            }
        );

        return;
    }


    const vehicle =
        VEHICLES[data.vehicle];


    if (
        !vehicle
    ) {

        return;
    }


    if (
        ws.user.ownedVehicles.includes(
            data.vehicle
        )
    ) {

        return;
    }


    if (
        ws.user.money <
        vehicle.price
    ) {

        send(
            ws,
            {
                type:
                    "error",

                message:
                    "Tu n'as pas assez d'argent."
            }
        );

        return;
    }


    ws.user.money -=
        vehicle.price;


    ws.user.ownedVehicles.push(
        data.vehicle
    );


    saveUsers();


    sendUserData(
        ws
    );
}


// ============================================================
// QUITTER UNE PARTIE
// ============================================================

function removePlayer(
    ws
) {

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


    ws.player =
        null;

    ws.room =
        null;


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
}


// ============================================================
// HEARTBEAT
// ============================================================

wss.on(
    "connection",
    ws => {

        ws.isAlive =
            true;


        ws.on(
            "pong",
            () => {

                ws.isAlive =
                    true;
            }
        );
    }
);


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
// NETTOYAGE DES PARTIES VIDES
// ============================================================

setInterval(
    () => {

        const now =
            Date.now();


        for (
            const [
                code,
                room
            ]
            of rooms
        ) {

            if (
                room.players.size === 0 &&
                now - room.createdAt >
                    5 * 60 * 1000
            ) {

                rooms.delete(
                    code
                );
            }
        }

    },
    60000
);


// ============================================================
// LANCEMENT
// ============================================================

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "======================================"
        );

        console.log(
            "🚗 ROADGAME SERVER V2"
        );

        console.log(
            "======================================"
        );

        console.log(
            `🚀 Serveur lancé sur le port ${PORT}`
        );

        console.log(
            `👥 Utilisateurs : ${users.length}`
        );

        console.log(
            "🎮 Multijoueur : ACTIVÉ"
        );

        console.log(
            "🔒 Serveurs privés : ACTIVÉS"
        );

        console.log(
            "👥 Amis : ACTIVÉS"
        );

        console.log(
            "🚗 Véhicules : ACTIVÉS"
        );
    }
);
