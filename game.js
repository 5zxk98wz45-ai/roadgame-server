/* =========================================================
   ROADGAME - GAME.JS V5
   Comptes + Multijoueur + OpenStreetMap
   Adresse -> coordonnées -> Spawn
   Carte + zoom tactile
========================================================= */

"use strict";

/* =========================================================
   SERVEUR
========================================================= */

const SERVER_URL = "wss://roadgame-server.onrender.com";


/* =========================================================
   VARIABLES
========================================================= */

let socket = null;

let connected = false;
let loggedIn = false;
let connecting = false;

let currentUser = null;
let currentRoom = null;
let currentPlayerId = null;

let selectedVehicle = "car";

let players = {};

let gameStarted = false;

let mapZoom = 1;

let mapLatitude = 48.8566;
let mapLongitude = 2.3522;

let spawnLatitude = 48.8566;
let spawnLongitude = 2.3522;

let addressMarker = null;

let loadingProgress = 0;

let reconnectTimer = null;


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
        console.log("🔔", message);
        return;
    }

    const notification =
        document.createElement("div");

    notification.className = "notification";

    notification.textContent = message;

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

function addressMessage(message, success = false) {

    const element =
        $("addressMessage") ||
        $("spawnMessage");

    if (!element) {
        return;
    }

    element.textContent = message;

    element.style.color =
        success
            ? "#35e875"
            : "#ff5555";
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

    const element = $("loadingText");

    if (element) {

        element.textContent =
            "Chargement... " +
            Math.round(loadingProgress) +
            "%";
    }

    const progressBar =
        $("loadingProgress");

    if (progressBar) {
        progressBar.style.width =
            loadingProgress + "%";
    }
}

function setLoadingText(text) {

    const element = $("loadingText");

    if (element) {
        element.textContent = text;
    }
}


/* =========================================================
   WEBSOCKET
========================================================= */

function connectServer() {

    if (connecting) {
        return;
    }

    if (
        socket &&
        (
            socket.readyState === WebSocket.OPEN ||
            socket.readyState === WebSocket.CONNECTING
        )
    ) {
        return;
    }

    connecting = true;

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

        connecting = false;

        connected = false;

        finishLoadingWithoutServer();

        return;
    }


    /* =========================
       OUVERT
    ========================= */

    socket.addEventListener(
        "open",
        () => {

            console.log(
                "🟢 WebSocket connecté"
            );

            connecting = false;
            connected = true;

            setLoadingProgress(100);

            setLoadingText(
                "Serveur connecté !"
            );

            setTimeout(() => {

                hide("loadingScreen");

                if (!loggedIn) {
                    show("authScreen");
                }

            }, 300);
        }
    );


    /* =========================
       MESSAGE
    ========================= */

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
                    "Message invalide :",
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


    /* =========================
       FERMÉ
    ========================= */

    socket.addEventListener(
        "close",
        () => {

            connecting = false;
            connected = false;

            console.log(
                "🔴 Serveur déconnecté"
            );

            if (!gameStarted) {

                authMessage(
                    "Serveur déconnecté. Réessaie dans quelques secondes."
                );

            }

            scheduleReconnect();
        }
    );


    /* =========================
       ERREUR
    ========================= */

    socket.addEventListener(
        "error",
        error => {

            console.error(
                "❌ WebSocket error",
                error
            );

            connecting = false;
            connected = false;

            if (!gameStarted) {

                authMessage(
                    "Le serveur ne répond pas encore."
                );
            }
        }
    );


    /*
       IMPORTANT :

       On ne bloque plus le chargement
       indéfiniment en attendant Render.
    */

    setTimeout(() => {

        if (!connected) {

            console.log(
                "⚠️ Le serveur prend du temps à répondre."
            );

            finishLoadingWithoutServer();

        }

    }, 10000);
}


/* =========================================================
   CHARGEMENT SANS SERVEUR
========================================================= */

function finishLoadingWithoutServer() {

    hide("loadingScreen");

    if (!loggedIn) {
        show("authScreen");
    }

    setLoadingProgress(100);

    setLoadingText(
        "Serveur en attente..."
    );

    authMessage(
        "Le serveur met du temps à répondre. Tu peux réessayer."
    );
}


/* =========================================================
   RECONNEXION
========================================================= */

function scheduleReconnect() {

    if (reconnectTimer) {
        return;
    }

    reconnectTimer =
        setTimeout(() => {

            reconnectTimer = null;

            if (!connected) {
                connectServer();
            }

        }, 5000);
}


/* =========================================================
   ENVOYER
========================================================= */

function send(data) {

    if (
        !socket ||
        socket.readyState !== WebSocket.OPEN
    ) {

        console.warn(
            "⚠️ Serveur non connecté",
            data
        );

        return false;
    }

    socket.send(
        JSON.stringify(data)
    );

    return true;
}


/* =========================================================
   RÉCEPTION
========================================================= */

function handleServerMessage(data) {

    switch (data.type) {

        case "connected":
            console.log(
                "✅ RoadGame Server prêt"
            );
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


        case "quick_match_searching":

            multiplayerMessage(
                "Recherche d'une partie..."
            );

            break;


        case "quick_match_found":
            handleQuickMatch(data);
            break;


        case "player_joined":

            addPlayer(data.player);

            refreshPlayersList();

            notify(
                "👤 " +
                data.player.name +
                " a rejoint la partie."
            );

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
                currentUser = data.user;
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
   ERREUR
========================================================= */

function handleServerError(message) {

    console.error(
        "❌ Serveur :",
        message
    );

    if (
        $("authScreen") &&
        !$("authScreen").classList.contains("hidden")
    ) {

        authMessage(message);
        return;
    }

    if (
        $("multiplayerScreen") &&
        !$("multiplayerScreen").classList.contains("hidden")
    ) {

        multiplayerMessage(message);
        return;
    }

    if (
        $("privateRoomScreen") &&
        !$("privateRoomScreen").classList.contains("hidden")
    ) {

        privateMessage(message);
        return;
    }

    if (
        $("usernameScreen") &&
        !$("usernameScreen").classList.contains("hidden")
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
        user.selectedVehicle || "car";

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
        user.selectedVehicle || "car";

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
   AUTH
========================================================= */

function registerAccount() {

    if (!connected) {

        authMessage(
            "❌ Le serveur n'est pas connecté. Attends quelques secondes puis réessaie."
        );

        connectServer();

        return;
    }

    const username =
        $("usernameInput")
            ?.value
            ?.trim() || "";

    const password =
        $("passwordInput")
            ?.value || "";

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
            "❌ Le serveur n'est pas connecté."
        );

        connectServer();

        return;
    }

    const username =
        $("usernameInput")
            ?.value
            ?.trim() || "";

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

    send({
        type: "login",
        username,
        password
    });
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

        vehicles: ["car"],

        selectedVehicle: "car",

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

    hide("loadingScreen");
    hide("authScreen");
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
    hide("gameHud");

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
    updateHUD();
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
            "Serveur non connecté."
        );

        connectServer();

        return;
    }

    send({
        type: "create_room",

        vehicle:
            selectedVehicle,

        latitude:
            spawnLatitude,

        longitude:
            spawnLongitude
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
            "Serveur non connecté."
        );

        connectServer();

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
            selectedVehicle,

        latitude:
            spawnLatitude,

        longitude:
            spawnLongitude
    });
}


function joinRoom() {

    if (!connected) {

        multiplayerMessage(
            "Serveur non connecté."
        );

        connectServer();

        return;
    }

    const code =
        $("roomCodeInput")
            ?.value
            ?.trim()
            ?.toUpperCase() || "";

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
            selectedVehicle,

        latitude:
            spawnLatitude,

        longitude:
            spawnLongitude
    });
}


function quickMatch() {

    if (!connected) {

        multiplayerMessage(
            "Serveur non connecté."
        );

        connectServer();

        return;
    }

    multiplayerMessage(
        "Recherche..."
    );

    send({
        type: "quick_match",

        vehicle:
            selectedVehicle,

        latitude:
            spawnLatitude,

        longitude:
            spawnLongitude
    });
}


/* =========================================================
   ROOM
========================================================= */

function handleRoomCreated(data) {

    currentRoom =
        data.room;

    currentPlayerId =
        data.playerId;

    players = {};

    (data.players || [])
        .forEach(player => {
            players[player.id] = player;
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
            players[player.id] = player;
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
            players[player.id] = player;
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
                document.createElement("div");

            div.className =
                "playerItem";

            const vehicle =
                player.inVehicle
                    ? "🚗 " +
                      player.vehicle
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

    if (socket) {
        socket.close();
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

    updateHUD();

    drawMap();

    notify(
        "🚗 Bienvenue dans RoadGame !"
    );
}


/* =========================================================
   HUD
========================================================= */

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
            : (
                VEHICLE_NAMES[
                    selectedVehicle
                ] ||
                selectedVehicle
            )
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
            document.createElement("button");

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

        container.appendChild(button);
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

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const owned =
        currentUser
            ? currentUser.vehicles || ["car"]
            : ["car"];

    [
        "truck",
        "bus",
        "plane",
        "boat"
    ].forEach(vehicle => {

        const div =
            document.createElement("div");

        div.className =
            "vehicleCard";

        const title =
            document.createElement("div");

        title.textContent =
            VEHICLE_NAMES[vehicle];

        div.appendChild(title);

        if (owned.includes(vehicle)) {

            const text =
                document.createElement("p");

            text.textContent =
                "✅ Possédé";

            div.appendChild(text);

        } else {

            const button =
                document.createElement("button");

            button.className =
                "primaryButton";

            button.textContent =
                "Acheter";

            button.onclick = () => {

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

    const input =
        $("friendUsernameInput");

    const username =
        input?.value?.trim() || "";

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

    if (!currentUser) {
        return;
    }

    const requestList =
        $("friendRequestsList");

    const friendList =
        $("friendsList");

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
            ?.trim() || "";

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

    currentUser = null;

    loggedIn = false;

    currentRoom = null;

    currentPlayerId = null;

    players = {};

    gameStarted = false;

    hide("mainMenu");
    hide("gameHud");
    hide("settingsScreen");

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
   OPENSTREETMAP
========================================================= */

async function searchAddress() {

    const input =
        $("addressInput") ||
        $("spawnAddressInput") ||
        $("cityInput");

    if (!input) {

        addressMessage(
            "La barre d'adresse n'existe pas dans index.html."
        );

        return;
    }

    const query =
        input.value.trim();

    if (!query) {

        addressMessage(
            "Entre une adresse ou une ville."
        );

        return;
    }

    addressMessage(
        "🔎 Recherche de l'adresse..."
    );

    try {

        const url =
            "https://nominatim.openstreetmap.org/search" +
            "?format=jsonv2" +
            "&limit=1" +
            "&q=" +
            encodeURIComponent(query);

        const response =
            await fetch(
                url,
                {
                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );

        if (!response.ok) {
            throw new Error(
                "Erreur Nominatim"
            );
        }

        const results =
            await response.json();

        if (
            !Array.isArray(results) ||
            results.length === 0
        ) {

            addressMessage(
                "❌ Adresse introuvable."
            );

            return;
        }

        const result =
            results[0];

        const latitude =
            Number(result.lat);

        const longitude =
            Number(result.lon);

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {

            addressMessage(
                "❌ Coordonnées invalides."
            );

            return;
        }

        spawnLatitude =
            latitude;

        spawnLongitude =
            longitude;

        mapLatitude =
            latitude;

        mapLongitude =
            longitude;

        addressMarker = {
            latitude,
            longitude,
            name:
                result.display_name
        };

        addressMessage(
            "📍 Spawn trouvé : " +
            result.display_name,
            true
        );

        setText(
            "spawnCoordinates",
            latitude.toFixed(5) +
            ", " +
            longitude.toFixed(5)
        );

        drawMap();

        notify(
            "📍 Position de spawn enregistrée !"
        );

    } catch (error) {

        console.error(
            "OpenStreetMap :",
            error
        );

        addressMessage(
            "❌ Impossible de rechercher l'adresse."
        );
    }
}


/* =========================================================
   SPAWN
========================================================= */

function spawnAtAddress() {

    if (!addressMarker) {

        notify(
            "🔎 Cherche d'abord une adresse."
        );

        return;
    }

    mapLatitude =
        spawnLatitude;

    mapLongitude =
        spawnLongitude;

    drawMap();

    notify(
        "📍 Tu vas apparaître à l'adresse choisie !"
    );

    /*
       Si on est déjà dans une partie,
       on envoie directement la nouvelle position.
    */

    if (connected && currentRoom) {

        send({
            type:
                "player_update",

            latitude:
                spawnLatitude,

            longitude:
                spawnLongitude,

            rotation: 0
        });
    }
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

    const rect =
        canvas.getBoundingClientRect();

    canvas.width =
        Math.max(
            300,
            Math.floor(
                rect.width ||
                window.innerWidth
            )
        );

    canvas.height =
        Math.max(
            300,
            Math.floor(
                rect.height ||
                window.innerHeight
            )
        );

    const ctx =
        canvas.getContext("2d");

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    /*
       Fond
    */

    ctx.fillStyle =
        "#182018";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    /*
       Grille
    */

    ctx.save();

    ctx.translate(
        canvas.width / 2,
        canvas.height / 2
    );

    ctx.scale(
        mapZoom,
        mapZoom
    );

    ctx.strokeStyle =
        "#596359";

    ctx.lineWidth =
        12;

    const size = 2000;

    for (
        let x = -size;
        x <= size;
        x += 200
    ) {

        ctx.beginPath();

        ctx.moveTo(
            x,
            -size
        );

        ctx.lineTo(
            x,
            size
        );

        ctx.stroke();
    }

    for (
        let y = -size;
        y <= size;
        y += 200
    ) {

        ctx.beginPath();

        ctx.moveTo(
            -size,
            y
        );

        ctx.lineTo(
            size,
            y
        );

        ctx.stroke();
    }

    /*
       Spawn
    */

    if (addressMarker) {

        ctx.fillStyle =
            "#35e875";

        ctx.beginPath();

        ctx.arc(
            0,
            0,
            14,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.fillStyle =
            "#ffffff";

        ctx.font =
            "bold 14px Arial";

        ctx.textAlign =
            "center";

        ctx.fillText(
            "SPAWN",
            0,
            -25
        );
    }

    /*
       Joueurs
    */

    const localPlayer =
        players[currentPlayerId];

    if (localPlayer) {

        ctx.fillStyle =
            "#ff3333";

        ctx.beginPath();

        ctx.arc(
            0,
            0,
            10,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    /*
       Autres joueurs
    */

    Object.values(players)
        .forEach(player => {

            if (
                player.id ===
                currentPlayerId
            ) {
                return;
            }

            if (
                typeof player.latitude !==
                "number" ||
                typeof player.longitude !==
                "number"
            ) {
                return;
            }

            const x =
                (
                    player.longitude -
                    mapLongitude
                ) * 100000;

            const y =
                (
                    player.latitude -
                    mapLatitude
                ) * -100000;

            ctx.fillStyle =
                "#4da6ff";

            ctx.beginPath();

            ctx.arc(
                x,
                y,
                8,
                0,
                Math.PI * 2
            );

            ctx.fill();
        });

    ctx.restore();
}


function zoomMap(amount) {

    mapZoom += amount;

    mapZoom =
        Math.max(
            0.5,
            Math.min(
                5,
                mapZoom
            )
        );

    drawMap();
}


/* =========================================================
   ZOOM TACTILE
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
                Math.abs(difference) > 5
            ) {

                mapZoom +=
                    difference > 0
                        ? 0.08
                        : -0.08;

                mapZoom =
                    Math.max(
                        0.5,
                        Math.min(
                            5,
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
   POSITION DU JOUEUR
========================================================= */

function sendPlayerPosition(
    latitude,
    longitude,
    rotation = 0
) {

    if (!connected || !currentRoom) {
        return;
    }

    send({
        type:
            "player_update",

        latitude,
        longitude,
        rotation
    });
}


/* =========================================================
   ENTRER / SORTIR VÉHICULE
========================================================= */

function enterVehicle() {

    selectedVehicle =
        selectedVehicle === "walk"
            ? "car"
            : selectedVehicle;

    send({
        type:
            "enter_vehicle",

        vehicle:
            selectedVehicle
    });

    updateHUD();
}


function exitVehicle() {

    selectedVehicle =
        "walk";

    send({
        type:
            "exit_vehicle"
    });

    updateHUD();
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
            "translate(0,0)";
    }

    joystick.addEventListener(
        "pointerdown",
        event => {

            active = true;

            try {
                joystick.setPointerCapture(
                    event.pointerId
                );
            } catch {}

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
                button.classList.add("active");
            }
        );

        button.addEventListener(
            "pointerup",
            () => {
                button.classList.remove("active");
            }
        );

        button.addEventListener(
            "pointercancel",
            () => {
                button.classList.remove("active");
            }
        );
    });
}


/* =========================================================
   ÉCRANS
========================================================= */

function setupScreens() {

    document
        .querySelectorAll("[data-close]")
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
                        "privateRoomScreen"
                    ) {
                        show("multiplayerScreen");
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

    /* AUTH */

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


    /* MENU */

    $("playButton")
        ?.addEventListener(
            "click",
            startGame
        );

    $("multiplayerButton")
        ?.addEventListener(
            "click",
            openMultiplayer
        );

    $("quickMatchButton")
        ?.addEventListener(
            "click",
            () => {

                openMultiplayer();

                quickMatch();
            }
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


    /* MULTI */

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


    /* ROOM */

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


    /* GARAGE */

    $("spawnVehicleButton")
        ?.addEventListener(
            "click",
            useVehicle
        );


    /* AMIS */

    $("sendFriendRequestButton")
        ?.addEventListener(
            "click",
            sendFriendRequest
        );


    /* SETTINGS */

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


    /* ADRESSE */

    $("searchAddressButton")
        ?.addEventListener(
            "click",
            searchAddress
        );

    $("findAddressButton")
        ?.addEventListener(
            "click",
            searchAddress
        );

    $("spawnAddressButton")
        ?.addEventListener(
            "click",
            spawnAtAddress
        );


    const addressInputs = [
        $("addressInput"),
        $("spawnAddressInput"),
        $("cityInput")
    ];

    addressInputs.forEach(input => {

        if (!input) {
            return;
        }

        input.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                ) {

                    event.preventDefault();

                    searchAddress();
                }
            }
        );
    });


    /* CARTE */

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


    /* PAUSE */

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

    $("exitGameButton")
        ?.addEventListener(
            "click",
            exitGame
        );


    /* VÉHICULE */

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
   CLAVIER
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        const auth =
            $("authScreen");

        if (
            event.key === "Enter" &&
            auth &&
            !auth.classList.contains("hidden")
        ) {

            loginAccount();
        }

        if (
            event.key === "Escape"
        ) {

            const map =
                $("mapScreen");

            if (
                map &&
                !map.classList.contains("hidden")
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
   REDIMENSIONNEMENT
========================================================= */

window.addEventListener(
    "resize",
    () => {

        if (
            $("mapScreen") &&
            !$("mapScreen").classList.contains("hidden")
        ) {

            drawMap();
        }
    }
);


/* =========================================================
   INITIALISATION
========================================================= */

function init() {

    console.log(
        "🚗 RoadGame V5 démarrage..."
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

    setLoadingProgress(25);

    setLoadingText(
        "Préparation de la carte..."
    );

    /*
       Le jeu ne reste PAS bloqué
       si Render met du temps à démarrer.
    */

    setTimeout(() => {

        setLoadingProgress(50);

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
