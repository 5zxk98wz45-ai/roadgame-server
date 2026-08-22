"use strict";

/* =========================================================
   ROADGAME V5
   =========================================================
   - Comptes
   - Pseudo unique
   - WebSocket Render
   - Multijoueur
   - Adresse / ville
   - OpenStreetMap Nominatim
   - Spawn aux coordonnées trouvées
   - Carte
   - Zoom
   - Zoom tactile
   - Véhicules
   - Chargement non bloquant
========================================================= */


/* =========================================================
   SERVEUR
========================================================= */

const SERVER_URL =
    "wss://roadgame-server.onrender.com";


/* =========================================================
   OPENSTREETMAP
========================================================= */

const NOMINATIM_URL =
    "https://nominatim.openstreetmap.org/search";


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

let mapZoom = 1;

let mapLatitude = 48.8566;
let mapLongitude = 2.3522;

let spawnLatitude = 48.8566;
let spawnLongitude = 2.3522;

let addressSearchTimer = null;

let loadingFinished = false;


/* =========================================================
   OUTILS
========================================================= */

function $(id) {
    return document.getElementById(id);
}


function show(id) {

    const el = $(id);

    if (el) {
        el.classList.remove("hidden");
    }
}


function hide(id) {

    const el = $(id);

    if (el) {
        el.classList.add("hidden");
    }
}


function setText(id, text) {

    const el = $(id);

    if (el) {
        el.textContent = text;
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

    }, 3500);
}


/* =========================================================
   MESSAGES
========================================================= */

function authMessage(message, success = false) {

    const el =
        $("authMessage");

    if (!el) {
        return;
    }

    el.textContent =
        message;

    el.style.color =
        success
            ? "#36e875"
            : "#ff5555";
}


function multiplayerMessage(message) {

    setText(
        "multiplayerMessage",
        message
    );
}


function privateMessage(message) {

    setText(
        "privateRoomMessage",
        message
    );
}


function usernameMessage(message) {

    setText(
        "usernameMessage",
        message
    );
}


/* =========================================================
   CHARGEMENT
========================================================= */

function setLoadingProgress(value) {

    const percent =
        Math.max(
            0,
            Math.min(
                100,
                value
            )
        );

    const bar =
        $("loadingProgressBar");

    if (bar) {

        bar.style.width =
            percent + "%";

    }

    setText(
        "loadingText",
        "Chargement... " +
        Math.round(percent) +
        "%"
    );
}


function finishLoading() {

    if (loadingFinished) {
        return;
    }

    loadingFinished = true;

    setLoadingProgress(100);

    setText(
        "loadingText",
        "RoadGame prêt !"
    );

    setTimeout(() => {

        hide("loadingScreen");

        show("authScreen");

    }, 250);
}


/*
    IMPORTANT :

    On ne bloque jamais le jeu en attendant Render.

    Render peut mettre quelques secondes à réveiller
    le serveur.

    L'écran de connexion apparaît quand même.
*/

function startLoading() {

    setLoadingProgress(5);

    setTimeout(() => {

        setLoadingProgress(25);

    }, 150);

    setTimeout(() => {

        setLoadingProgress(50);

    }, 300);

    setTimeout(() => {

        setLoadingProgress(70);

    }, 500);

    setTimeout(() => {

        setLoadingProgress(85);

    }, 750);

    setTimeout(() => {

        finishLoading();

    }, 1200);
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

    console.log(
        "📡 Connexion à :",
        SERVER_URL
    );

    try {

        socket =
            new WebSocket(
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
                "🟢 Serveur connecté"
            );

            notify(
                "🟢 Serveur connecté"
            );

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

            handleServerMessage(
                data
            );
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
                    "Serveur en cours de réveil..."
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
   RECONNEXION AUTOMATIQUE
========================================================= */

setInterval(() => {

    if (!connected) {

        connectServer();

    }

}, 5000);


/* =========================================================
   ENVOI
========================================================= */

function send(data) {

    if (!socket) {

        notify(
            "Serveur non connecté."
        );

        connectServer();

        return false;
    }

    if (
        socket.readyState !==
        WebSocket.OPEN
    ) {

        notify(
            "Serveur en cours de réveil..."
        );

        connectServer();

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

            connected = true;

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


        case "room_created":

            handleRoomCreated(
                data
            );

            break;


        case "room_joined":

            handleRoomJoined(
                data
            );

            break;


        case "quick_match_found":

            handleQuickMatch(
                data
            );

            break;


        case "quick_match_searching":

            multiplayerMessage(
                "Recherche d'une partie..."
            );

            break;


        case "player_joined":

            if (data.player) {

                players[
                    data.player.id
                ] =
                    data.player;

            }

            refreshPlayersList();

            break;


        case "player_left":

            delete players[
                data.playerId
            ];

            refreshPlayersList();

            removeRemotePlayer(
                data.playerId
            );

            break;


        case "player_update":

            if (data.player) {

                players[
                    data.player.id
                ] =
                    data.player;

                updateRemotePlayerVisual(
                    data.player
                );

            }

            refreshPlayersList();

            break;


        case "vehicle_update":

        case "vehicle_enter":

        case "vehicle_exit":

            updateRemoteVehicle(
                data
            );

            break;


        case "vehicle_purchased":

            if (currentUser) {

                currentUser.vehicles =
                    data.vehicles;

            }

            renderGarage();

            renderShop();

            notify(
                "🚗 Véhicule acheté !"
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


        case "friend_added":

            currentUser =
                data.user;

            renderFriends();

            break;


        case "friend_request_sent":

            notify(
                "👥 Demande envoyée à " +
                data.username
            );

            break;


        case "settings_updated":

            if (currentUser) {

                currentUser.settings =
                    data.settings;

            }

            break;

    }
}


/* =========================================================
   ERREURS
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

        authMessage(
            message
        );

        return;
    }

    if (
        $("multiplayerScreen") &&
        !$("multiplayerScreen")
            .classList
            .contains("hidden")
    ) {

        multiplayerMessage(
            message
        );

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

    currentUser =
        user;

    loggedIn = true;

    selectedVehicle =
        user.selectedVehicle ||
        "car";

    authMessage(
        "Compte créé !",
        true
    );

    setTimeout(
        openMainMenu,
        300
    );
}


function handleLoginSuccess(user) {

    currentUser =
        user;

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

    const username =
        $("usernameInput")
            .value
            .trim();

    const password =
        $("passwordInput")
            .value;

    if (!connected) {

        authMessage(
            "⏳ Le serveur se réveille. Réessaie dans quelques secondes."
        );

        connectServer();

        return;
    }

    if (username.length < 3) {

        authMessage(
            "Le pseudo doit avoir au moins 3 caractères."
        );

        return;
    }

    if (password.length < 4) {

        authMessage(
            "Le mot de passe doit avoir au moins 4 caractères."
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

    const username =
        $("usernameInput")
            .value
            .trim();

    const password =
        $("passwordInput")
            .value;

    if (!connected) {

        authMessage(
            "⏳ Le serveur se réveille. Réessaie dans quelques secondes."
        );

        connectServer();

        return;
    }

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

    document
        .querySelectorAll(".screen")
        .forEach(screen => {

            if (
                screen.id !==
                "mainMenu"
            ) {
                screen.classList.add(
                    "hidden"
                );
            }

        });

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

    updateHUD();
}


/* =========================================================
   MULTIJOUEUR
========================================================= */

function openMultiplayer() {

    hide("mainMenu");

    show("multiplayerScreen");

    multiplayerMessage("");

    if (!connected) {

        connectServer();

    }
}


function createPublicRoom() {

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
            spawnLatitude,

        longitude:
            spawnLongitude

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

        type:
            "join_room",

        room,

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

    multiplayerMessage(
        "Recherche..."
    );

    send({

        type:
            "quick_match",

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

    if (Array.isArray(data.players)) {

        data.players.forEach(
            player => {

                players[player.id] =
                    player;

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


function handleRoomJoined(data) {

    currentRoom =
        data.room;

    currentPlayerId =
        data.playerId;

    players = {};

    if (Array.isArray(data.players)) {

        data.players.forEach(
            player => {

                players[player.id] =
                    player;

            }
        );

    }

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

    if (Array.isArray(data.players)) {

        data.players.forEach(
            player => {

                players[player.id] =
                    player;

            }
        );

    }

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

        });
}


/* =========================================================
   POSITION
========================================================= */

function sendPlayerPosition() {

    if (!currentPlayerId) {
        return;
    }

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


/* =========================================================
   VISUELS JOUEURS DISTANTS
========================================================= */

function updateRemotePlayerVisual(player) {

    if (!player) {
        return;
    }

    let element =
        document.getElementById(
            "remote-" + player.id
        );

    if (!element) {

        element =
            document.createElement(
                "div"
            );

        element.id =
            "remote-" +
            player.id;

        element.className =
            "remoteCar";

        $("gameWorld")
            ?.appendChild(
                element
            );
    }

    /*
       Position simplifiée autour du joueur.
       Le serveur continue de gérer les vraies coordonnées.
    */

    const latDifference =
        player.latitude -
        spawnLatitude;

    const lonDifference =
        player.longitude -
        spawnLongitude;

    const x =
        window.innerWidth / 2 +
        lonDifference * 100000;

    const y =
        window.innerHeight / 2 -
        latDifference * 100000;

    element.style.left =
        x + "px";

    element.style.top =
        y + "px";
}


function removeRemotePlayer(id) {

    const element =
        document.getElementById(
            "remote-" + id
        );

    if (element) {

        element.remove();

    }
}


/* =========================================================
   VÉHICULES
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
        currentUser?.vehicles ||
        ["car"];

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
                ] ||
                vehicle;

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

        });
}


function useVehicle() {

    updateHUD();

    hide("garageScreen");

    show("mainMenu");

    notify(
        "🚗 Véhicule sélectionné"
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
        currentUser?.vehicles ||
        ["car"];

    [
        "truck",
        "bus",
        "plane",
        "boat"
    ]
        .forEach(
            vehicle => {

                const card =
                    document.createElement(
                        "div"
                    );

                card.className =
                    "vehicleCard";

                card.textContent =
                    VEHICLE_NAMES[
                        vehicle
                    ];

                if (
                    owned.includes(
                        vehicle
                    )
                ) {

                    card.textContent +=
                        " — ✅ Possédé";

                } else {

                    const button =
                        document.createElement(
                            "button"
                        );

                    button.textContent =
                        "Acheter";

                    button.className =
                        "primaryButton";

                    button.onclick =
                        () => {

                            send({

                                type:
                                    "buy_vehicle",

                                vehicle

                            });

                        };

                    card.appendChild(
                        button
                    );
                }

                container.appendChild(
                    card
                );

            });
}


/* =========================================================
   AMIS
========================================================= */

function sendFriendRequest() {

    const username =
        $("friendUsernameInput")
            .value
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

    const friendList =
        $("friendsList");

    const requestList =
        $("friendRequestsList");

    if (!currentUser) {
        return;
    }

    if (friendList) {

        friendList.innerHTML =
            currentUser.friends?.length
                ? "<p>Amis enregistrés.</p>"
                : "<p>Aucun ami.</p>";

    }

    if (requestList) {

        requestList.innerHTML =
            currentUser.friendRequests?.length
                ? "<p>Demandes reçues.</p>"
                : "<p>Aucune demande.</p>";

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
            ?.checked ?? true;

    const music =
        $("musicToggle")
            ?.checked ?? true;

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
            .value
            .trim();

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

    hide("settingsScreen");

    hide("gameHud");

    show("authScreen");

    $("usernameInput").value = "";

    $("passwordInput").value = "";

    authMessage(
        "Déconnecté."
    );
}


/* =========================================================
   ADRESSE / OPENSTREETMAP
========================================================= */

async function searchAddress() {

    const input =
        $("addressInput");

    const result =
        $("addressResult");

    if (!input || !result) {
        return;
    }

    const query =
        input.value.trim();

    if (query.length < 3) {

        result.textContent =
            "Entre une ville ou une adresse.";

        return;
    }

    result.textContent =
        "🔎 Recherche...";

    try {

        const url =
            NOMINATIM_URL +
            "?format=jsonv2" +
            "&limit=1" +
            "&q=" +
            encodeURIComponent(
                query
            );

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
                "Erreur OpenStreetMap"
            );

        }

        const results =
            await response.json();

        if (
            !results ||
            results.length === 0
        ) {

            result.textContent =
                "❌ Adresse introuvable.";

            return;
        }

        const place =
            results[0];

        spawnLatitude =
            Number(
                place.lat
            );

        spawnLongitude =
            Number(
                place.lon
            );

        mapLatitude =
            spawnLatitude;

        mapLongitude =
            spawnLongitude;

        result.textContent =
            "📍 " +
            place.display_name;

        notify(
            "📍 Spawn défini !"
        );

        drawMap();

    } catch (error) {

        console.error(error);

        result.textContent =
            "❌ Impossible de rechercher cette adresse.";

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


function worldToMap(
    latitude,
    longitude,
    width,
    height
) {

    const scale =
        100000 *
        mapZoom;

    const x =
        width / 2 +
        (
            longitude -
            mapLongitude
        ) *
        scale;

    const y =
        height / 2 -
        (
            latitude -
            mapLatitude
        ) *
        scale;

    return {
        x,
        y
    };
}


function drawMap() {

    const canvas =
        $("mapCanvas");

    if (!canvas) {
        return;
    }

    const ctx =
        canvas.getContext(
            "2d"
        );

    const width =
        window.innerWidth;

    const height =
        window.innerHeight;

    const dpr =
        window.devicePixelRatio ||
        1;

    canvas.width =
        width * dpr;

    canvas.height =
        height * dpr;

    canvas.style.width =
        width + "px";

    canvas.style.height =
        height + "px";

    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );

    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    /* Fond */

    ctx.fillStyle =
        "#1c4b2a";

    ctx.fillRect(
        0,
        0,
        width,
        height
    );


    /* Grille */

    const grid =
        Math.max(
            70,
            150 * mapZoom
        );

    ctx.strokeStyle =
        "#3e6648";

    ctx.lineWidth =
        2;

    for (
        let x = -width;
        x < width * 2;
        x += grid
    ) {

        ctx.beginPath();

        ctx.moveTo(
            x,
            0
        );

        ctx.lineTo(
            x,
            height
        );

        ctx.stroke();

    }


    for (
        let y = -height;
        y < height * 2;
        y += grid
    ) {

        ctx.beginPath();

        ctx.moveTo(
            0,
            y
        );

        ctx.lineTo(
            width,
            y
        );

        ctx.stroke();

    }


    /* Spawn */

    const spawn =
        worldToMap(
            spawnLatitude,
            spawnLongitude,
            width,
            height
        );

    ctx.fillStyle =
        "#ff3333";

    ctx.beginPath();

    ctx.arc(
        spawn.x,
        spawn.y,
        12,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.fillStyle =
        "white";

    ctx.font =
        "bold 14px Arial";

    ctx.fillText(
        "📍 Spawn",
        spawn.x + 15,
        spawn.y + 5
    );


    /* Joueurs */

    Object.values(players)
        .forEach(
            player => {

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

                const pos =
                    worldToMap(
                        player.latitude,
                        player.longitude,
                        width,
                        height
                    );

                ctx.fillStyle =
                    "#4da6ff";

                ctx.beginPath();

                ctx.arc(
                    pos.x,
                    pos.y,
                    9,
                    0,
                    Math.PI * 2
                );

                ctx.fill();

            });
}


/* =========================================================
   ZOOM
========================================================= */

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

    let previousDistance =
        null;

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

                previousDistance =
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
                previousDistance === null
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
                previousDistance;

            if (
                Math.abs(
                    difference
                ) > 2
            ) {

                mapZoom +=
                    difference *
                    0.003;

                mapZoom =
                    Math.max(
                        0.5,
                        Math.min(
                            5,
                            mapZoom
                        )
                    );

                previousDistance =
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

            previousDistance =
                null;

        },
        {
            passive: true
        }
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

    sendPlayerPosition();

    notify(
        "🚗 Tu apparais ici : " +
        spawnLatitude.toFixed(5) +
        ", " +
        spawnLongitude.toFixed(5)
    );

    drawMap();
}


function updateHUD() {

    setText(
        "hudPlayerName",
        currentUser
            ? currentUser.username
            : "Invité"
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


function updateRemoteVehicle(data) {

    if (!players[data.playerId]) {
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
            rect.width / 2 -
            27;

        const distance =
            Math.hypot(
                dx,
                dy
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
            "translate(0,0)";

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
   BOUTONS
========================================================= */

function setupDriveControls() {

    document
        .querySelectorAll(
            ".driveButton"
        )
        .forEach(
            button => {

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
   QUITTER ROOM
========================================================= */

function leaveRoom() {

    currentRoom = null;

    currentPlayerId = null;

    players = {};

    hide("roomScreen");

    show("mainMenu");

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
   ÉCRANS
========================================================= */

function setupScreens() {

    document
        .querySelectorAll(
            "[data-close]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const id =
                            button.dataset.close;

                        hide(id);

                        show(
                            "mainMenu"
                        );

                    }
                );

            }
        );
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

                setTimeout(
                    quickMatch,
                    200
                );

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

                hide(
                    "settingsScreen"
                );

                show(
                    "usernameScreen"
                );

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
            () => zoomMap(.25)
        );


    $("mapZoomOut")
        ?.addEventListener(
            "click",
            () => zoomMap(-.25)
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

                hide(
                    "pauseScreen"
                );

                show(
                    "settingsScreen"
                );

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


    /* ADRESSE */

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


    /*
       Recherche aussi après une petite pause
       quand l'utilisateur arrête d'écrire.
    */

    $("addressInput")
        ?.addEventListener(
            "input",
            () => {

                clearTimeout(
                    addressSearchTimer
                );

                addressSearchTimer =
                    setTimeout(
                        () => {

                            const value =
                                $("addressInput")
                                    .value
                                    .trim();

                            if (
                                value.length >= 4
                            ) {

                                searchAddress();

                            }

                        },
                        1000
                    );

            }
        );

}


/* =========================================================
   INITIALISATION
========================================================= */

function init() {

    console.log(
        "🚗 RoadGame V5"
    );

    /*
       On cache les écrans secondaires.
    */

    document
        .querySelectorAll(
            ".screen"
        )
        .forEach(
            screen => {

                if (
                    screen.id !==
                    "loadingScreen"
                ) {

                    screen.classList.add(
                        "hidden"
                    );

                }

            }
        );


    show(
        "loadingScreen"
    );


    setupEvents();

    setupScreens();

    setupJoystick();

    setupDriveControls();

    setupMapTouch();


    /*
       Le chargement est indépendant
       du serveur Render.
    */

    startLoading();


    /*
       Connexion en arrière-plan.
    */

    setTimeout(
        connectServer,
        300
    );

}


/* =========================================================
   REDIMENSIONNEMENT
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
   CLAVIER
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
            "Enter"
        ) {

            const auth =
                $("authScreen");

            if (
                auth &&
                !auth.classList
                    .contains(
                        "hidden"
                    )
            ) {

                loginAccount();

            }

        }


        if (
            event.key ===
            "Escape"
        ) {

            const map =
                $("mapScreen");

            if (
                map &&
                !map.classList
                    .contains(
                        "hidden"
                    )
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
