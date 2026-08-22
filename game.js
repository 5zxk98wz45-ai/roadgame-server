"use strict";

/* =========================================================
   ROADGAME V6
   3D + OPENSTREETMAP + ADRESSE + JOYSTICK + MULTIJOUEUR
========================================================= */

const SERVER_URL = "wss://roadgame-server.onrender.com";

const NOMINATIM_URL =
    "https://nominatim.openstreetmap.org/search";

const OVERPASS_URL =
    "https://overpass-api.de/api/interpreter";


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

let spawnLatitude = 48.8945;
let spawnLongitude = 2.5147;

let spawnAddress = "";

let mapZoom = 1;

let loadingProgress = 0;

let scene = null;
let camera = null;
let renderer = null;

let playerObject = null;

let roadObjects = [];

let remoteObjects = {};

let clock = new THREE.Clock();

let joystickX = 0;
let joystickY = 0;

let cameraAngle = 0;
let cameraDistance = 12;

let cameraTouching = false;
let lastCameraX = 0;

let gamePosition = {
    x: 0,
    z: 0
};

let playerRotation = 0;

let mapDataLoaded = false;


/* =========================================================
   DOM
========================================================= */

function $(id) {
    return document.getElementById(id);
}

function show(id) {
    const e = $(id);
    if (e) e.classList.remove("hidden");
}

function hide(id) {
    const e = $(id);
    if (e) e.classList.add("hidden");
}

function setText(id, text) {
    const e = $(id);
    if (e) e.textContent = text;
}


/* =========================================================
   NOTIFICATION
========================================================= */

function notify(message) {

    const container = $("notifications");

    if (!container) return;

    const n = document.createElement("div");

    n.className = "notification";
    n.textContent = message;

    container.appendChild(n);

    setTimeout(() => {
        n.remove();
    }, 3500);
}


/* =========================================================
   MESSAGES
========================================================= */

function authMessage(message, success = false) {

    const e = $("authMessage");

    if (!e) return;

    e.textContent = message;
    e.style.color = success
        ? "#35e875"
        : "#ff5555";
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

    loadingProgress =
        Math.max(0, Math.min(100, value));

    const fill = $("loadingFill");

    if (fill) {
        fill.style.width =
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

    const e = $("loadingText");

    if (e) {
        e.textContent = text;
    }
}


/* =========================================================
   SERVEUR
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

        socket =
            new WebSocket(SERVER_URL);

    } catch (error) {

        console.error(error);

        return;
    }

    socket.addEventListener(
        "open",
        () => {

            connected = true;

            console.log(
                "🟢 Serveur connecté"
            );

        }
    );

    socket.addEventListener(
        "message",
        event => {

            let data;

            try {
                data = JSON.parse(
                    event.data
                );
            } catch {
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

                notify(
                    "Serveur déconnecté."
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
   MESSAGES SERVEUR
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

            addPlayer(data.player);
            refreshPlayersList();

            break;

        case "player_left":

            delete players[data.playerId];

            removeRemotePlayer(
                data.playerId
            );

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
                "🚗 Véhicule acheté !"
            );

            break;

        case "settings_updated":

            if (currentUser) {
                currentUser.settings =
                    data.settings;
            }

            break;

        case "friend_added":

            if (currentUser) {
                currentUser =
                    data.user;
            }

            renderFriends();

            break;

        case "friend_request_sent":

            notify(
                "👥 Demande envoyée à " +
                data.username
            );

            break;
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
        $("usernameInput").value.trim();

    const password =
        $("passwordInput").value;

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
            "Le serveur n'est pas encore connecté."
        );

        return;
    }

    const username =
        $("usernameInput").value.trim();

    const password =
        $("passwordInput").value;

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


function playAsGuest() {

    currentUser = {

        id:
            "guest-" +
            Date.now(),

        username:
            "Invité",

        vehicles: [
            "car"
        ],

        selectedVehicle:
            "car",

        friends: [],

        friendRequests: [],

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
        "pauseScreen"
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

    if (spawnAddress) {

        $("addressResult").innerHTML =
            `<span class="addressSuccess">
                📍 Spawn actuel : ${escapeHtml(spawnAddress)}
            </span>`;
    }
}


/* =========================================================
   RECHERCHE OPENSTREETMAP
========================================================= */

async function searchAddress() {

    const input =
        $("addressInput");

    const result =
        $("addressResult");

    if (!input || !result) return;

    const query =
        input.value.trim();

    if (!query) {

        result.innerHTML =
            `<span class="addressError">
                Entre une adresse ou une ville.
            </span>`;

        return;
    }

    result.innerHTML =
        "🔎 Recherche sur OpenStreetMap...";

    try {

        const url =
            NOMINATIM_URL +
            "?format=jsonv2" +
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
                "Nominatim HTTP " +
                response.status
            );
        }

        const results =
            await response.json();

        if (!results.length) {

            result.innerHTML =
                `<span class="addressError">
                    ❌ Adresse introuvable.
                </span>`;

            return;
        }

        const place =
            results[0];

        spawnLatitude =
            parseFloat(place.lat);

        spawnLongitude =
            parseFloat(place.lon);

        spawnAddress =
            place.display_name;

        result.innerHTML =
            `<span class="addressSuccess">
                ✅ Adresse trouvée<br>
                📍 ${escapeHtml(place.display_name)}
            </span>`;

        notify(
            "📍 Spawn défini !"
        );

    } catch (error) {

        console.error(
            "Erreur OpenStreetMap :",
            error
        );

        result.innerHTML =
            `<span class="addressError">
                ❌ Impossible de rechercher l'adresse.
                Vérifie ta connexion.
            </span>`;
    }
}


function escapeHtml(text) {

    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
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
        vehicle: selectedVehicle
    });
}


function openPrivateRoom() {

    hide("multiplayerScreen");
    show("privateRoomScreen");

    privateMessage("");
}


function createPrivateRoom() {

    const password =
        $("privatePasswordInput").value;

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
        $("roomPasswordInput").value;

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
        vehicle: selectedVehicle
    });
}


function quickMatch() {

    multiplayerMessage(
        "Recherche..."
    );

    send({
        type: "quick_match",
        vehicle: selectedVehicle
    });
}


/* =========================================================
   ROOM
========================================================= */

function prepareRoom(data) {

    currentRoom = data.room;
    currentPlayerId = data.playerId;

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


function handleRoomCreated(data) {
    prepareRoom(data);
}


function handleRoomJoined(data) {
    prepareRoom(data);
}


function handleQuickMatch(data) {

    prepareRoom(data);

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

    createRemotePlayer(player);
}


function updateRemotePlayer(player) {

    if (!player) return;

    players[player.id] =
        player;

    updateRemoteObject(player);

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
                document.createElement("div");

            div.className =
                "playerItem";

            div.textContent =
                "👤 " +
                (
                    player.name ||
                    player.username ||
                    "Joueur"
                );

            list.appendChild(div);
        });
}


/* =========================================================
   THREE.JS
========================================================= */

function init3D() {

    if (!window.THREE) {

        notify(
            "❌ Three.js n'est pas chargé."
        );

        return false;
    }

    const canvas =
        $("gameCanvas");

    if (!canvas) return false;

    scene =
        new THREE.Scene();

    scene.background =
        new THREE.Color(0x7da6b0);

    scene.fog =
        new THREE.Fog(
            0x7da6b0,
            80,
            500
        );


    camera =
        new THREE.PerspectiveCamera(
            65,
            window.innerWidth /
            window.innerHeight,
            0.1,
            1000
        );


    renderer =
        new THREE.WebGLRenderer({
            canvas,
            antialias: true
        });

    renderer.setPixelRatio(
        Math.min(
            window.devicePixelRatio,
            2
        )
    );

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );


    /* LUMIÈRE */

    const ambient =
        new THREE.HemisphereLight(
            0xffffff,
            0x344434,
            2
        );

    scene.add(ambient);

    const sun =
        new THREE.DirectionalLight(
            0xffffff,
            2
        );

    sun.position.set(
        50,
        100,
        50
    );

    scene.add(sun);


    /* SOL */

    const groundGeometry =
        new THREE.PlaneGeometry(
            1000,
            1000
        );

    const groundMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x29442f
        });

    const ground =
        new THREE.Mesh(
            groundGeometry,
            groundMaterial
        );

    ground.rotation.x =
        -Math.PI / 2;

    scene.add(ground);


    createPlayerVehicle();

    setupCameraControls();

    window.addEventListener(
        "resize",
        resize3D
    );

    animate3D();

    return true;
}


/* =========================================================
   VÉHICULE 3D
========================================================= */

function createPlayerVehicle() {

    if (playerObject) {

        scene.remove(
            playerObject
        );
    }

    const group =
        new THREE.Group();


    /* CARROSSERIE */

    const body =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                2.4,
                .7,
                4
            ),
            new THREE.MeshStandardMaterial({
                color: 0x1478d4
            })
        );

    body.position.y =
        .75;

    group.add(body);


    /* HABITACLE */

    const cabin =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                1.7,
                .75,
                1.9
            ),
            new THREE.MeshStandardMaterial({
                color: 0x202830
            })
        );

    cabin.position.y =
        1.35;

    cabin.position.z =
        -0.25;

    group.add(cabin);


    /* ROUES */

    const wheelGeometry =
        new THREE.CylinderGeometry(
            .38,
            .38,
            .3,
            16
        );

    const wheelMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x111111
        });

    const wheelPositions = [

        [-1.25,.45,-1.35],
        [1.25,.45,-1.35],
        [-1.25,.45,1.35],
        [1.25,.45,1.35]

    ];

    wheelPositions.forEach(pos => {

        const wheel =
            new THREE.Mesh(
                wheelGeometry,
                wheelMaterial
            );

        wheel.rotation.z =
            Math.PI / 2;

        wheel.position.set(
            pos[0],
            pos[1],
            pos[2]
        );

        group.add(wheel);
    });


    playerObject =
        group;

    scene.add(
        playerObject
    );

    playerObject.position.set(
        0,
        0,
        0
    );

    gamePosition.x = 0;
    gamePosition.z = 0;
}


/* =========================================================
   ROUTES OPENSTREETMAP
========================================================= */

async function loadOSMRoads() {

    if (mapDataLoaded) {
        return;
    }

    setLoadingText(
        "🗺️ Chargement des routes OpenStreetMap..."
    );

    const lat =
        spawnLatitude;

    const lon =
        spawnLongitude;

    const delta =
        0.0035;

    const south =
        lat - delta;

    const north =
        lat + delta;

    const west =
        lon - delta;

    const east =
        lon + delta;

    const query = `
[out:json][timeout:20];
(
  way["highway"]
  (${south},${west},${north},${east});
);
out geom;
`;

    try {

        const response =
            await fetch(
                OVERPASS_URL,
                {
                    method: "POST",
                    body: query
                }
            );

        if (!response.ok) {
            throw new Error(
                "Overpass HTTP " +
                response.status
            );
        }

        const data =
            await response.json();

        drawOSMRoads(
            data.elements || []
        );

        mapDataLoaded = true;

        setLoadingText(
            "🗺️ Routes chargées !"
        );

    } catch (error) {

        console.error(
            "OSM roads error:",
            error
        );

        /*
          Si Overpass est indisponible,
          on garde quand même la scène 3D.
        */

        createFallbackRoads();

        notify(
            "⚠️ Les routes OSM n'ont pas pu être chargées."
        );
    }
}


/* =========================================================
   CONVERSION GPS → MONDE 3D
========================================================= */

function gpsToWorld(lat, lon) {

    const metersPerDegreeLat =
        111320;

    const metersPerDegreeLon =
        111320 *
        Math.cos(
            spawnLatitude *
            Math.PI / 180
        );

    const x =
        (lon - spawnLongitude) *
        metersPerDegreeLon;

    const z =
        -(lat - spawnLatitude) *
        metersPerDegreeLat;

    return {
        x,
        z
    };
}


/* =========================================================
   ROUTES 3D
========================================================= */

function drawOSMRoads(elements) {

    roadObjects.forEach(
        object => {
            scene.remove(object);
        }
    );

    roadObjects = [];

    elements.forEach(way => {

        if (!way.geometry) {
            return;
        }

        const points =
            way.geometry;

        if (points.length < 2) {
            return;
        }

        let highway =
            way.tags?.highway ||
            "road";

        let width = 4;

        if (
            highway === "motorway" ||
            highway === "trunk"
        ) {
            width = 9;
        } else if (
            highway === "primary"
        ) {
            width = 7;
        } else if (
            highway === "secondary"
        ) {
            width = 6;
        } else if (
            highway === "tertiary"
        ) {
            width = 5;
        } else if (
            highway === "residential"
        ) {
            width = 4;
        } else {
            width = 3;
        }


        for (
            let i = 0;
            i < points.length - 1;
            i++
        ) {

            const a =
                gpsToWorld(
                    points[i].lat,
                    points[i].lon
                );

            const b =
                gpsToWorld(
                    points[i + 1].lat,
                    points[i + 1].lon
                );

            createRoadSegment(
                a.x,
                a.z,
                b.x,
                b.z,
                width
            );
        }
    });


    if (!roadObjects.length) {
        createFallbackRoads();
    }
}


/* =========================================================
   SEGMENT ROUTE
========================================================= */

function createRoadSegment(
    x1,
    z1,
    x2,
    z2,
    width
) {

    const dx =
        x2 - x1;

    const dz =
        z2 - z1;

    const length =
        Math.sqrt(
            dx * dx +
            dz * dz
        );

    if (length < .5) {
        return;
    }

    const geometry =
        new THREE.BoxGeometry(
            width,
            .12,
            length
        );

    const material =
        new THREE.MeshStandardMaterial({
            color: 0x383b3d
        });

    const road =
        new THREE.Mesh(
            geometry,
            material
        );

    road.position.set(
        (x1 + x2) / 2,
        .06,
        (z1 + z2) / 2
    );

    road.rotation.y =
        Math.atan2(
            dx,
            dz
        );

    scene.add(road);

    roadObjects.push(
        road
    );


    /* ligne centrale */

    if (width >= 5) {

        const lineGeometry =
            new THREE.BoxGeometry(
                .12,
                .025,
                length
            );

        const lineMaterial =
            new THREE.MeshBasicMaterial({
                color: 0xffe66d
            });

        const line =
            new THREE.Mesh(
                lineGeometry,
                lineMaterial
            );

        line.position.set(
            (x1 + x2) / 2,
            .13,
            (z1 + z2) / 2
        );

        line.rotation.y =
            Math.atan2(
                dx,
                dz
            );

        scene.add(line);

        roadObjects.push(
            line
        );
    }
}


/* =========================================================
   ROUTES DE SECOURS
========================================================= */

function createFallbackRoads() {

    createRoadSegment(
        -150,
        0,
        150,
        0,
        7
    );

    createRoadSegment(
        0,
        -150,
        0,
        150,
        7
    );

    createRoadSegment(
        -100,
        -100,
        100,
        100,
        5
    );
}


/* =========================================================
   SPAWN
========================================================= */

async function spawnAtAddress() {

    hide("mainMenu");

    show("gameHud");

    gameStarted = true;

    setLoadingText(
        "📍 Préparation du spawn..."
    );

    setLoadingProgress(20);

    if (!scene) {

        if (!init3D()) {

            notify(
                "❌ Impossible de démarrer la 3D."
            );

            return;
        }
    }

    setLoadingProgress(45);

    await loadOSMRoads();

    setLoadingProgress(100);

    if (playerObject) {

        playerObject.position.set(
            0,
            0,
            0
        );

        gamePosition.x = 0;
        gamePosition.z = 0;
    }

    updateHUD();

    notify(
        "📍 Tu apparais à " +
        (
            spawnAddress ||
            "l'emplacement choisi"
        )
    );
}


/* =========================================================
   JOUER
========================================================= */

async function startGame() {

    await spawnAtAddress();
}


/* =========================================================
   MOUVEMENT
========================================================= */

function updatePlayer(delta) {

    if (!playerObject) {
        return;
    }

    const strength =
        Math.min(
            1,
            Math.sqrt(
                joystickX * joystickX +
                joystickY * joystickY
            )
        );

    if (strength < .05) {
        return;
    }

    const speed =
        14 * delta;

    /*
      joystick haut = avancer
      joystick bas = reculer
      gauche/droite = tourner
    */

    playerRotation -=
        joystickX *
        2.5 *
        delta;

    playerObject.rotation.y =
        playerRotation;

    const forwardX =
        Math.sin(
            playerRotation
        );

    const forwardZ =
        Math.cos(
            playerRotation
        );

    gamePosition.x +=
        forwardX *
        (-joystickY) *
        speed;

    gamePosition.z +=
        forwardZ *
        (-joystickY) *
        speed;

    playerObject.position.x =
        gamePosition.x;

    playerObject.position.z =
        gamePosition.z;

    sendPlayerPosition();
}


/* =========================================================
   MULTI POSITION
========================================================= */

let lastNetworkSend = 0;

function sendPlayerPosition() {

    const now =
        performance.now();

    if (
        now -
        lastNetworkSend <
        80
    ) {
        return;
    }

    lastNetworkSend =
        now;

    if (!connected) {
        return;
    }

    send({
        type:
            "player_update",

        player: {

            id:
                currentPlayerId,

            x:
                gamePosition.x,

            z:
                gamePosition.z,

            rotation:
                playerRotation,

            vehicle:
                selectedVehicle,

            inVehicle:
                selectedVehicle !== "walk"
        }
    });
}


/* =========================================================
   CAMÉRA 3D
========================================================= */

function updateCamera() {

    if (!camera || !playerObject) {
        return;
    }

    const target =
        playerObject.position;

    const x =
        target.x +
        Math.sin(cameraAngle) *
        cameraDistance;

    const z =
        target.z +
        Math.cos(cameraAngle) *
        cameraDistance;

    camera.position.x +=
        (x - camera.position.x) *
        .12;

    camera.position.y +=
        (7 - camera.position.y) *
        .12;

    camera.position.z +=
        (z - camera.position.z) *
        .12;

    camera.lookAt(
        target.x,
        target.y + 1,
        target.z
    );
}


function setupCameraControls() {

    const canvas =
        $("gameCanvas");

    if (!canvas) return;

    canvas.addEventListener(
        "pointerdown",
        event => {

            cameraTouching = true;
            lastCameraX =
                event.clientX;

            try {
                canvas.setPointerCapture(
                    event.pointerId
                );
            } catch {}
        }
    );

    canvas.addEventListener(
        "pointermove",
        event => {

            if (!cameraTouching) {
                return;
            }

            const dx =
                event.clientX -
                lastCameraX;

            lastCameraX =
                event.clientX;

            cameraAngle -=
                dx * .008;
        }
    );

    canvas.addEventListener(
        "pointerup",
        () => {
            cameraTouching = false;
        }
    );

    canvas.addEventListener(
        "pointercancel",
        () => {
            cameraTouching = false;
        }
    );
}


/* =========================================================
   ANIMATION
========================================================= */

function animate3D() {

    requestAnimationFrame(
        animate3D
    );

    if (!renderer || !scene || !camera) {
        return;
    }

    const delta =
        Math.min(
            clock.getDelta(),
            .05
        );

    if (gameStarted) {

        updatePlayer(delta);

        updateCamera();
    }

    renderer.render(
        scene,
        camera
    );
}


/* =========================================================
   RESIZE
========================================================= */

function resize3D() {

    if (!camera || !renderer) {
        return;
    }

    camera.aspect =
        window.innerWidth /
        window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
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
            clientX - centerX;

        let dy =
            clientY - centerY;

        const max =
            rect.width / 2 -
            10;

        const distance =
            Math.sqrt(
                dx * dx +
                dy * dy
            );

        if (distance > max) {

            dx =
                dx /
                distance *
                max;

            dy =
                dy /
                distance *
                max;
        }

        joystickX =
            dx / max;

        joystickY =
            dy / max;

        stick.style.transform =
            `translate(${dx}px,${dy}px)`;
    }


    function reset() {

        active = false;

        joystickX = 0;
        joystickY = 0;

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

    joystick.addEventListener(
        "lostpointercapture",
        reset
    );
}


/* =========================================================
   CARTE 2D
   La carte sert à visualiser le spawn.
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
        window.innerWidth *
        window.devicePixelRatio;

    canvas.height =
        window.innerHeight *
        window.devicePixelRatio;

    canvas.style.width =
        window.innerWidth + "px";

    canvas.style.height =
        window.innerHeight + "px";

    ctx.scale(
        window.devicePixelRatio,
        window.devicePixelRatio
    );

    const w =
        window.innerWidth;

    const h =
        window.innerHeight;

    ctx.fillStyle =
        "#203229";

    ctx.fillRect(
        0,
        0,
        w,
        h
    );

    ctx.save();

    ctx.translate(
        w / 2,
        h / 2
    );

    ctx.scale(
        mapZoom,
        mapZoom
    );

    ctx.strokeStyle =
        "#555";

    ctx.lineWidth =
        16;

    for (
        let x = -1000;
        x <= 1000;
        x += 180
    ) {

        ctx.beginPath();

        ctx.moveTo(
            x,
            -1000
        );

        ctx.lineTo(
            x,
            1000
        );

        ctx.stroke();
    }

    for (
        let y = -1000;
        y <= 1000;
        y += 180
    ) {

        ctx.beginPath();

        ctx.moveTo(
            -1000,
            y
        );

        ctx.lineTo(
            1000,
            y
        );

        ctx.stroke();
    }

    ctx.fillStyle =
        "#ff3030";

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

    mapZoom =
        Math.max(
            .5,
            Math.min(
                4,
                mapZoom + amount
            )
        );

    drawMap();
}


function setupMapTouch() {

    const canvas =
        $("mapCanvas");

    if (!canvas) return;

    let distanceStart =
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

                distanceStart =
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
                distanceStart === null
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

            const diff =
                distance -
                distanceStart;

            if (
                Math.abs(diff) > 5
            ) {

                mapZoom +=
                    diff > 0
                        ? .04
                        : -.04;

                mapZoom =
                    Math.max(
                        .5,
                        Math.min(
                            4,
                            mapZoom
                        )
                    );

                distanceStart =
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
            distanceStart = null;
        },
        {
            passive: true
        }
    );
}


/* =========================================================
   GARAGE
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
                VEHICLE_NAMES[vehicle] ||
                vehicle;

            button.onclick =
                () => {

                    selectedVehicle =
                        vehicle;

                    renderGarage();

                    updateHUD();
                };

            container.appendChild(
                button
            );
        }
    );
}


function useVehicle() {

    updateHUD();

    hide("garageScreen");

    show("mainMenu");
}


/* =========================================================
   BOUTIQUE
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
   REMOTE PLAYERS 3D
========================================================= */

function createRemotePlayer(player) {

    if (!scene) return;

    if (
        player.id ===
        currentPlayerId
    ) {
        return;
    }

    if (
        remoteObjects[player.id]
    ) {
        return;
    }

    const mesh =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                1.8,
                1.5,
                3
            ),
            new THREE.MeshStandardMaterial({
                color: 0xff4444
            })
        );

    mesh.position.set(
        player.x || 0,
        .8,
        player.z || 0
    );

    scene.add(mesh);

    remoteObjects[player.id] =
        mesh;
}


function updateRemoteObject(player) {

    if (
        player.id ===
        currentPlayerId
    ) {
        return;
    }

    createRemotePlayer(player);

    const object =
        remoteObjects[player.id];

    if (!object) return;

    object.position.x =
        Number(player.x) || 0;

    object.position.z =
        Number(player.z) || 0;

    object.rotation.y =
        Number(player.rotation) || 0;
}


function removeRemotePlayer(id) {

    const object =
        remoteObjects[id];

    if (!object) return;

    scene.remove(object);

    delete remoteObjects[id];
}


/* =========================================================
   ROOM QUIT
========================================================= */

function leaveRoom() {

    if (socket) {
        socket.close();
    }

    currentRoom = null;
    currentPlayerId = null;
    players = {};

    connected = false;

    setTimeout(
        connectServer,
        500
    );

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
   LOGOUT
========================================================= */

function logout() {

    currentUser = null;
    loggedIn = false;

    currentRoom = null;
    currentPlayerId = null;

    players = {};

    gameStarted = false;

    hide("gameHud");
    hide("settingsScreen");

    show("authScreen");

    $("usernameInput").value = "";
    $("passwordInput").value = "";

    authMessage(
        "Tu es déconnecté."
    );
}


/* =========================================================
   SCREENS
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
   EVENTS
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

async function init() {

    console.log(
        "🚗 RoadGame V6 3D"
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

    setLoadingProgress(10);

    setLoadingText(
        "🚗 Initialisation..."
    );

    setupEvents();
    setupScreens();
    setupJoystick();
    setupMapTouch();

    setLoadingProgress(30);

    setLoadingText(
        "🌐 Connexion au serveur..."
    );

    /*
      Important :
      le chargement du jeu ne dépend PAS
      du serveur WebSocket.
    */

    connectServer();

    setLoadingProgress(70);

    setLoadingText(
        "🎮 Moteur 3D prêt"
    );

    /*
      On ne bloque plus à 90 %.
    */

    setTimeout(() => {

        setLoadingProgress(100);

        setLoadingText(
            "✅ RoadGame prêt !"
        );

        setTimeout(() => {

            hide("loadingScreen");

            show("authScreen");

        }, 250);

    }, 350);
}


/* =========================================================
   CLAVIER
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter" &&
            !$("authScreen")
                ?.classList
                .contains("hidden")
        ) {

            loginAccount();
        }

        if (
            event.key === "Escape"
        ) {

            if (
                !$("mapScreen")
                    ?.classList
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
