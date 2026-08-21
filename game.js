/* =========================================================
   ROADGAME - GAME.JS V3
   WebSocket Render + Auth + Multijoueur + Carte + Véhicules
========================================================= */

"use strict";

/* =========================================================
   CONFIGURATION SERVEUR
========================================================= */

const SERVER_URL =
    "wss://roadgame-server.onrender.com";

const CONNECTION_TIMEOUT = 15000;
const REQUEST_TIMEOUT = 15000;


/* =========================================================
   VARIABLES
========================================================= */

let socket = null;

let connected = false;
let loggedIn = false;

let currentUser = null;
let currentRoom = null;
let currentPlayerId = null;

let selectedVehicle = "car";

let players = {};

let gameStarted = false;

let mapZoom = 1;

let loadingProgress = 0;

let connectionTimer = null;
let requestTimer = null;

let intentionalDisconnect = false;


/* =========================================================
   DOM
========================================================= */

function $(id) {
    return document.getElementById(id);
}

function show(id) {
    const element = $(id);

    if (element) {
        element.classList.remove("hidden");
    }
}

function hide(id) {
    const element = $(id);

    if (element) {
        element.classList.add("hidden");
    }
}

function setText(id, text) {
    const element = $(id);

    if (element) {
        element.textContent = text;
    }
}


/* =========================================================
   NOTIFICATIONS
========================================================= */

function notify(message) {

    const container = $("notifications");

    if (!container) {
        return;
    }

    const notification =
        document.createElement("div");

    notification.className =
        "notification";

    notification.textContent =
        message;

    container.appendChild(notification);

    setTimeout(() => {

        notification.remove();

    }, 4000);
}


/* =========================================================
   MESSAGES
========================================================= */

function authMessage(message, success = false) {

    const element = $("authMessage");

    if (!element) {
        return;
    }

    element.textContent = message;

    element.style.color =
        success
            ? "#35e875"
            : "#ff5555";
}

function multiplayerMessage(message) {

    const element = $("multiplayerMessage");

    if (element) {
        element.textContent = message;
    }
}

function privateMessage(message) {

    const element = $("privateRoomMessage");

    if (element) {
        element.textContent = message;
    }
}

function usernameMessage(message) {

    const element = $("usernameMessage");

    if (element) {
        element.textContent = message;
    }
}


/* =========================================================
   TIMEOUT REQUÊTE
========================================================= */

function startRequestTimeout(message) {

    clearTimeout(requestTimer);

    requestTimer = setTimeout(() => {

        requestTimer = null;

        authMessage(
            message ||
            "Le serveur met trop de temps à répondre."
        );

    }, REQUEST_TIMEOUT);
}

function clearRequestTimeout() {

    clearTimeout(requestTimer);

    requestTimer = null;
}


/* =========================================================
   CONNEXION SERVEUR
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

    intentionalDisconnect = false;

    setLoadingProgress(90);

    setLoadingText(
        "Connexion au serveur..."
    );

    try {

        socket =
            new WebSocket(
                SERVER_URL
            );

    } catch (error) {

        console.error(error);

        connectionFailed(
            "Impossible de contacter le serveur."
        );

        return;
    }

    clearTimeout(connectionTimer);

    connectionTimer =
        setTimeout(() => {

            if (
                !connected
            ) {

                console.error(
                    "⏱️ Timeout WebSocket"
                );

                try {
                    socket.close();
                } catch {}

                connectionFailed(
                    "Le serveur met trop de temps à répondre."
                );
            }

        }, CONNECTION_TIMEOUT);


    socket.addEventListener(
        "open",
        () => {

            clearTimeout(
                connectionTimer
            );

            connected = true;

            console.log(
                "🟢 WebSocket connecté"
            );

            setLoadingProgress(100);

            setLoadingText(
                "Serveur connecté !"
            );

            setTimeout(() => {

                hide("loadingScreen");

                if (!loggedIn) {
                    show("authScreen");
                }

            }, 500);
        }
    );


    socket.addEventListener(
        "message",
        event => {

            let data;

            try {

                data =
                    JSON.parse(
                        event.data
                    );

            } catch (error) {

                console.error(
                    "Message serveur invalide :",
                    event.data
                );

                return;
            }

            console.log(
                "📩 Serveur :",
                data
            );

            handleServerMessage(data);
        }
    );


    socket.addEventListener(
        "error",
        error => {

            console.error(
                "❌ WebSocket error",
                error
            );

            connected = false;

        }
    );


    socket.addEventListener(
        "close",
        () => {

            clearTimeout(
                connectionTimer
            );

            connected = false;

            console.log(
                "🔴 WebSocket déconnecté"
            );

            if (
                !intentionalDisconnect &&
                !gameStarted
            ) {

                authMessage(
                    "Connexion au serveur perdue."
                );
            }
        }
    );
}


/* =========================================================
   ERREUR CONNEXION
========================================================= */

function connectionFailed(message) {

    clearTimeout(connectionTimer);

    connected = false;

    setLoadingProgress(100);

    setLoadingText(
        "❌ " + message
    );

    setTimeout(() => {

        hide("loadingScreen");

        show("authScreen");

        authMessage(message);

    }, 700);
}


/* =========================================================
   ENVOI SERVEUR
========================================================= */

function send(data) {

    if (!socket) {

        console.error(
            "WebSocket inexistant"
        );

        return false;
    }

    if (
        socket.readyState !==
        WebSocket.OPEN
    ) {

        console.error(
            "WebSocket non connecté"
        );

        return false;
    }

    console.log(
        "📤 Envoi :",
        data
    );

    socket.send(
        JSON.stringify(data)
    );

    return true;
}


/* =========================================================
   RÉCEPTION SERVEUR
========================================================= */

function handleServerMessage(data) {

    switch (data.type) {

        case "connected":

            console.log(
                "✅ RoadGame prêt"
            );

            break;


        case "account_created":

            clearRequestTimeout();

            handleAccountCreated(
                data.user
            );

            break;


        case "login_success":

            clearRequestTimeout();

            handleLoginSuccess(
                data.user
            );

            break;


        case "error":

            clearRequestTimeout();

            handleServerError(
                data.message
            );

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

            handleRoomCreated(data);

            break;


        case "private_room_created":

            privateMessage(
                "Serveur créé ! Code : " +
                data.room
            );

            break;


        case "room_joined":

            handleRoomJoined(data);

            break;


        case "quick_match_found":

            handleQuickMatch(data);

            break;


        case "quick_match_searching":

            multiplayerMessage(
                "Recherche d'une partie..."
            );

            break;


        case "player_joined":

            addPlayer(
                data.player
            );

            refreshPlayersList();

            break;


        case "player_left":

            delete players[
                data.playerId
            ];

            refreshPlayersList();

            break;


        case "player_update":

            updateRemotePlayer(
                data.player
            );

            break;


        case "vehicle_update":

            updateRemoteVehicle(data);

            break;


        case "vehicle_enter":

            updateRemoteVehicle(data);

            break;


        case "vehicle_exit":

            updateRemoteVehicle(data);

            break;


        case "vehicle_purchased":

            clearRequestTimeout();

            if (currentUser) {

                currentUser.vehicles =
                    data.vehicles;
            }

            notify(
                "🚗 Véhicule acheté !"
            );

            renderGarage();

            renderShop();

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

            if (currentUser) {

                currentUser =
                    data.user;
            }

            renderFriends();

            break;


        default:

            console.log(
                "Type serveur non géré :",
                data.type
            );
    }
}


/* =========================================================
   ERREURS
========================================================= */

function handleServerError(message) {

    console.error(
        "❌ Serveur :",
        message
    );

    if (
        $("authScreen") &&
        !$("authScreen")
            .classList
            .contains("hidden")
    ) {

        authMessage(message);

        return;
    }

    if (
        $("multiplayerScreen") &&
        !$("multiplayerScreen")
            .classList
            .contains("hidden")
    ) {

        multiplayerMessage(message);

        return;
    }

    if (
        $("privateRoomScreen") &&
        !$("privateRoomScreen")
            .classList
            .contains("hidden")
    ) {

        privateMessage(message);

        return;
    }

    if (
        $("usernameScreen") &&
        !$("usernameScreen")
            .classList
            .contains("hidden")
    ) {

        usernameMessage(message);

        return;
    }

    notify(
        "❌ " + message
    );
}


/* =========================================================
   COMPTE
========================================================= */

function handleAccountCreated(user) {

    currentUser = user;

    loggedIn = true;

    selectedVehicle =
        user.selectedVehicle ||
        "car";

    authMessage(
        "Compte créé avec succès !",
        true
    );

    setTimeout(
        openMainMenu,
        300
    );
}


/* =========================================================
   LOGIN
========================================================= */

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

    setTimeout(
        openMainMenu,
        300
    );
}


/* =========================================================
   MENU
========================================================= */

function openMainMenu() {

    hide("authScreen");
    hide("loadingScreen");
    hide("multiplayerScreen");
    hide("privateRoomScreen");
    hide("roomScreen");
    hide("friendsScreen");
    hide("garageScreen");
    hide("shopScreen");
    hide("settingsScreen");
    hide("usernameScreen");
    hide("mapScreen");
    hide("pauseScreen");

    show("mainMenu");

    const name =
        currentUser
            ? currentUser.username
            : "Joueur";

    setText(
        "welcomeText",
        "Bienvenue " + name
    );

    renderGarage();
    renderShop();
    renderFriends();
}


/* =========================================================
   INSCRIPTION
========================================================= */

function registerAccount() {

    if (!connected) {

        authMessage(
            "❌ Serveur non connecté."
        );

        return;
    }

    const username =
        $("usernameInput")
            ?.value
            .trim();

    const password =
        $("passwordInput")
            ?.value || "";

    if (!username) {

        authMessage(
            "Entre un pseudo."
        );

        return;
    }

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

    const sent =
        send({
            type: "register",
            username,
            password
        });

    if (!sent) {

        authMessage(
            "❌ Impossible d'envoyer la demande."
        );

        return;
    }

    startRequestTimeout(
        "Le serveur ne répond pas. Il est peut-être en train de se réveiller..."
    );
}


/* =========================================================
   CONNEXION
========================================================= */

function loginAccount() {

    if (!connected) {

        authMessage(
            "❌ Serveur non connecté."
        );

        return;
    }

    const username =
        $("usernameInput")
            ?.value
            .trim();

    const password =
        $("passwordInput")
            ?.value || "";

    if (!username) {

        authMessage(
            "Entre ton pseudo."
        );

        return;
    }

    if (!password) {

        authMessage(
            "Entre ton mot de passe."
        );

        return;
    }

    authMessage(
        "Connexion..."
    );

    const sent =
        send({
            type: "login",
            username,
            password
        });

    if (!sent) {

        authMessage(
            "❌ Impossible d'envoyer la demande."
        );

        return;
    }

    startRequestTimeout(
        "Le serveur ne répond pas. Vérifie ta connexion."
    );
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
            "❌ Serveur non connecté."
        );

        return;
    }

    send({
        type: "create_room",

        vehicle:
            selectedVehicle
    });
}


function openPrivateRoom() {

    hide("multiplayerScreen");

    show("privateRoomScreen");

    privateMessage("");
}


function createPrivateRoom() {

    if (!connected) {

        privateMessage(
            "❌ Serveur non connecté."
        );

        return;
    }

    const password =
        $("privatePasswordInput")
            ?.value || "";

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

    if (!connected) {

        multiplayerMessage(
            "❌ Serveur non connecté."
        );

        return;
    }

    const code =
        $("roomCodeInput")
            ?.value
            .trim()
            .toUpperCase();

    const password =
        $("roomPasswordInput")
            ?.value || "";

    if (code.length !== 6) {

        multiplayerMessage(
            "Le code doit contenir 6 caractères."
        );

        return;
    }

    send({
        type: "join_room",

        room: code,

        password,

        vehicle:
            selectedVehicle
    });
}


function quickMatch() {

    if (!connected) {

        multiplayerMessage(
            "❌ Serveur non connecté."
        );

        return;
    }

    multiplayerMessage(
        "Recherche..."
    );

    send({
        type: "quick_match",

        vehicle:
            selectedVehicle
    });
}


/* =========================================================
   ROOMS
========================================================= */

function handleRoomCreated(data) {

    currentRoom =
        data.room;

    currentPlayerId =
        data.playerId;

    players = {};

    (data.players || [])
        .forEach(player => {

            players[player.id] =
                player;

        });

    hide("multiplayerScreen");
    hide("privateRoomScreen");

    show("roomScreen");

    setText(
        "currentRoomCode",
        currentRoom
    );

    refreshPlayersList();
}


function handleRoomJoined(data) {

    currentRoom =
        data.room;

    currentPlayerId =
        data.playerId;

    players = {};

    (data.players || [])
        .forEach(player => {

            players[player.id] =
                player;

        });

    hide("multiplayerScreen");

    show("roomScreen");

    setText(
        "currentRoomCode",
        currentRoom
    );

    refreshPlayersList();
}


function handleQuickMatch(data) {

    currentRoom =
        data.room;

    currentPlayerId =
        data.playerId;

    players = {};

    (data.players || [])
        .forEach(player => {

            players[player.id] =
                player;

        });

    hide("multiplayerScreen");

    show("roomScreen");

    setText(
        "currentRoomCode",
        currentRoom
    );

    refreshPlayersList();

    notify(
        "⚡ Partie trouvée !"
    );
}


/* =========================================================
   JOUEURS
========================================================= */

function addPlayer(player) {

    if (!player) {
        return;
    }

    players[player.id] =
        player;
}


function updateRemotePlayer(player) {

    if (!player) {
        return;
    }

    players[player.id] =
        player;

    refreshPlayersList();
}


function updateRemoteVehicle(data) {

    if (!players[data.playerId]) {
        return;
    }

    players[data.playerId].vehicle =
        data.vehicle;

    players[data.playerId].inVehicle =
        data.inVehicle;

    refreshPlayersList();
}


function refreshPlayersList() {

    const list =
        $("playersList");

    if (!list) {
        return;
    }

    list.innerHTML = "";

    Object.values(players)
        .forEach(player => {

            const div =
                document.createElement(
                    "div"
                );

            div.className =
                "playerItem";

            const vehicle =
                player.inVehicle
                    ? "🚗 " + player.vehicle
                    : "🚶 À pied";

            div.textContent =
                player.name +
                " — " +
                vehicle;

            list.appendChild(div);
        });
}


/* =========================================================
   QUITTER ROOM
========================================================= */

function leaveRoom() {

    intentionalDisconnect = true;

    if (socket) {

        try {
            socket.close();
        } catch {}

    }

    currentRoom = null;

    currentPlayerId = null;

    players = {};

    connected = false;

    setTimeout(() => {

        intentionalDisconnect = false;

        connectServer();

    }, 500);

    hide("roomScreen");

    show("mainMenu");
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

    notify(
        "🚗 Bienvenue dans RoadGame !"
    );

    updateHUD();
}


function updateHUD() {

    const name =
        currentUser
            ? currentUser.username
            : "Invité";

    setText(
        "hudPlayerName",
        name
    );

    setText(
        "hudVehicle",
        selectedVehicle === "walk"
            ? "À pied"
            : selectedVehicle
    );
}


/* =========================================================
   VÉHICULES
========================================================= */

const VEHICLE_NAMES = {

    walk: "🚶 À pied",

    car: "🚗 Voiture",

    truck: "🚚 Camion",

    bus: "🚌 Bus",

    plane: "✈️ Avion",

    boat: "🚤 Bateau"
};


function renderGarage() {

    const container =
        $("garageVehicles");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const vehicles =
        currentUser
            ? currentUser.vehicles || ["car"]
            : ["car"];

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

        button.onclick =
            () => {

                selectedVehicle =
                    vehicle;

                setText(
                    "selectedVehicleText",
                    "Véhicule sélectionné : " +
                    (
                        VEHICLE_NAMES[vehicle] ||
                        vehicle
                    )
                );

                renderGarage();
            };

        container.appendChild(
            button
        );
    });
}


function useVehicle() {

    updateHUD();

    notify(
        "🚗 Véhicule sélectionné !"
    );

    hide("garageScreen");

    show("mainMenu");
}


function renderShop() {

    const container =
        $("shopVehicles");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const owned =
        currentUser
            ? currentUser.vehicles || ["car"]
            : ["car"];

    const shopVehicles = [
        "truck",
        "bus",
        "plane",
        "boat"
    ];

    shopVehicles.forEach(vehicle => {

        const div =
            document.createElement(
                "div"
            );

        div.className =
            "vehicleCard";

        const title =
            document.createElement(
                "div"
            );

        title.textContent =
            VEHICLE_NAMES[vehicle];

        div.appendChild(title);

        if (
            owned.includes(vehicle)
        ) {

            const text =
                document.createElement(
                    "p"
                );

            text.textContent =
                "✅ Possédé";

            div.appendChild(text);

        } else {

            const button =
                document.createElement(
                    "button"
                );

            button.className =
                "primaryButton";

            button.textContent =
                "Acheter";

            button.onclick =
                () => {

                    if (!connected) {

                        notify(
                            "❌ Serveur non connecté."
                        );

                        return;
                    }

                    send({
                        type:
                            "buy_vehicle",

                        vehicle
                    });

                };

            div.appendChild(button);
        }

        container.appendChild(div);
    });
}


/* =========================================================
   AMIS
========================================================= */

function sendFriendRequest() {

    const username =
        $("friendUsernameInput")
            ?.value
            .trim();

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

    const requestList =
        $("friendRequestsList");

    const friendList =
        $("friendsList");

    if (!currentUser) {
        return;
    }

    if (requestList) {

        requestList.innerHTML =
            "<p class='emptyText'>Aucune demande.</p>";
    }

    if (friendList) {

        friendList.innerHTML =
            "<p class='emptyText'>Tu n'as pas encore d'amis.</p>";
    }
}


/* =========================================================
   PARAMÈTRES
========================================================= */

function saveSettings() {

    if (!currentUser) {
        return;
    }

    const sound =
        $("soundToggle")
            ? $("soundToggle").checked
            : true;

    const music =
        $("musicToggle")
            ? $("musicToggle").checked
            : true;

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
            ?.value
            .trim();

    if (!username) {

        usernameMessage(
            "Entre un pseudo."
        );

        return;
    }

    if (username.length < 3) {

        usernameMessage(
            "Le pseudo doit contenir au moins 3 caractères."
        );

        return;
    }

    if (!connected) {

        usernameMessage(
            "Serveur non connecté."
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

    clearRequestTimeout();

    currentUser = null;

    loggedIn = false;

    currentRoom = null;

    currentPlayerId = null;

    players = {};

    gameStarted = false;

    hide("mainMenu");
    hide("settingsScreen");
    hide("gameHud");

    show("authScreen");

    if ($("usernameInput")) {
        $("usernameInput").value = "";
    }

    if ($("passwordInput")) {
        $("passwordInput").value = "";
    }

    authMessage(
        "Tu es déconnecté."
    );
}


/* =========================================================
   CARTE
========================================================= */

function openMap() {

    show("mapScreen");

    drawMap();
}


function closeMap() {

    hide("mapScreen");
}


function drawMap() {

    const canvas =
        $("mapCanvas");

    if (!canvas) {
        return;
    }

    const ctx =
        canvas.getContext("2d");

    canvas.width =
        window.innerWidth;

    canvas.height =
        window.innerHeight;

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.save();

    ctx.translate(
        canvas.width / 2,
        canvas.height / 2
    );

    ctx.scale(
        mapZoom,
        mapZoom
    );

    ctx.strokeStyle = "#555";

    ctx.lineWidth = 20;

    for (
        let x = -1000;
        x <= 1000;
        x += 200
    ) {

        ctx.beginPath();

        ctx.moveTo(x, -1000);
        ctx.lineTo(x, 1000);

        ctx.stroke();
    }

    for (
        let y = -1000;
        y <= 1000;
        y += 200
    ) {

        ctx.beginPath();

        ctx.moveTo(-1000, y);
        ctx.lineTo(1000, y);

        ctx.stroke();
    }

    ctx.fillStyle = "#ff3333";

    ctx.beginPath();

    ctx.arc(
        0,
        0,
        12,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.restore();
}


function zoomMap(amount) {

    mapZoom += amount;

    mapZoom =
        Math.max(
            0.5,
            Math.min(
                4,
                mapZoom
            )
        );

    drawMap();
}


/* =========================================================
   PAUSE
========================================================= */

function openPause() {

    show("pauseScreen");
}


function resumeGame() {

    hide("pauseScreen");
}


function exitGame() {

    gameStarted = false;

    hide("gameHud");
    hide("pauseScreen");

    show("mainMenu");
}


/* =========================================================
   VÉHICULE
========================================================= */

function enterVehicle() {

    selectedVehicle =
        selectedVehicle === "walk"
            ? "car"
            : selectedVehicle;

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
   JOYSTICK
========================================================= */

function setupJoystick() {

    const joystick =
        $("joystick");

    const stick =
        $("joystickStick");

    if (!joystick || !stick) {
        return;
    }

    let active = false;

    function move(clientX, clientY) {

        const rect =
            joystick.getBoundingClientRect();

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

        const max =
            rect.width / 2;

        const distance =
            Math.sqrt(
                dx * dx +
                dy * dy
            );

        if (distance > max) {

            dx =
                dx / distance * max;

            dy =
                dy / distance * max;
        }

        stick.style.transform =
            `translate(${dx}px, ${dy}px)`;
    }

    function reset() {

        active = false;

        stick.style.transform =
            "translate(0, 0)";
    }

    joystick.addEventListener(
        "pointerdown",
        event => {

            active = true;

            joystick.setPointerCapture(
                event.pointerId
            );

            move(
                event.clientX,
                event.clientY
            );
        }
    );

    joystick.addEventListener(
        "pointermove",
        event => {

            if (!active) {
                return;
            }

            move(
                event.clientX,
                event.clientY
            );
        }
    );

    joystick.addEventListener(
        "pointerup",
        reset
    );

    joystick.addEventListener(
        "pointercancel",
        reset
    );
}


/* =========================================================
   CONTRÔLES
========================================================= */

function setupDriveControls() {

    const buttons = [

        $("accelerateButton"),
        $("brakeButton"),
        $("leftButton"),
        $("rightButton")

    ];

    buttons.forEach(button => {

        if (!button) {
            return;
        }

        button.addEventListener(
            "pointerdown",
            () => {

                button.classList.add(
                    "active"
                );
            }
        );

        button.addEventListener(
            "pointerup",
            () => {

                button.classList.remove(
                    "active"
                );
            }
        );

        button.addEventListener(
            "pointercancel",
            () => {

                button.classList.remove(
                    "active"
                );
            }
        );

        button.addEventListener(
            "pointerleave",
            () => {

                button.classList.remove(
                    "active"
                );
            }
        );
    });
}


/* =========================================================
   LOADING
========================================================= */

function setLoadingProgress(value) {

    loadingProgress =
        Math.max(
            0,
            Math.min(
                100,
                value
            )
        );

    const text =
        $("loadingText");

    if (text) {

        text.textContent =
            "Chargement... " +
            Math.round(
                loadingProgress
            ) +
            "%";
    }
}


function setLoadingText(text) {

    const element =
        $("loadingText");

    if (element) {

        element.textContent =
            text;
    }
}


function loadingAnimation() {

    let progress = 5;

    const interval =
        setInterval(() => {

            if (connected) {

                clearInterval(interval);

                return;
            }

            progress +=
                Math.random() * 8;

            progress =
                Math.min(
                    88,
                    progress
                );

            setLoadingProgress(
                progress
            );

        }, 150);
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

                    if (
                        id ===
                        "multiplayerScreen"
                    ) {
                        show("mainMenu");
                    }

                    if (
                        id ===
                        "friendsScreen"
                    ) {
                        show("mainMenu");
                    }

                    if (
                        id ===
                        "garageScreen"
                    ) {
                        show("mainMenu");
                    }

                    if (
                        id ===
                        "shopScreen"
                    ) {
                        show("mainMenu");
                    }

                    if (
                        id ===
                        "settingsScreen"
                    ) {
                        show("mainMenu");
                    }

                    if (
                        id ===
                        "usernameScreen"
                    ) {
                        show("settingsScreen");
                    }

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


    $("mapZoomIn")
        ?.addEventListener(
            "click",
            () => zoomMap(0.25)
        );


    $("mapZoomOut")
        ?.addEventListener(
            "click",
            () => zoomMap(-0.25)
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
}


/* =========================================================
   ZOOM TACTILE CARTE
========================================================= */

function setupMapTouch() {

    const canvas =
        $("mapCanvas");

    if (!canvas) {
        return;
    }

    let startDistance = null;

    canvas.addEventListener(
        "touchstart",
        event => {

            if (
                event.touches.length === 2
            ) {

                const a =
                    event.touches[0];

                const b =
                    event.touches[1];

                startDistance =
                    Math.hypot(
                        a.clientX -
                        b.clientX,

                        a.clientY -
                        b.clientY
                    );
            }

        },
        {
            passive: true
        }
    );


    canvas.addEventListener(
        "touchmove",
        event => {

            if (
                event.touches.length !== 2 ||
                startDistance === null
            ) {
                return;
            }

            const a =
                event.touches[0];

            const b =
                event.touches[1];

            const distance =
                Math.hypot(
                    a.clientX -
                    b.clientX,

                    a.clientY -
                    b.clientY
                );

            const difference =
                distance -
                startDistance;

            if (
                Math.abs(difference) > 10
            ) {

                mapZoom +=
                    difference > 0
                        ? 0.05
                        : -0.05;

                mapZoom =
                    Math.max(
                        0.5,
                        Math.min(
                            4,
                            mapZoom
                        )
                    );

                startDistance =
                    distance;

                drawMap();
            }

        },
        {
            passive: true
        }
    );


    canvas.addEventListener(
        "touchend",
        () => {

            startDistance = null;

        },
        {
            passive: true
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
            event.key === "Enter" &&
            $("authScreen") &&
            !$("authScreen")
                .classList
                .contains("hidden")
        ) {

            loginAccount();
        }


        if (
            event.key === "Escape"
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
        "🚗 RoadGame V3 démarrage..."
    );

    console.log(
        "📡 Serveur :",
        SERVER_URL
    );

    hide("authScreen");
    hide("mainMenu");
    hide("multiplayerScreen");
    hide("privateRoomScreen");
    hide("roomScreen");
    hide("friendsScreen");
    hide("garageScreen");
    hide("shopScreen");
    hide("settingsScreen");
    hide("usernameScreen");
    hide("gameHud");
    hide("mapScreen");
    hide("pauseScreen");

    show("loadingScreen");

    setLoadingProgress(5);

    setLoadingText(
        "Chargement de RoadGame..."
    );

    setupEvents();

    setupScreens();

    setupJoystick();

    setupDriveControls();

    setupMapTouch();

    loadingAnimation();

    setTimeout(() => {

        setLoadingProgress(30);

        setLoadingText(
            "Connexion au serveur..."
        );

        connectServer();

    }, 300);
}


/* =========================================================
   LANCEMENT
========================================================= */

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        init
    );

} else {

    init();
}
