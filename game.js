"use strict";

/* =========================================================
   ROADGAME V4
   - Comptes
   - Connexion
   - Pseudos uniques
   - Multijoueur
   - Parties publiques / privées
   - Partie rapide
   - OpenStreetMap
   - Recherche d'adresse
   - Spawn aux coordonnées choisies
   - Carte
   - Zoom tactile
   - Garage
   - Véhicules
   - Amis
   - Paramètres
========================================================= */


/* =========================================================
   CONFIG SERVEUR
========================================================= */

const SERVER_URL =
    "wss://roadgame-server.onrender.com";


/* =========================================================
   VARIABLES
========================================================= */

let socket = null;

let connected = false;
let loggedIn = false;

let currentUser = null;

let currentRoom = null;
let currentPlayerId = null;

let players = {};

let selectedVehicle = "car";

let gameStarted = false;

let loadingProgress = 0;

let selectedSpawn = {
    latitude: 48.8566,
    longitude: 2.3522,
    address: "Paris"
};

let spawnMap = null;
let spawnMarker = null;

let gameMap = null;
let playerMarker = null;

let mapZoom = 13;

let reconnectTimer = null;

let addressSearchController = null;


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
   NOTIFICATION
========================================================= */

function notify(message) {

    const container =
        $("notifications");

    if (!container) {
        return;
    }

    const notification =
        document.createElement("div");

    notification.className =
        "notification";

    notification.textContent =
        message;

    container.appendChild(
        notification
    );

    setTimeout(() => {

        notification.remove();

    }, 4000);
}


/* =========================================================
   MESSAGES
========================================================= */

function authMessage(message, success = false) {

    const element =
        $("authMessage");

    if (!element) {
        return;
    }

    element.textContent =
        message;

    element.style.color =
        success
            ? "#20e875"
            : "#ff5555";
}

function multiplayerMessage(message) {

    const element =
        $("multiplayerMessage");

    if (element) {
        element.textContent =
            message;
    }
}

function privateMessage(message) {

    const element =
        $("privateRoomMessage");

    if (element) {
        element.textContent =
            message;
    }
}

function usernameMessage(message) {

    const element =
        $("usernameMessage");

    if (element) {
        element.textContent =
            message;
    }
}


/* =========================================================
   WEBSOCKET
========================================================= */

function connectServer() {

    if (
        socket &&
        (
            socket.readyState ===
            WebSocket.OPEN ||
            socket.readyState ===
            WebSocket.CONNECTING
        )
    ) {
        return;
    }

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

        setLoadingText(
            "Erreur de connexion."
        );

        return;
    }

    socket.addEventListener(
        "open",
        () => {

            connected = true;

            console.log(
                "🟢 RoadGame connecté"
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

            }, 300);
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
                    "Message serveur invalide"
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

            if (!gameStarted) {

                authMessage(
                    "Serveur déconnecté."
                );
            }

            scheduleReconnect();
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
   ENVOI
========================================================= */

function send(data) {

    if (!socket) {

        notify(
            "Serveur non connecté."
        );

        return false;
    }

    if (
        socket.readyState !==
        WebSocket.OPEN
    ) {

        notify(
            "Serveur non connecté."
        );

        return false;
    }

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

        case "private_room_created":

            privateMessage(
                "Serveur créé ! Code : " +
                data.room
            );

            break;

        case "room_joined":
            handleRoom(data);
            break;

        case "quick_match_searching":

            multiplayerMessage(
                "Recherche d'une partie..."
            );

            break;

        case "quick_match_found":

            handleRoom(data);

            notify(
                "⚡ Partie trouvée !"
            );

            break;

        case "player_joined":

            addPlayer(data.player);

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

            renderGarage();
            renderShop();

            notify(
                "🚗 Véhicule ajouté au garage !"
            );

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
                "Message serveur :",
                data
            );
    }
}


/* =========================================================
   ERREUR
========================================================= */

function handleServerError(message) {

    console.error(
        "Serveur :",
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
   AUTH
========================================================= */

function registerAccount() {

    if (!connected) {

        authMessage(
            "Le serveur n'est pas connecté."
        );

        return;
    }

    const username =
        $("usernameInput")
            .value
            .trim();

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
            "Le serveur n'est pas connecté."
        );

        return;
    }

    const username =
        $("usernameInput")
            .value
            .trim();

    const password =
        $("passwordInput")
            .value;

    if (!username || !password) {

        authMessage(
            "Remplis les deux champs."
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

    hide("authScreen");
    hide("loadingScreen");
    hide("multiplayerScreen");
    hide("privateRoomScreen");
    hide("roomScreen");
    hide("spawnScreen");
    hide("garageScreen");
    hide("shopScreen");
    hide("friendsScreen");
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
                : "Invité"
        )
    );

    renderGarage();
    renderShop();
    renderFriends();
}


/* =========================================================
   SPAWN SCREEN
========================================================= */

function openSpawnScreen() {

    hide("mainMenu");

    show("spawnScreen");

    setTimeout(
        initializeSpawnMap,
        100
    );
}


/* =========================================================
   OPENSTREETMAP
========================================================= */

function initializeSpawnMap() {

    if (!window.L) {

        setText(
            "addressResult",
            "Impossible de charger la carte."
        );

        return;
    }

    if (!spawnMap) {

        spawnMap =
            L.map(
                "spawnMap",
                {
                    zoomControl: true,
                    attributionControl: true
                }
            );

        L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                maxZoom: 19,
                attribution:
                    "&copy; OpenStreetMap contributors"
            }
        ).addTo(spawnMap);

    }

    spawnMap.invalidateSize();

    spawnMap.setView(
        [
            selectedSpawn.latitude,
            selectedSpawn.longitude
        ],
        13
    );

    setSpawnMarker(
        selectedSpawn.latitude,
        selectedSpawn.longitude,
        selectedSpawn.address
    );
}


/* =========================================================
   MARQUEUR SPAWN
========================================================= */

function setSpawnMarker(
    latitude,
    longitude,
    address
) {

    if (!spawnMap) {
        return;
    }

    if (spawnMarker) {

        spawnMarker.setLatLng(
            [
                latitude,
                longitude
            ]
        );

    } else {

        spawnMarker =
            L.marker(
                [
                    latitude,
                    longitude
                ]
            ).addTo(spawnMap);
    }

    spawnMarker.bindPopup(
        "📍 Spawn ici<br>" +
        escapeHtml(address || "Position")
    );

    spawnMarker.openPopup();

    spawnMap.setView(
        [
            latitude,
            longitude
        ],
        spawnMap.getZoom()
    );
}


/* =========================================================
   RECHERCHE ADRESSE
   Nominatim / OpenStreetMap
========================================================= */

async function searchAddress() {

    const input =
        $("addressInput");

    const result =
        $("addressResult");

    const button =
        $("searchAddressButton");

    if (!input || !result) {
        return;
    }

    const query =
        input.value.trim();

    if (!query) {

        result.textContent =
            "Écris une adresse ou une ville.";

        return;
    }

    if (addressSearchController) {

        addressSearchController.abort();
    }

    addressSearchController =
        new AbortController();

    button.disabled = true;

    result.textContent =
        "🔎 Recherche...";

    try {

        const url =
            "https://nominatim.openstreetmap.org/search?" +
            new URLSearchParams({
                q: query,
                format: "jsonv2",
                limit: "1",
                addressdetails: "1",
                "accept-language": "fr"
            });

        const response =
            await fetch(
                url,
                {
                    signal:
                        addressSearchController.signal,

                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );

        if (!response.ok) {
            throw new Error(
                "Recherche impossible"
            );
        }

        const results =
            await response.json();

        if (!results.length) {

            result.textContent =
                "❌ Adresse introuvable.";

            return;
        }

        const place =
            results[0];

        const latitude =
            Number(place.lat);

        const longitude =
            Number(place.lon);

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {

            throw new Error(
                "Coordonnées invalides"
            );
        }

        selectedSpawn = {

            latitude,

            longitude,

            address:
                place.display_name
        };

        result.textContent =
            "📍 " +
            place.display_name;

        setText(
            "coordinatesText",
            latitude.toFixed(6) +
            " / " +
            longitude.toFixed(6)
        );

        const spawnButton =
            $("spawnHereButton");

        if (spawnButton) {
            spawnButton.disabled =
                false;
        }

        if (spawnMap) {

            spawnMap.setView(
                [
                    latitude,
                    longitude
                ],
                16
            );

            setSpawnMarker(
                latitude,
                longitude,
                place.display_name
            );
        }

    } catch (error) {

        if (
            error.name ===
            "AbortError"
        ) {
            return;
        }

        console.error(error);

        result.textContent =
            "❌ Impossible de rechercher cette adresse.";
    } finally {

        button.disabled = false;
    }
}


/* =========================================================
   SPAWN ICI
========================================================= */

function spawnHere() {

    const latitude =
        selectedSpawn.latitude;

    const longitude =
        selectedSpawn.longitude;

    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
    ) {

        notify(
            "Choisis d'abord une adresse."
        );

        return;
    }

    notify(
        "📍 Spawn à " +
        selectedSpawn.address
    );

    /*
       Si le joueur crée une partie,
       les coordonnées sont envoyées
       directement au serveur.
    */

    hide("spawnScreen");

    show("multiplayerScreen");

    multiplayerMessage(
        "Position de spawn sélectionnée."
    );
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

        return;
    }

    send({
        type: "create_room",

        vehicle:
            selectedVehicle,

        latitude:
            selectedSpawn.latitude,

        longitude:
            selectedSpawn.longitude
    });
}


function openPrivateRoom() {

    hide("multiplayerScreen");

    show("privateRoomScreen");

    privateMessage("");
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
            selectedVehicle,

        latitude:
            selectedSpawn.latitude,

        longitude:
            selectedSpawn.longitude
    });
}


function joinRoom() {

    const code =
        $("roomCodeInput")
            .value
            .trim()
            .toUpperCase();

    const password =
        $("roomPasswordInput")
            .value;

    if (code.length !== 6) {

        multiplayerMessage(
            "Le code doit contenir 6 caractères."
        );

        return;
    }

    send({

        type:
            "join_room",

        room:
            code,

        password,

        vehicle:
            selectedVehicle,

        latitude:
            selectedSpawn.latitude,

        longitude:
            selectedSpawn.longitude
    });
}


function quickMatch() {

    if (!connected) {

        multiplayerMessage(
            "Serveur non connecté."
        );

        return;
    }

    multiplayerMessage(
        "Recherche..."
    );

    send({

        type:
            "quick_match",

        vehicle:
            selectedVehicle,

        latitude:
            selectedSpawn.latitude,

        longitude:
            selectedSpawn.longitude
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

    if (
        Array.isArray(
            data.players
        )
    ) {

        data.players.forEach(
            player => {

                players[
                    player.id
                ] = player;

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

    updatePlayerOnGameMap(
        player
    );
}


function updateRemoteVehicle(data) {

    if (
        !players[
            data.playerId
        ]
    ) {
        return;
    }

    players[
        data.playerId
    ].vehicle =
        data.vehicle;

    players[
        data.playerId
    ].inVehicle =
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
        .forEach(
            player => {

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

                list.appendChild(
                    div
                );
            }
        );
}


/* =========================================================
   START GAME
========================================================= */

function startGame() {

    gameStarted = true;

    hide("mainMenu");
    hide("roomScreen");
    hide("pauseScreen");

    show("gameHud");

    initializeGameMap();

    updateHUD();

    notify(
        "🚗 Bienvenue dans RoadGame !"
    );
}


/* =========================================================
   GAME MAP
========================================================= */

function initializeGameMap() {

    if (!window.L) {
        return;
    }

    if (!gameMap) {

        gameMap =
            L.map(
                "gameMap",
                {
                    zoomControl: false
                }
            );

        L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                maxZoom: 19,
                attribution:
                    "&copy; OpenStreetMap contributors"
            }
        ).addTo(gameMap);
    }

    setTimeout(() => {

        gameMap.invalidateSize();

        gameMap.setView(
            [
                selectedSpawn.latitude,
                selectedSpawn.longitude
            ],
            mapZoom
        );

        updateLocalMarker();

    }, 100);
}


/* =========================================================
   MARQUEUR LOCAL
========================================================= */

function updateLocalMarker() {

    if (!gameMap) {
        return;
    }

    const position = [

        selectedSpawn.latitude,

        selectedSpawn.longitude

    ];

    if (playerMarker) {

        playerMarker.setLatLng(
            position
        );

    } else {

        playerMarker =
            L.marker(
                position
            ).addTo(gameMap);

        playerMarker.bindPopup(
            "📍 Toi"
        );
    }
}


/* =========================================================
   MARQUEURS AUTRES JOUEURS
========================================================= */

const remoteMarkers = {};


function updatePlayerOnGameMap(player) {

    if (!gameMap) {
        return;
    }

    if (
        player.id ===
        currentPlayerId
    ) {
        return;
    }

    if (
        !Number.isFinite(
            player.latitude
        ) ||
        !Number.isFinite(
            player.longitude
        )
    ) {
        return;
    }

    const position = [

        player.latitude,

        player.longitude

    ];

    if (
        remoteMarkers[player.id]
    ) {

        remoteMarkers[
            player.id
        ].setLatLng(
            position
        );

    } else {

        const marker =
            L.marker(
                position
            ).addTo(gameMap);

        marker.bindPopup(
            escapeHtml(
                player.name
            )
        );

        remoteMarkers[
            player.id
        ] = marker;
    }
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
            : selectedVehicle
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

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const vehicles =
        currentUser
            ? currentUser.vehicles ||
              ["car"]
            : ["car"];

    vehicles.forEach(
        vehicle => {

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
                VEHICLE_NAMES[
                    vehicle
                ] || vehicle;

            button.onclick =
                () => {

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
                };

            container.appendChild(
                button
            );
        }
    );
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

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const owned =
        currentUser
            ? currentUser.vehicles ||
              ["car"]
            : ["car"];

    [
        "truck",
        "bus",
        "plane",
        "boat"
    ].forEach(
        vehicle => {

            const div =
                document.createElement(
                    "div"
                );

            div.className =
                "vehicleCard";

            div.textContent =
                VEHICLE_NAMES[
                    vehicle
                ];

            if (
                owned.includes(
                    vehicle
                )
            ) {

                const p =
                    document.createElement(
                        "p"
                    );

                p.textContent =
                    "✅ Possédé";

                div.appendChild(p);

            } else {

                const button =
                    document.createElement(
                        "button"
                    );

                button.className =
                    "button primary";

                button.textContent =
                    "Acheter";

                button.onclick =
                    () => {

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
        }
    );
}


/* =========================================================
   AMIS
========================================================= */

function sendFriendRequest() {

    const input =
        $("friendUsernameInput");

    if (!input) {
        return;
    }

    const username =
        input.value.trim();

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
            "<p>Aucune demande.</p>";
    }

    if (friendList) {

        friendList.innerHTML =
            "<p>Tu n'as pas encore d'amis.</p>";
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
   CHANGER PSEUDO
========================================================= */

function changeUsername() {

    const username =
        $("newUsernameInput")
            .value
            .trim();

    if (username.length < 3) {

        usernameMessage(
            "Pseudo trop court."
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
   ENTRER / SORTIR VÉHICULE
========================================================= */

function enterVehicle() {

    if (
        selectedVehicle ===
        "walk"
    ) {

        selectedVehicle =
            "car";
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
   QUITTER ROOM
========================================================= */

function leaveRoom() {

    currentRoom = null;

    currentPlayerId = null;

    players = {};

    hide("roomScreen");

    show("mainMenu");

    /*
       On ne ferme PAS le WebSocket.
       Cela évite de devoir attendre
       le redémarrage du serveur.
    */
}


/* =========================================================
   LOGOUT
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
   CARTE
========================================================= */

function openMap() {

    hide("gameHud");

    show("mapScreen");

    if (!gameMap) {

        initializeGameMap();

    } else {

        setTimeout(() => {

            gameMap.invalidateSize();

            gameMap.setView(
                [
                    selectedSpawn.latitude,
                    selectedSpawn.longitude
                ],
                mapZoom
            );

        }, 100);
    }
}


function closeMap() {

    hide("mapScreen");

    show("gameHud");
}


function zoomMap(amount) {

    mapZoom += amount;

    mapZoom =
        Math.max(
            3,
            Math.min(
                19,
                mapZoom
            )
        );

    if (gameMap) {

        gameMap.setZoom(
            mapZoom
        );
    }
}


function centerMap() {

    if (!gameMap) {
        return;
    }

    gameMap.setView(
        [
            selectedSpawn.latitude,
            selectedSpawn.longitude
        ],
        mapZoom
    );
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

    function move(
        clientX,
        clientY
    ) {

        const rect =
            joystick.getBoundingClientRect();

        const centerX =
            rect.left +
            rect.width / 2;

        const centerY =
            rect.top +
            rect.height / 2;

        let dx =
            clientX -
            centerX;

        let dy =
            clientY -
            centerY;

        const max =
            rect.width / 2;

        const distance =
            Math.sqrt(
                dx * dx +
                dy * dy
            );

        if (
            distance > max
        ) {

            dx =
                dx /
                distance *
                max;

            dy =
                dy /
                distance *
                max;
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
   BOUTONS CONDUITE
========================================================= */

function setupDriveControls() {

    [
        "accelerateButton",
        "brakeButton",
        "leftButton",
        "rightButton"
    ].forEach(id => {

        const button = $(id);

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

    const bar =
        $("loadingBarFill");

    if (text) {

        text.textContent =
            "Chargement... " +
            Math.round(
                loadingProgress
            ) +
            "%";
    }

    if (bar) {

        bar.style.width =
            loadingProgress +
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


/* =========================================================
   CHARGEMENT
========================================================= */

function loadingAnimation() {

    let progress = 0;

    const interval =
        setInterval(() => {

            if (connected) {

                clearInterval(
                    interval
                );

                return;
            }

            progress +=
                Math.random() * 10;

            /*
               On ne bloque plus à 90%.
               Le maximum d'attente est 80%.
               Le WebSocket décide quand
               passer à 100%.
            */

            progress =
                Math.min(
                    80,
                    progress
                );

            setLoadingProgress(
                progress
            );

        }, 180);
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

                    show(
                        id ===
                        "settingsScreen"
                            ? "mainMenu"
                            : "mainMenu"
                    );
                }
            );
        });
}


/* =========================================================
   EVENTS
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
            openSpawnScreen
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

                openSpawnScreen();

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


    /* SPAWN */

    $("searchAddressButton")
        ?.addEventListener(
            "click",
            searchAddress
        );

    $("spawnHereButton")
        ?.addEventListener(
            "click",
            spawnHere
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


    /* MULTI */

    $("quickMatchButton2")
        ?.addEventListener(
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


    /* GAME */

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

    $("mapCenterButton")
        ?.addEventListener(
            "click",
            centerMap
        );

    $("mapZoomIn")
        ?.addEventListener(
            "click",
            () => zoomMap(1)
        );

    $("mapZoomOut")
        ?.addEventListener(
            "click",
            () => zoomMap(-1)
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
   INITIALISATION
========================================================= */

function init() {

    console.log(
        "🚗 RoadGame V4"
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
    hide("spawnScreen");
    hide("garageScreen");
    hide("shopScreen");
    hide("friendsScreen");
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

    loadingAnimation();

    /*
       Connexion rapide au serveur.
       OpenStreetMap n'est PAS chargé ici.
       Cela évite que le chargement reste bloqué.
    */

    setTimeout(() => {

        setLoadingProgress(25);

        setLoadingText(
            "Connexion au serveur..."
        );

        connectServer();

    }, 250);
}


/* =========================================================
   UTILITAIRE
========================================================= */

function escapeHtml(value) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
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
            $("authScreen") &&
            !$("authScreen")
                .classList
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
