"use strict";

/* =========================================================
   ROADGAME V4
   ========================================================= */

/* =========================================================
   SERVEUR
========================================================= */

const SERVER_URL = "wss://roadgame-server.onrender.com";

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
let reconnectTimer = null;

let spawnLocation = {
    latitude: 48.8566,
    longitude: 2.3522,
    address: "Paris, France"
};


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
   NOTIFICATIONS
========================================================= */

function notify(message) {
    const container = $("notifications");

    if (!container) {
        console.log(message);
        return;
    }

    const notification = document.createElement("div");

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
    const el = $("authMessage");

    if (!el) return;

    el.textContent = message;
    el.style.color = success ? "#35e875" : "#ff5555";
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
   LOADING
========================================================= */

function setLoadingProgress(value) {
    loadingProgress = Math.max(0, Math.min(100, value));

    const text = $("loadingText");

    if (text) {
        text.textContent =
            "Chargement... " +
            Math.round(loadingProgress) +
            "%";
    }

    const bar =
        $("loadingBar") ||
        $("loadingProgress");

    if (bar) {
        if (
            bar.tagName === "PROGRESS"
        ) {
            bar.value = loadingProgress;
        } else {
            bar.style.width =
                loadingProgress + "%";
        }
    }
}

function setLoadingText(text) {
    const el = $("loadingText");

    if (el) {
        el.textContent = text;
    }
}

function showAuthAfterLoading() {
    hide("loadingScreen");
    show("authScreen");
}

function loadingAnimation() {
    let progress = 5;

    const interval = setInterval(() => {

        if (connected) {
            clearInterval(interval);
            return;
        }

        progress += Math.random() * 5;

        /*
         * IMPORTANT :
         * On ne reste plus bloqué à 90 %.
         */
        if (progress >= 89) {
            progress = 89;
            setLoadingText(
                "Connexion au serveur..."
            );
        }

        setLoadingProgress(progress);

    }, 250);
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

    clearTimeout(connectionTimer);

    setLoadingText(
        "Connexion au serveur..."
    );

    setLoadingProgress(
        Math.max(loadingProgress, 35)
    );

    try {
        socket = new WebSocket(
            SERVER_URL
        );
    } catch (error) {

        console.error(error);

        serverConnectionFailed(
            "Impossible de créer la connexion."
        );

        return;
    }

    /*
     * Le serveur Render peut mettre quelques secondes
     * à se réveiller.
     *
     * Mais on ne laisse jamais l'écran charger
     * indéfiniment.
     */
    connectionTimer = setTimeout(() => {

        if (!connected) {

            console.warn(
                "⏱️ Temps de connexion dépassé"
            );

            try {
                socket.close();
            } catch {}

            serverConnectionFailed(
                "Le serveur met trop de temps à répondre."
            );
        }

    }, 15000);


    socket.addEventListener(
        "open",
        () => {

            clearTimeout(connectionTimer);

            connected = true;

            console.log(
                "🟢 RoadGame connecté"
            );

            setLoadingProgress(100);

            setLoadingText(
                "Serveur connecté !"
            );

            setTimeout(() => {

                if (!gameStarted) {
                    showAuthAfterLoading();
                }

            }, 400);
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
            } catch {

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


    socket.addEventListener(
        "close",
        () => {

            connected = false;

            clearTimeout(connectionTimer);

            console.log(
                "🔴 WebSocket fermé"
            );

            if (!gameStarted) {

                authMessage(
                    "Serveur déconnecté."
                );
            }
        }
    );


    socket.addEventListener(
        "error",
        error => {

            console.error(
                "WebSocket error :",
                error
            );

            connected = false;
        }
    );
}


function serverConnectionFailed(message) {

    connected = false;

    setLoadingProgress(100);

    setLoadingText(
        "Serveur indisponible"
    );

    /*
     * On affiche quand même l'écran de connexion.
     * Le jeu ne reste donc plus bloqué au chargement.
     */
    setTimeout(() => {

        showAuthAfterLoading();

        authMessage(
            message +
            " Tu peux réessayer."
        );

    }, 700);
}


/* =========================================================
   ENVOI
========================================================= */

function send(data) {

    if (
        !socket ||
        socket.readyState !== WebSocket.OPEN
    ) {

        console.warn(
            "WebSocket non connecté"
        );

        return false;
    }

    try {

        socket.send(
            JSON.stringify(data)
        );

        return true;

    } catch (error) {

        console.error(error);

        return false;
    }
}


/* =========================================================
   RÉCEPTION SERVEUR
========================================================= */

function handleServerMessage(data) {

    switch (data.type) {

        case "connected":
            console.log(
                "✅ Serveur prêt"
            );
            break;


        case "account_created":
            handleAccountCreated(
                data.user
            );
            break;


        case "login_success":
            handleLoginSuccess(
                data.user
            );
            break;


        case "error":
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
        case "vehicle_enter":
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
                currentUser =
                    data.user;
            }

            renderFriends();

            break;


        default:

            console.log(
                "Message serveur non géré :",
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
        user.selectedVehicle ||
        "car";

    authMessage(
        "Compte créé avec succès !",
        true
    );

    setTimeout(
        openMainMenu,
        500
    );
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

    setTimeout(
        openMainMenu,
        300
    );
}


/* =========================================================
   INSCRIPTION
========================================================= */

function registerAccount() {

    if (!connected) {

        authMessage(
            "❌ Serveur non connecté. Attends quelques secondes puis réessaie."
        );

        reconnectServer();

        return;
    }

    const username =
        $("usernameInput")?.value.trim() ||
        "";

    const password =
        $("passwordInput")?.value ||
        "";

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


/* =========================================================
   CONNEXION
========================================================= */

function loginAccount() {

    if (!connected) {

        authMessage(
            "❌ Serveur non connecté."
        );

        reconnectServer();

        return;
    }

    const username =
        $("usernameInput")?.value.trim() ||
        "";

    const password =
        $("passwordInput")?.value ||
        "";

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
   RECONNEXION
========================================================= */

function reconnectServer() {

    if (
        socket &&
        (
            socket.readyState === WebSocket.OPEN ||
            socket.readyState === WebSocket.CONNECTING
        )
    ) {
        return;
    }

    clearTimeout(reconnectTimer);

    reconnectTimer =
        setTimeout(() => {

            connectServer();

        }, 500);
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

        reconnectServer();

        return;
    }

    send({
        type: "create_room",

        vehicle:
            selectedVehicle,

        latitude:
            spawnLocation.latitude,

        longitude:
            spawnLocation.longitude
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

        reconnectServer();

        return;
    }

    const password =
        $("privatePasswordInput")?.value ||
        "";

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
            spawnLocation.latitude,

        longitude:
            spawnLocation.longitude
    });
}


function joinRoom() {

    if (!connected) {

        multiplayerMessage(
            "Serveur non connecté."
        );

        reconnectServer();

        return;
    }

    const code =
        $("roomCodeInput")?.value
            .trim()
            .toUpperCase() ||
        "";

    const password =
        $("roomPasswordInput")?.value ||
        "";

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
            spawnLocation.latitude,

        longitude:
            spawnLocation.longitude
    });
}


function quickMatch() {

    if (!connected) {

        multiplayerMessage(
            "Connexion au serveur..."
        );

        reconnectServer();

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
            spawnLocation.latitude,

        longitude:
            spawnLocation.longitude
    });
}


/* =========================================================
   ROOM
========================================================= */

function fillPlayers(data) {

    players = {};

    if (!Array.isArray(data.players)) {
        return;
    }

    data.players.forEach(player => {
        players[player.id] = player;
    });
}


function handleRoomCreated(data) {

    currentRoom =
        data.room;

    currentPlayerId =
        data.playerId;

    fillPlayers(data);

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

    fillPlayers(data);

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

    fillPlayers(data);

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

    if (!player) return;

    players[player.id] =
        player;
}


function updateRemotePlayer(player) {

    if (!player) return;

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

    if (!list) return;

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

    currentRoom = null;
    currentPlayerId = null;
    players = {};

    if (
        socket &&
        socket.readyState === WebSocket.OPEN
    ) {
        /*
         * On ferme uniquement la partie client.
         * Le serveur supprimera le joueur quand
         * la connexion sera fermée.
         */
        socket.close();
    }

    setTimeout(() => {
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

    updateHUD();

    notify(
        "🚗 Bienvenue dans RoadGame !"
    );
}


/* =========================================================
   HUD
========================================================= */

function updateHUD() {

    setText(
        "hudPlayerName",
        currentUser
            ? currentUser.username
            : "Invité"
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

    setText(
        "spawnLocationText",
        spawnLocation.address
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
            vehicle === selectedVehicle
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

            if (currentUser) {
                currentUser.selectedVehicle =
                    vehicle;
            }

            setText(
                "selectedVehicleText",
                "Véhicule sélectionné : " +
                (
                    VEHICLE_NAMES[vehicle] ||
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

    notify(
        "🚗 Véhicule sélectionné !"
    );

    hide("garageScreen");
    show("mainMenu");
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

        const title =
            document.createElement(
                "div"
            );

        title.textContent =
            VEHICLE_NAMES[vehicle];

        div.appendChild(title);

        if (owned.includes(vehicle)) {

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

    const username =
        $("friendUsernameInput")?.value
            .trim() ||
        "";

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

    if (!currentUser) return;

    const requests =
        $("friendRequestsList");

    const friends =
        $("friendsList");

    if (requests) {

        requests.innerHTML =
            "<p class='emptyText'>Aucune demande.</p>";
    }

    if (friends) {

        friends.innerHTML =
            "<p class='emptyText'>Tu n'as pas encore d'amis.</p>";
    }
}


/* =========================================================
   PARAMÈTRES
========================================================= */

function saveSettings() {

    if (!currentUser) return;

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
        $("newUsernameInput")?.value
            .trim() ||
        "";

    if (username.length < 3) {

        usernameMessage(
            "Le pseudo doit contenir au moins 3 caractères."
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
        getSpawnInput();

    if (!input) {

        notify(
            "Ajoute une barre d'adresse dans ton interface."
        );

        return;
    }

    const query =
        input.value.trim();

    if (!query) {

        notify(
            "Écris une ville ou une adresse."
        );

        return;
    }

    setSpawnMessage(
        "🔎 Recherche de l'adresse..."
    );

    try {

        const url =
            "https://nominatim.openstreetmap.org/search" +
            "?format=json" +
            "&limit=1" +
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
                "OpenStreetMap HTTP " +
                response.status
            );
        }

        const results =
            await response.json();

        if (
            !Array.isArray(results) ||
            results.length === 0
        ) {

            setSpawnMessage(
                "❌ Adresse introuvable."
            );

            return;
        }

        const result =
            results[0];

        spawnLocation = {

            latitude:
                Number(result.lat),

            longitude:
                Number(result.lon),

            address:
                result.display_name ||
                query
        };

        setSpawnMessage(
            "📍 Spawn : " +
            spawnLocation.address
        );

        notify(
            "📍 Emplacement sélectionné !"
        );

        updateHUD();

        drawMap();

    } catch (error) {

        console.error(
            "OpenStreetMap :",
            error
        );

        setSpawnMessage(
            "❌ Impossible de rechercher cette adresse."
        );
    }
}


function getSpawnInput() {

    return (
        $("spawnAddressInput") ||
        $("addressInput") ||
        $("cityInput") ||
        $("spawnInput") ||
        $("locationInput")
    );
}


function setSpawnMessage(message) {

    const ids = [
        "spawnMessage",
        "addressMessage",
        "locationMessage",
        "spawnResult"
    ];

    for (const id of ids) {

        const el = $(id);

        if (el) {
            el.textContent = message;
            return;
        }
    }

    notify(message);
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

    if (!canvas) return;

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

    /*
     * Carte simplifiée.
     * Le vrai emplacement GPS est conservé
     * dans spawnLocation.
     */

    ctx.strokeStyle =
        "#555";

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

    /*
     * Position du spawn
     */

    ctx.fillStyle =
        "#ff3333";

    ctx.beginPath();

    ctx.arc(
        0,
        0,
        14,
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

    if (!canvas) return;

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
                        ? 0.06
                        : -0.06;

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

    if (
        selectedVehicle === "walk"
    ) {
        selectedVehicle = "car";
    }

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

    function move(x, y) {

        const rect =
            joystick.getBoundingClientRect();

        const centerX =
            rect.left +
            rect.width / 2;

        const centerY =
            rect.top +
            rect.height / 2;

        let dx =
            x - centerX;

        let dy =
            y - centerY;

        const max =
            rect.width / 2;

        const distance =
            Math.hypot(dx, dy);

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

            if (!active) return;

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
   BOUTONS CONDUITE
========================================================= */

function setupDriveControls() {

    const ids = [
        "accelerateButton",
        "brakeButton",
        "leftButton",
        "rightButton"
    ];

    ids.forEach(id => {

        const button = $(id);

        if (!button) return;

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
    });
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
                        id === "multiplayerScreen" ||
                        id === "friendsScreen" ||
                        id === "garageScreen" ||
                        id === "shopScreen" ||
                        id === "settingsScreen"
                    ) {
                        show("mainMenu");
                    }

                    if (
                        id === "usernameScreen"
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


    /* OPENSTREETMAP */

    const addressButtons = [
        "searchAddressButton",
        "searchSpawnButton",
        "findAddressButton",
        "spawnSearchButton"
    ];

    addressButtons.forEach(id => {

        $(id)?.addEventListener(
            "click",
            searchAddress
        );
    });


    const spawnInput =
        getSpawnInput();

    spawnInput?.addEventListener(
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
   REDIMENSIONNEMENT CARTE
========================================================= */

window.addEventListener(
    "resize",
    () => {

        if (
            $("mapScreen") &&
            !$("mapScreen")
                .classList
                .contains("hidden")
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
        "🚗 RoadGame V4 démarrage..."
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

    /*
     * On démarre rapidement la connexion.
     */
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
