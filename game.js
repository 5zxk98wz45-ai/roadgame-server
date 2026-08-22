"use strict";

/* =========================================================
   ROADGAME V5
========================================================= */

const SERVER_URL = "wss://roadgame-server.onrender.com";

const NOMINATIM_URL =
    "https://nominatim.openstreetmap.org/search";

let socket = null;
let connected = false;
let loggedIn = false;

let currentUser = null;
let currentRoom = null;
let currentPlayerId = null;

let selectedVehicle = "car";

let players = {};

let gameStarted = false;

let loadingProgress = 0;

let spawnLocation = {
    lat: 48.9625,
    lon: 2.5275,
    name: "Villepinte, France"
};

let map = null;
let mapLoaded = false;

let gameCanvas = null;
let gameCtx = null;

let player = {
    x: 0,
    y: 0,
    angle: 0,
    speed: 0,
    vx: 0,
    vy: 0
};

let joystick = {
    active: false,
    x: 0,
    y: 0
};

let cameraAngle = 0;
let cameraX = 0;
let cameraY = 0;

let lastFrame = 0;


/* =========================================================
   DOM
========================================================= */

function $(id) {
    return document.getElementById(id);
}

function show(id) {
    const el = $(id);
    if (el) el.classList.remove("hidden");
}

function hide(id) {
    const el = $(id);
    if (el) el.classList.add("hidden");
}

function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
}


/* =========================================================
   NOTIFICATION
========================================================= */

function notify(message) {

    console.log(message);

    const old = document.querySelector(
        ".roadgameNotification"
    );

    if (old) old.remove();

    const box = document.createElement("div");

    box.className = "roadgameNotification";

    box.textContent = message;

    Object.assign(box.style, {
        position: "fixed",
        left: "50%",
        top: "25px",
        transform: "translateX(-50%)",
        zIndex: "2000",
        padding: "14px 20px",
        background: "#10171b",
        color: "white",
        borderRadius: "15px",
        boxShadow: "0 5px 20px rgba(0,0,0,.4)"
    });

    document.body.appendChild(box);

    setTimeout(() => box.remove(), 3500);
}


/* =========================================================
   MESSAGES
========================================================= */

function authMessage(message, success = false) {

    const el = $("authMessage");

    if (!el) return;

    el.textContent = message;

    el.style.color =
        success ? "#35e875" : "#ff6666";
}

function multiplayerMessage(message) {
    setText("multiplayerMessage", message);
}

function privateMessage(message) {
    setText("privateRoomMessage", message);
}

function usernameMessage(message) {
    setText("usernameMessage", message);
}


/* =========================================================
   CHARGEMENT
   IMPORTANT :
   LE JEU NE RESTE PAS BLOQUÉ EN ATTENDANT RENDER
========================================================= */

function setLoadingProgress(value) {

    loadingProgress =
        Math.max(0, Math.min(100, value));

    const bar = $("loadingProgress");

    if (bar) {
        bar.style.width =
            loadingProgress + "%";
    }

    const text = $("loadingText");

    if (text) {
        text.textContent =
            "Chargement... " +
            Math.round(loadingProgress) +
            "%";
    }
}

function setLoadingText(text) {

    const el = $("loadingText");

    if (el) {
        el.textContent = text;
    }
}

function finishLoading() {

    setLoadingProgress(100);

    setLoadingText(
        connected
            ? "Serveur connecté !"
            : "Prêt !"
    );

    setTimeout(() => {

        hide("loadingScreen");

        if (!loggedIn) {
            show("authScreen");
        } else {
            show("mainMenu");
        }

    }, 250);
}

function startLoading() {

    setLoadingProgress(10);

    setLoadingText(
        "Préparation du jeu..."
    );

    setTimeout(() => {
        setLoadingProgress(35);
    }, 150);

    setTimeout(() => {
        setLoadingProgress(60);
    }, 300);

    setTimeout(() => {
        setLoadingProgress(80);
    }, 500);

    /*
       ON NE BLOQUE PAS À 90%.
       Même si Render dort, le jeu continue.
    */

    setTimeout(() => {

        if (!$("loadingScreen")
            ?.classList.contains("hidden")) {

            finishLoading();

        }

    }, 900);
}


/* =========================================================
   WEBSOCKET
========================================================= */

function connectServer() {

    if (
        socket &&
        (
            socket.readyState === WebSocket.OPEN ||
            socket.readyState === WebSocket.CONNECTING
        )
    ) {
        return;
    }

    try {

        socket = new WebSocket(
            SERVER_URL
        );

    } catch (error) {

        console.error(error);

        connected = false;

        return;
    }

    socket.addEventListener(
        "open",
        () => {

            connected = true;

            console.log(
                "🟢 RoadGame serveur connecté"
            );

            if (
                $("loadingScreen") &&
                !$("loadingScreen")
                    .classList.contains("hidden")
            ) {
                finishLoading();
            }

        }
    );

    socket.addEventListener(
        "message",
        event => {

            let data;

            try {
                data = JSON.parse(event.data);
            } catch {
                console.warn(
                    "Message serveur invalide",
                    event.data
                );
                return;
            }

            handleServerMessage(data);
        }
    );

    socket.addEventListener(
        "close",
        () => {

            connected = false;

            console.log(
                "🔴 Serveur déconnecté"
            );

            if (gameStarted) {

                notify(
                    "⚠️ Serveur déconnecté"
                );

            }

        }
    );

    socket.addEventListener(
        "error",
        error => {

            console.error(
                "WebSocket error",
                error
            );

            connected = false;

        }
    );
}


/* =========================================================
   SEND
========================================================= */

function send(data) {

    if (
        !socket ||
        socket.readyState !== WebSocket.OPEN
    ) {

        return false;
    }

    socket.send(
        JSON.stringify(data)
    );

    return true;
}


/* =========================================================
   SERVEUR
========================================================= */

function handleServerMessage(data) {

    switch (data.type) {

        case "connected":
            break;

        case "account_created":
            handleAccountCreated(data.user);
            break;

        case "login_success":
            handleLoginSuccess(data.user);
            break;

        case "error":
            handleServerError(data.message);
            break;

        case "username_changed":

            if (currentUser) {
                currentUser.username =
                    data.username;
            }

            setText(
                "welcomeText",
                "Bienvenue " +
                data.username
            );

            usernameMessage(
                "Pseudo modifié !"
            );

            break;

        case "room_created":
            handleRoom(data);
            break;

        case "room_joined":
            handleRoom(data);
            break;

        case "quick_match_found":
            handleRoom(data);
            notify("⚡ Partie trouvée !");
            break;

        case "quick_match_searching":

            multiplayerMessage(
                "🔎 Recherche d'une partie..."
            );

            break;

        case "player_joined":

            if (data.player) {
                players[data.player.id] =
                    data.player;
            }

            refreshPlayersList();

            break;

        case "player_left":

            delete players[data.playerId];

            refreshPlayersList();

            break;

        case "player_update":

            if (data.player) {
                players[data.player.id] =
                    data.player;
            }

            refreshPlayersList();

            break;

        case "vehicle_update":

        case "vehicle_enter":

        case "vehicle_exit":

            updateRemoteVehicle(data);

            break;

        case "vehicle_purchased":

            if (currentUser) {
                currentUser.vehicles =
                    data.vehicles;
            }

            renderGarage();
            renderShop();

            notify("🚗 Véhicule acheté !");

            break;

        case "settings_updated":

            if (currentUser) {
                currentUser.settings =
                    data.settings;
            }

            break;

        case "friend_request_sent":

            notify(
                "👥 Demande envoyée à " +
                data.username
            );

            break;

        case "friend_added":

            if (data.user) {
                currentUser = data.user;
            }

            renderFriends();

            break;

        default:

            console.log(
                "Message non géré :",
                data.type
            );
    }
}


/* =========================================================
   SERVER ERROR
========================================================= */

function handleServerError(message) {

    console.error(
        "Serveur :",
        message
    );

    if (
        $("authScreen") &&
        !$("authScreen")
            .classList.contains("hidden")
    ) {

        authMessage(message);

        return;
    }

    if (
        $("multiplayerScreen") &&
        !$("multiplayerScreen")
            .classList.contains("hidden")
    ) {

        multiplayerMessage(message);

        return;
    }

    notify("❌ " + message);
}


/* =========================================================
   COMPTES
========================================================= */

function registerAccount() {

    if (!connected) {

        authMessage(
            "⏳ Le serveur est encore en démarrage. Réessaie dans quelques secondes."
        );

        connectServer();

        return;
    }

    const username =
        $("usernameInput")
            .value.trim();

    const password =
        $("passwordInput")
            .value;

    if (username.length < 3) {

        authMessage(
            "Le pseudo doit contenir au moins 3 caractères."
        );

        return;
    }

    if (password.length < 4) {

        authMessage(
            "Le mot de passe doit contenir au moins 4 caractères."
        );

        return;
    }

    authMessage(
        "Création du compte..."
    );

    send({
        type: "register",
        username,
        password
    });
}


function loginAccount() {

    if (!connected) {

        authMessage(
            "⏳ Le serveur n'est pas encore disponible."
        );

        connectServer();

        return;
    }

    const username =
        $("usernameInput")
            .value.trim();

    const password =
        $("passwordInput")
            .value;

    if (!username || !password) {

        authMessage(
            "Entre ton pseudo et ton mot de passe."
        );

        return;
    }

    authMessage(
        "Connexion..."
    );

    send({
        type: "login",
        username,
        password
    });
}


function handleAccountCreated(user) {

    currentUser = user;

    loggedIn = true;

    selectedVehicle =
        user.selectedVehicle ||
        "car";

    authMessage(
        "Compte créé !",
        true
    );

    setTimeout(openMainMenu, 300);
}


function handleLoginSuccess(user) {

    currentUser = user;

    loggedIn = true;

    selectedVehicle =
        user.selectedVehicle ||
        "car";

    authMessage(
        "Connexion réussie !",
        true
    );

    setTimeout(openMainMenu, 300);
}


/* =========================================================
   INVITÉ
========================================================= */

function playAsGuest() {

    currentUser = {

        id:
            "guest-" +
            Date.now(),

        username:
            "Invité",

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
        }

    };

    loggedIn = false;

    openMainMenu();
}


/* =========================================================
   MENU
========================================================= */

function openMainMenu() {

    [
        "authScreen",
        "multiplayerScreen",
        "privateRoomScreen",
        "roomScreen",
        "friendsScreen",
        "garageScreen",
        "shopScreen",
        "settingsScreen",
        "usernameScreen",
        "mapScreen",
        "pauseScreen",
        "gameHud"
    ].forEach(hide);

    show("mainMenu");

    setText(
        "welcomeText",
        "Bienvenue " +
        (
            currentUser
                ? currentUser.username
                : "Joueur"
        )
    );

    renderGarage();
    renderShop();
    renderFriends();
}


/* =========================================================
   ADRESSE OPENSTREETMAP
========================================================= */

async function searchAddress() {

    const input = $("addressInput");

    const result = $("addressResult");

    if (!input || !result) return;

    const query =
        input.value.trim();

    if (!query) {

        result.textContent =
            "Entre une adresse ou une ville.";

        return;
    }

    result.textContent =
        "🔎 Recherche...";

    try {

        const url =
            NOMINATIM_URL +
            "?format=jsonv2" +
            "&limit=5" +
            "&q=" +
            encodeURIComponent(query);

        const response =
            await fetch(url, {
                headers: {
                    "Accept":
                        "application/json"
                }
            });

        if (!response.ok) {
            throw new Error(
                "Nominatim HTTP " +
                response.status
            );
        }

        const results =
            await response.json();

        if (!results.length) {

            result.textContent =
                "❌ Adresse introuvable.";

            return;
        }

        result.innerHTML = "";

        results.forEach(place => {

            const button =
                document.createElement(
                    "button"
                );

            button.className =
                "addressFound";

            button.style.width =
                "100%";

            button.style.color =
                "white";

            button.textContent =
                "📍 " +
                place.display_name;

            button.onclick = () => {

                spawnLocation = {

                    lat:
                        Number(place.lat),

                    lon:
                        Number(place.lon),

                    name:
                        place.display_name

                };

                result.innerHTML =
                    "✅ Spawn sélectionné :<br>" +
                    place.display_name;

                notify(
                    "📍 Spawn défini !"
                );

                /*
                   Si le joueur est déjà dans la partie,
                   on le téléporte immédiatement.
                */

                if (gameStarted) {

                    spawnAtLocation(
                        spawnLocation
                    );

                }

            };

            result.appendChild(button);

        });

    } catch (error) {

        console.error(
            "Erreur OpenStreetMap :",
            error
        );

        result.textContent =
            "❌ Impossible de rechercher l'adresse. Vérifie ta connexion.";

    }
}


/* =========================================================
   SPAWN
========================================================= */

function spawnAtLocation(location) {

    /*
       Conversion approximative des coordonnées GPS
       en monde de jeu.
    */

    player.x =
        location.lon * 1000;

    player.y =
        location.lat * 1000;

    player.vx = 0;
    player.vy = 0;
    player.speed = 0;

    cameraX = player.x;
    cameraY = player.y;

    notify(
        "📍 Spawn : " +
        location.name
    );

    if (connected) {

        send({
            type: "player_update",

            x: player.x,
            y: player.y,

            lat: location.lat,
            lon: location.lon,

            vehicle: selectedVehicle
        });

    }
}


/* =========================================================
   MULTIJOUEUR
========================================================= */

function openMultiplayer() {

    hide("mainMenu");

    show("multiplayerScreen");

    multiplayerMessage("");
}


function createPublicRoom() {

    if (!connected) {

        multiplayerMessage(
            "⏳ Serveur indisponible."
        );

        connectServer();

        return;
    }

    send({
        type: "create_room",
        vehicle: selectedVehicle
    });
}


function openPrivateRoom() {

    hide("multiplayerScreen");

    show("privateRoomScreen");
}


function createPrivateRoom() {

    const password =
        $("privatePasswordInput")
            .value;

    if (!password) {

        privateMessage(
            "Entre un mot de passe."
        );

        return;
    }

    send({

        type:
            "create_private_room",

        password,

        vehicle:
            selectedVehicle

    });
}


function joinRoom() {

    const room =
        $("roomCodeInput")
            .value
            .trim()
            .toUpperCase();

    const password =
        $("roomPasswordInput")
            .value;

    if (room.length !== 6) {

        multiplayerMessage(
            "Le code doit contenir 6 caractères."
        );

        return;
    }

    send({

        type: "join_room",

        room,

        password,

        vehicle:
            selectedVehicle

    });
}


function quickMatch() {

    if (!connected) {

        multiplayerMessage(
            "⏳ Serveur indisponible."
        );

        connectServer();

        return;
    }

    multiplayerMessage(
        "🔎 Recherche..."
    );

    send({

        type:
            "quick_match",

        vehicle:
            selectedVehicle

    });
}


/* =========================================================
   ROOM
========================================================= */

function handleRoom(data) {

    currentRoom =
        data.room;

    currentPlayerId =
        data.playerId;

    players = {};

    if (Array.isArray(data.players)) {

        data.players.forEach(
            p => {
                players[p.id] = p;
            }
        );

    }

    hide("multiplayerScreen");
    hide("privateRoomScreen");

    show("roomScreen");

    setText(
        "currentRoomCode",
        currentRoom
    );

    refreshPlayersList();
}


/* =========================================================
   JOUEURS
========================================================= */

function refreshPlayersList() {

    const list =
        $("playersList");

    if (!list) return;

    list.innerHTML = "";

    Object.values(players)
        .forEach(p => {

            const div =
                document.createElement(
                    "div"
                );

            div.className =
                "playerItem";

            div.textContent =
                "👤 " +
                (
                    p.name ||
                    p.username ||
                    "Joueur"
                ) +
                " — " +
                (
                    p.inVehicle
                        ? "🚗"
                        : "🚶"
                );

            list.appendChild(div);

        });
}


function updateRemoteVehicle(data) {

    const p =
        players[data.playerId];

    if (!p) return;

    p.vehicle =
        data.vehicle;

    p.inVehicle =
        data.inVehicle;

    refreshPlayersList();
}


/* =========================================================
   QUITTER ROOM
========================================================= */

function leaveRoom() {

    if (socket) {

        try {
            socket.close();
        } catch {}

    }

    currentRoom = null;
    currentPlayerId = null;

    players = {};

    connected = false;

    hide("roomScreen");

    show("mainMenu");

    setTimeout(
        connectServer,
        500
    );
}


/* =========================================================
   JEU
========================================================= */

function startGame() {

    gameStarted = true;

    hide("mainMenu");
    hide("roomScreen");
    hide("pauseScreen");

    show("gameHud");

    initGameCanvas();

    spawnAtLocation(
        spawnLocation
    );

    notify(
        "🚗 Bienvenue dans RoadGame !"
    );

    requestAnimationFrame(
        gameLoop
    );
}


function initGameCanvas() {

    gameCanvas =
        $("gameCanvas");

    if (!gameCanvas) return;

    gameCtx =
        gameCanvas.getContext("2d");

    resizeCanvas();

    window.addEventListener(
        "resize",
        resizeCanvas
    );
}


function resizeCanvas() {

    if (!gameCanvas) return;

    const dpr =
        Math.min(
            window.devicePixelRatio || 1,
            2
        );

    gameCanvas.width =
        window.innerWidth * dpr;

    gameCanvas.height =
        window.innerHeight * dpr;

    gameCanvas.style.width =
        window.innerWidth + "px";

    gameCanvas.style.height =
        window.innerHeight + "px";

    if (gameCtx) {
        gameCtx.setTransform(
            dpr,
            0,
            0,
            dpr,
            0,
            0
        );
    }
}


/* =========================================================
   PHYSIQUE + CAMÉRA
========================================================= */

function updateGame(dt) {

    const inputX =
        joystick.x;

    const inputY =
        joystick.y;

    const inputPower =
        Math.min(
            1,
            Math.hypot(
                inputX,
                inputY
            )
        );

    /*
       Joystick vers le haut = avancer.
    */

    if (inputPower > 0.05) {

        const targetAngle =
            Math.atan2(
                inputY,
                inputX
            ) +
            Math.PI / 2;

        /*
           Rotation progressive du joueur.
        */

        let difference =
            normalizeAngle(
                targetAngle -
                player.angle
            );

        player.angle +=
            difference *
            Math.min(
                1,
                dt * 10
            );

        const acceleration =
            selectedVehicle === "walk"
                ? 180
                : 260;

        player.speed +=
            acceleration *
            inputPower *
            dt;

    } else {

        player.speed *=
            Math.pow(
                0.08,
                dt
            );
    }

    const maxSpeed =
        selectedVehicle === "walk"
            ? 180
            : 500;

    player.speed =
        Math.max(
            -maxSpeed,
            Math.min(
                maxSpeed,
                player.speed
            )
        );

    /*
       Marche arrière avec bas du joystick.
    */

    const directionX =
        Math.sin(player.angle);

    const directionY =
        -Math.cos(player.angle);

    player.vx =
        directionX *
        player.speed;

    player.vy =
        directionY *
        player.speed;

    player.x +=
        player.vx *
        dt;

    player.y +=
        player.vy *
        dt;

    /*
       Caméra suit le joueur.
    */

    cameraX +=
        (player.x - cameraX) *
        Math.min(
            1,
            dt * 6
        );

    cameraY +=
        (player.y - cameraY) *
        Math.min(
            1,
            dt * 6
        );

    /*
       CAMÉRA QUI TOURNE.
       Elle suit progressivement
       l'orientation du véhicule.
    */

    let cameraDifference =
        normalizeAngle(
            player.angle -
            cameraAngle
        );

    cameraAngle +=
        cameraDifference *
        Math.min(
            1,
            dt * 5
        );

    /*
       Envoie la position aux autres joueurs.
    */

    if (
        connected &&
        Math.abs(player.speed) > 1
    ) {

        send({
            type: "player_update",

            x: player.x,
            y: player.y,

            angle: player.angle,

            vehicle:
                selectedVehicle
        });

    }
}


function normalizeAngle(angle) {

    while (angle > Math.PI) {
        angle -= Math.PI * 2;
    }

    while (angle < -Math.PI) {
        angle += Math.PI * 2;
    }

    return angle;
}


/* =========================================================
   DESSIN DU MONDE
========================================================= */

function drawGame() {

    if (!gameCtx) return;

    const ctx = gameCtx;

    const width =
        window.innerWidth;

    const height =
        window.innerHeight;

    ctx.clearRect(
        0,
        0,
        width,
        height
    );

    /*
       Fond.
    */

    ctx.fillStyle =
        "#24372b";

    ctx.fillRect(
        0,
        0,
        width,
        height
    );

    ctx.save();

    ctx.translate(
        width / 2,
        height / 2
    );

    /*
       Rotation de la caméra.
    */

    ctx.rotate(
        -cameraAngle
    );

    ctx.translate(
        -cameraX,
        -cameraY
    );

    /*
       Grille du monde.
    */

    drawRoads(
        ctx,
        cameraX,
        cameraY,
        width,
        height
    );

    /*
       Joueur.
    */

    drawPlayer(
        ctx
    );

    /*
       Joueurs multijoueur.
    */

    Object.values(players)
        .forEach(remote => {

            if (
                remote.id ===
                currentPlayerId
            ) {
                return;
            }

            if (
                typeof remote.x !==
                "number"
            ) {
                return;
            }

            drawRemotePlayer(
                ctx,
                remote
            );

        });

    ctx.restore();
}


function drawRoads(
    ctx,
    cx,
    cy,
    width,
    height
) {

    const size = 1200;

    const startX =
        Math.floor(
            (cx - width) / 300
        ) * 300;

    const endX =
        Math.ceil(
            (cx + width) / 300
        ) * 300;

    const startY =
        Math.floor(
            (cy - height) / 300
        ) * 300;

    const endY =
        Math.ceil(
            (cy + height) / 300
        ) * 300;

    ctx.fillStyle =
        "#303437";

    for (
        let x = startX;
        x <= endX;
        x += 300
    ) {

        ctx.fillRect(
            x - 55,
            startY - size,
            110,
            size * 3
        );

        ctx.strokeStyle =
            "#eee";

        ctx.lineWidth = 6;

        ctx.setLineDash(
            [35, 30]
        );

        ctx.beginPath();

        ctx.moveTo(
            x,
            startY - size
        );

        ctx.lineTo(
            x,
            endY + size
        );

        ctx.stroke();

    }

    for (
        let y = startY;
        y <= endY;
        y += 300
    ) {

        ctx.fillStyle =
            "#303437";

        ctx.fillRect(
            startX - size,
            y - 55,
            size * 3,
            110
        );

        ctx.strokeStyle =
            "#eee";

        ctx.lineWidth = 6;

        ctx.setLineDash(
            [35, 30]
        );

        ctx.beginPath();

        ctx.moveTo(
            startX - size,
            y
        );

        ctx.lineTo(
            endX + size,
            y
        );

        ctx.stroke();

    }

    ctx.setLineDash([]);

    /*
       Quelques bâtiments.
    */

    ctx.fillStyle =
        "#425148";

    for (
        let x = startX - 150;
        x < endX + 150;
        x += 150
    ) {

        for (
            let y = startY - 150;
            y < endY + 150;
            y += 150
        ) {

            if (
                Math.abs(
                    x % 300
                ) < 100 &&
                Math.abs(
                    y % 300
                ) < 100
            ) {

                ctx.fillRect(
                    x,
                    y,
                    70,
                    70
                );

            }

        }

    }
}


function drawPlayer(ctx) {

    ctx.save();

    ctx.translate(
        player.x,
        player.y
    );

    ctx.rotate(
        player.angle
    );

    if (
        selectedVehicle ===
        "walk"
    ) {

        ctx.fillStyle =
            "#20b98c";

        ctx.beginPath();

        ctx.arc(
            0,
            0,
            17,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.fillStyle =
            "white";

        ctx.fillRect(
            -7,
            -5,
            14,
            18
        );

    } else {

        ctx.fillStyle =
            "#e63e3e";

        ctx.roundRect(
            -22,
            -38,
            44,
            76,
            10
        );

        ctx.fill();

        ctx.fillStyle =
            "#222";

        ctx.fillRect(
            -15,
            -20,
            30,
            22
        );

        ctx.fillStyle =
            "#fff";

        ctx.fillRect(
            -15,
            -31,
            7,
            5
        );

        ctx.fillRect(
            8,
            -31,
            7,
            5
        );

    }

    ctx.restore();
}


function drawRemotePlayer(
    ctx,
    remote
) {

    ctx.save();

    ctx.translate(
        remote.x,
        remote.y
    );

    ctx.fillStyle =
        "#3978ff";

    ctx.beginPath();

    ctx.arc(
        0,
        0,
        16,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.fillStyle =
        "white";

    ctx.font =
        "14px Arial";

    ctx.textAlign =
        "center";

    ctx.fillText(
        remote.name ||
        remote.username ||
        "Joueur",
        0,
        -25
    );

    ctx.restore();
}


/* =========================================================
   GAME LOOP
========================================================= */

function gameLoop(timestamp) {

    if (!gameStarted) {
        return;
    }

    if (!lastFrame) {
        lastFrame = timestamp;
    }

    let dt =
        (timestamp - lastFrame) /
        1000;

    lastFrame = timestamp;

    dt =
        Math.min(
            dt,
            0.05
        );

    updateGame(dt);

    drawGame();

    requestAnimationFrame(
        gameLoop
    );
}


/* =========================================================
   JOYSTICK
========================================================= */

function setupJoystick() {

    const zone =
        $("joystick");

    const stick =
        $("joystickStick");

    if (!zone || !stick) {
        return;
    }

    let pointerId = null;

    function updateJoystick(
        clientX,
        clientY
    ) {

        const rect =
            zone.getBoundingClientRect();

        const centerX =
            rect.left +
            rect.width / 2;

        const centerY =
            rect.top +
            rect.height / 2;

        let dx =
            clientX - centerX;

        let dy =
            clientY - centerY;

        const radius =
            rect.width / 2;

        const distance =
            Math.hypot(dx, dy);

        if (
            distance >
            radius
        ) {

            dx =
                dx / distance *
                radius;

            dy =
                dy / distance *
                radius;

        }

        const normalizedX =
            dx / radius;

        const normalizedY =
            dy / radius;

        joystick.x =
            normalizedX;

        joystick.y =
            normalizedY;

        const stickRadius =
            radius * .52;

        stick.style.transform =
            "translate(" +
            (
                normalizedX *
                stickRadius
            ) +
            "px," +
            (
                normalizedY *
                stickRadius
            ) +
            "px)";
    }

    function resetJoystick() {

        pointerId = null;

        joystick.active =
            false;

        joystick.x = 0;
        joystick.y = 0;

        stick.style.transform =
            "translate(0,0)";
    }

    zone.addEventListener(
        "pointerdown",
        event => {

            event.preventDefault();

            pointerId =
                event.pointerId;

            joystick.active =
                true;

            try {
                zone.setPointerCapture(
                    pointerId
                );
            } catch {}

            updateJoystick(
                event.clientX,
                event.clientY
            );
        }
    );

    zone.addEventListener(
        "pointermove",
        event => {

            if (
                !joystick.active ||
                event.pointerId !==
                pointerId
            ) {
                return;
            }

            event.preventDefault();

            updateJoystick(
                event.clientX,
                event.clientY
            );
        }
    );

    zone.addEventListener(
        "pointerup",
        event => {

            if (
                event.pointerId ===
                pointerId
            ) {
                resetJoystick();
            }

        }
    );

    zone.addEventListener(
        "pointercancel",
        resetJoystick
    );

    zone.addEventListener(
        "lostpointercapture",
        resetJoystick
    );
}


/* =========================================================
   CARTE OPENSTREETMAP
========================================================= */

async function loadLeaflet() {

    if (mapLoaded) return true;

    return new Promise(resolve => {

        if (
            document.getElementById(
                "leafletCSS"
            )
        ) {

            resolve(true);

            return;
        }

        const css =
            document.createElement(
                "link"
            );

        css.id =
            "leafletCSS";

        css.rel =
            "stylesheet";

        css.href =
            "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

        document.head.appendChild(css);

        const script =
            document.createElement(
                "script"
            );

        script.src =
            "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

        script.onload = () => {

            mapLoaded = true;

            resolve(true);

        };

        script.onerror = () => {

            notify(
                "❌ Impossible de charger la carte."
            );

            resolve(false);

        };

        document.body.appendChild(
            script
        );

    });
}


async function openMap() {

    show("mapScreen");

    const loaded =
        await loadLeaflet();

    if (!loaded) return;

    if (!map) {

        map =
            L.map(
                "map",
                {
                    zoomControl: false,
                    touchZoom: true,
                    scrollWheelZoom: true,
                    doubleClickZoom: true
                }
            );

        /*
           OpenStreetMap
        */

        L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                maxZoom: 19,
                attribution:
                    "© OpenStreetMap contributors"
            }
        ).addTo(map);

    }

    setTimeout(() => {

        map.invalidateSize();

        map.setView(
            [
                spawnLocation.lat,
                spawnLocation.lon
            ],
            16
        );

        if (window.spawnMarker) {
            window.spawnMarker.remove();
        }

        window.spawnMarker =
            L.marker([
                spawnLocation.lat,
                spawnLocation.lon
            ])
            .addTo(map)
            .bindPopup(
                "📍 Ton spawn"
            )
            .openPopup();

    }, 100);

}


function closeMap() {
    hide("mapScreen");
}


/* =========================================================
   ZOOM TACTILE
========================================================= */

function setupMapTouch() {

    /*
       Leaflet gère déjà le pinch-to-zoom.
       On ajoute juste une protection pour
       éviter les gestes qui scrollent la page.
    */

    const mapElement =
        $("map");

    if (!mapElement) return;

    mapElement.addEventListener(
        "touchmove",
        event => {

            if (
                event.touches.length >= 2
            ) {
                event.preventDefault();
            }

        },
        {
            passive: false
        }
    );
}


/* =========================================================
   GARAGE
========================================================= */

const VEHICLE_NAMES = {

    walk:
        "🚶 À pied",

    car:
        "🚗 Voiture",

    truck:
        "🚚 Camion",

    bus:
        "🚌 Bus",

    plane:
        "✈️ Avion",

    boat:
        "🚤 Bateau"

};


function renderGarage() {

    const container =
        $("garageVehicles");

    if (!container) return;

    container.innerHTML = "";

    const vehicles =
        currentUser?.vehicles ||
        ["car"];

    vehicles.forEach(vehicle => {

        const button =
            document.createElement(
                "button"
            );

        button.className =
            "vehicleCard";

        if (
            vehicle ===
            selectedVehicle
        ) {

            button.classList.add(
                "selected"
            );

        }

        button.textContent =
            VEHICLE_NAMES[vehicle] ||
            vehicle;

        button.onclick = () => {

            selectedVehicle =
                vehicle;

            setText(
                "selectedVehicleText",
                "Véhicule sélectionné : " +
                (
                    VEHICLE_NAMES[
                        vehicle
                    ] ||
                    vehicle
                )
            );

            renderGarage();

            updateHUD();

        };

        container.appendChild(
            button
        );

    });
}


function useVehicle() {

    updateHUD();

    hide("garageScreen");

    show("mainMenu");

    notify(
        "🚗 Véhicule sélectionné !"
    );
}


/* =========================================================
   SHOP
========================================================= */

function renderShop() {

    const container =
        $("shopVehicles");

    if (!container) return;

    container.innerHTML = "";

    const owned =
        currentUser?.vehicles ||
        ["car"];

    [
        "truck",
        "bus",
        "plane",
        "boat"
    ].forEach(vehicle => {

        const div =
            document.createElement(
                "div"
            );

        div.className =
            "vehicleCard";

        div.textContent =
            VEHICLE_NAMES[vehicle];

        if (
            owned.includes(vehicle)
        ) {

            div.innerHTML +=
                "<p>✅ Possédé</p>";

        } else {

            const button =
                document.createElement(
                    "button"
                );

            button.className =
                "primaryButton";

            button.textContent =
                "Acheter";

            button.onclick = () => {

                if (!connected) {

                    notify(
                        "Serveur indisponible."
                    );

                    return;
                }

                send({

                    type:
                        "buy_vehicle",

                    vehicle

                });

            };

            div.appendChild(
                button
            );

        }

        container.appendChild(
            div
        );

    });
}


/* =========================================================
   HUD
========================================================= */

function updateHUD() {

    setText(
        "hudPlayerName",
        currentUser?.username ||
        "Invité"
    );

    setText(
        "hudVehicle",
        VEHICLE_NAMES[
            selectedVehicle
        ] ||
        selectedVehicle
    );
}


/* =========================================================
   VÉHICULE
========================================================= */

function enterVehicle() {

    if (
        selectedVehicle ===
        "walk"
    ) {

        selectedVehicle =
            "car";

    }

    if (connected) {

        send({

            type:
                "enter_vehicle",

            vehicle:
                selectedVehicle

        });

    }

    updateHUD();
}


function exitVehicle() {

    selectedVehicle =
        "walk";

    if (connected) {

        send({
            type:
                "exit_vehicle"
        });

    }

    updateHUD();
}


/* =========================================================
   AMIS
========================================================= */

function sendFriendRequest() {

    const username =
        $("friendUsernameInput")
            .value.trim();

    if (!username) {

        notify(
            "Entre un pseudo."
        );

        return;
    }

    send({

        type:
            "friend_request",

        username

    });
}


function renderFriends() {

    const requests =
        $("friendRequestsList");

    const friends =
        $("friendsList");

    if (!requests || !friends) {
        return;
    }

    const requestList =
        currentUser?.friendRequests ||
        [];

    const friendList =
        currentUser?.friends ||
        [];

    requests.innerHTML =
        requestList.length
            ? requestList
                .map(
                    r =>
                        "<div class='playerItem'>" +
                        String(r) +
                        "</div>"
                )
                .join("")
            : "<p>Aucune demande.</p>";

    friends.innerHTML =
        friendList.length
            ? friendList
                .map(
                    f =>
                        "<div class='playerItem'>" +
                        String(f) +
                        "</div>"
                )
                .join("")
            : "<p>Tu n'as pas encore d'amis.</p>";
}


/* =========================================================
   PARAMÈTRES
========================================================= */

function saveSettings() {

    if (!currentUser) return;

    const sound =
        $("soundToggle")?.checked ??
        true;

    const music =
        $("musicToggle")?.checked ??
        true;

    currentUser.settings = {
        sound,
        music
    };

    send({

        type:
            "settings_update",

        sound,
        music

    });
}


/* =========================================================
   PSEUDO
========================================================= */

function changeUsername() {

    const username =
        $("newUsernameInput")
            .value.trim();

    if (username.length < 3) {

        usernameMessage(
            "Minimum 3 caractères."
        );

        return;
    }

    send({

        type:
            "change_username",

        username

    });
}


/* =========================================================
   DÉCONNEXION
========================================================= */

function logout() {

    currentUser = null;

    loggedIn = false;

    gameStarted = false;

    currentRoom = null;

    currentPlayerId = null;

    players = {};

    hide("mainMenu");
    hide("gameHud");

    show("authScreen");

    authMessage(
        "Tu es déconnecté."
    );
}


/* =========================================================
   PAUSE
========================================================= */

function openPause() {

    show("pauseScreen");
}


function resumeGame() {

    hide("pauseScreen");

    if (!gameStarted) {
        startGame();
    }
}


function exitGame() {

    gameStarted = false;

    hide("gameHud");
    hide("pauseScreen");

    show("mainMenu");
}


/* =========================================================
   ÉCRANS
========================================================= */

function setupScreens() {

    document
        .querySelectorAll(
            "[data-close]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const id =
                        button.dataset.close;

                    hide(id);

                    show("mainMenu");

                }
            );

        });
}


/* =========================================================
   ÉVÉNEMENTS
========================================================= */

function setupEvents() {

    $("loginButton")
        ?.addEventListener(
            "click",
            loginAccount
        );

    $("registerButton")
        ?.addEventListener(
            "click",
            registerAccount
        );

    $("guestButton")
        ?.addEventListener(
            "click",
            playAsGuest
        );

    $("playButton")
        ?.addEventListener(
            "click",
            startGame
        );

    $("quickMatchButton")
        ?.addEventListener(
            "click",
            () => {

                openMultiplayer();

                quickMatch();

            }
        );

    $("multiplayerButton")
        ?.addEventListener(
            "click",
            openMultiplayer
        );

    $("garageButton")
        ?.addEventListener(
            "click",
            () => {

                hide("mainMenu");

                show("garageScreen");

                renderGarage();

            }
        );

    $("shopButton")
        ?.addEventListener(
            "click",
            () => {

                hide("mainMenu");

                show("shopScreen");

                renderShop();

            }
        );

    $("friendsButton")
        ?.addEventListener(
            "click",
            () => {

                hide("mainMenu");

                show("friendsScreen");

                renderFriends();

            }
        );

    $("settingsButton")
        ?.addEventListener(
            "click",
            () => {

                hide("mainMenu");

                show("settingsScreen");

            }
        );

    $("quickMatchButton2")
        ?.addEventListener(
            "click",
            quickMatch
        );

    $("createRoomButton")
        ?.addEventListener(
            "click",
            createPublicRoom
        );

    $("createPrivateRoomButton")
        ?.addEventListener(
            "click",
            openPrivateRoom
        );

    $("confirmPrivateRoomButton")
        ?.addEventListener(
            "click",
            createPrivateRoom
        );

    $("joinRoomButton")
        ?.addEventListener(
            "click",
            joinRoom
        );

    $("startRoomButton")
        ?.addEventListener(
            "click",
            startGame
        );

    $("leaveRoomButton")
        ?.addEventListener(
            "click",
            leaveRoom
        );

    $("spawnVehicleButton")
        ?.addEventListener(
            "click",
            useVehicle
        );

    $("sendFriendRequestButton")
        ?.addEventListener(
            "click",
            sendFriendRequest
        );

    $("soundToggle")
        ?.addEventListener(
            "change",
            saveSettings
        );

    $("musicToggle")
        ?.addEventListener(
            "change",
            saveSettings
        );

    $("changeUsernameButton")
        ?.addEventListener(
            "click",
            () => {

                hide("settingsScreen");

                show("usernameScreen");

            }
        );

    $("confirmUsernameButton")
        ?.addEventListener(
            "click",
            changeUsername
        );

    $("logoutButton")
        ?.addEventListener(
            "click",
            logout
        );

    $("mapButton")
        ?.addEventListener(
            "click",
            openMap
        );

    $("closeMapButton")
        ?.addEventListener(
            "click",
            closeMap
        );

    $("menuGameButton")
        ?.addEventListener(
            "click",
            openPause
        );

    $("resumeButton")
        ?.addEventListener(
            "click",
            resumeGame
        );

    $("pauseSettingsButton")
        ?.addEventListener(
            "click",
            () => {

                hide("pauseScreen");

                show("settingsScreen");

            }
        );

    $("exitGameButton")
        ?.addEventListener(
            "click",
            exitGame
        );

    $("enterVehicleButton")
        ?.addEventListener(
            "click",
            enterVehicle
        );

    $("exitVehicleButton")
        ?.addEventListener(
            "click",
            exitVehicle
        );

    /*
       RECHERCHE D'ADRESSE
    */

    $("searchAddressButton")
        ?.addEventListener(
            "click",
            searchAddress
        );

    $("addressInput")
        ?.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    searchAddress();

                }

            }
        );

}


/* =========================================================
   CLAVIER
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
            "Enter" &&
            !$("authScreen")
                ?.classList
                .contains("hidden")
        ) {

            loginAccount();

        }

        if (
            event.key ===
            "Escape"
        ) {

            if (
                $("mapScreen") &&
                !$("mapScreen")
                    .classList
                    .contains("hidden")
            ) {

                closeMap();

                return;
            }

            if (gameStarted) {
                openPause();
            }

        }

    }
);


/* =========================================================
   INITIALISATION
========================================================= */

function init() {

    console.log(
        "🚗 RoadGame V5"
    );

    /*
       Tous les écrans cachés
    */

    [
        "authScreen",
        "mainMenu",
        "multiplayerScreen",
        "privateRoomScreen",
        "roomScreen",
        "friendsScreen",
        "garageScreen",
        "shopScreen",
        "settingsScreen",
        "usernameScreen",
        "gameHud",
        "mapScreen",
        "pauseScreen"
    ].forEach(hide);

    show("loadingScreen");

    setupEvents();

    setupScreens();

    setupJoystick();

    setupMapTouch();

    /*
       Chargement local rapide.
    */

    startLoading();

    /*
       Connexion serveur en arrière-plan.
       Elle ne bloque PLUS le chargement.
    */

    setTimeout(
        connectServer,
        200
    );

}


/* =========================================================
   START
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        init
    );

} else {

    init();

}
