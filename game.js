"use strict";

/* =========================================================
   ROADGAME V4
   3D + THREE.JS + OPENSTREETMAP + MULTIJOUEUR
========================================================= */


/* =========================================================
   SERVEUR
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

let selectedVehicle = "car";

let players = {};

let gameStarted = false;

let loadingProgress = 0;

let spawnLocation = {
    latitude: 48.8566,
    longitude: 2.3522,
    name: "Paris, France"
};


/* =========================================================
   THREE.JS
========================================================= */

let renderer = null;
let scene = null;
let camera = null;

let clock = null;

let localVehicle = null;
let localVehicleBody = null;

let remoteObjects = {};

let worldReady = false;


/* =========================================================
   CAMÉRA
========================================================= */

let cameraYaw = 0;
let cameraPitch = 0.38;

let cameraDistance = 8;

let cameraTouching = false;
let cameraLastX = 0;
let cameraLastY = 0;


/* =========================================================
   JOYSTICK
========================================================= */

let joystickActive = false;

let joystickX = 0;
let joystickY = 0;


/* =========================================================
   VITESSE
========================================================= */

let vehicleSpeed = 0;

const MAX_SPEED = 0.75;
const ACCELERATION = 0.018;
const BRAKE = 0.035;
const FRICTION = 0.92;

let steering = 0;


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

    const div =
        document.createElement("div");

    div.textContent = message;

    div.style.background =
        "rgba(0,0,0,.8)";

    div.style.color =
        "white";

    div.style.padding =
        "12px 18px";

    div.style.marginBottom =
        "8px";

    div.style.borderRadius =
        "12px";

    div.style.textAlign =
        "center";

    container.appendChild(div);

    setTimeout(() => {

        div.remove();

    }, 3500);
}


/* =========================================================
   AUTH MESSAGE
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
            Math.min(100, value)
        );

    const fill =
        $("loadingFill");

    if (fill) {
        fill.style.width =
            loadingProgress + "%";
    }

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
        element.textContent = text;
    }
}


/* =========================================================
   CONNEXION SERVEUR
========================================================= */

function connectServer() {

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

        connected = false;

        setLoadingText(
            "Serveur indisponible — mode local disponible."
        );

        setTimeout(() => {

            hide("loadingScreen");
            show("authScreen");

        }, 700);

        return;
    }


    socket.addEventListener(
        "open",
        () => {

            connected = true;

            setLoadingProgress(100);

            setLoadingText(
                "Serveur connecté !"
            );

            setTimeout(() => {

                hide("loadingScreen");
                show("authScreen");

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

                return;
            }

            handleServerMessage(data);
        }
    );


    socket.addEventListener(
        "close",
        () => {

            connected = false;

            if (!gameStarted) {

                setLoadingText(
                    "Serveur déconnecté."
                );
            }
        }
    );


    socket.addEventListener(
        "error",
        error => {

            console.warn(
                "WebSocket:",
                error
            );

            connected = false;

            if (!gameStarted) {

                setTimeout(() => {

                    hide("loadingScreen");
                    show("authScreen");

                    authMessage(
                        "Serveur indisponible. Tu peux jouer en invité."
                    );

                }, 500);
            }
        }
    );


    /* sécurité : le chargement ne reste jamais bloqué */

    setTimeout(() => {

        if (!connected &&
            !$("loadingScreen").classList.contains("hidden")) {

            hide("loadingScreen");
            show("authScreen");

            authMessage(
                "Le serveur met trop de temps à répondre. Tu peux jouer en invité."
            );
        }

    }, 7000);
}


/* =========================================================
   SEND
========================================================= */

function send(data) {

    if (!socket) {
        return false;
    }

    if (
        socket.readyState !==
        WebSocket.OPEN
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

            currentUser =
                data.user;

            loggedIn = true;

            selectedVehicle =
                currentUser.selectedVehicle ||
                "car";

            authMessage(
                "Compte créé !",
                true
            );

            openMainMenu();

            break;


        case "login_success":

            currentUser =
                data.user;

            loggedIn = true;

            selectedVehicle =
                currentUser.selectedVehicle ||
                "car";

            authMessage(
                "Connexion réussie !",
                true
            );

            openMainMenu();

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

            notify(
                "✅ Pseudo modifié"
            );

            break;


        case "room_created":
        case "room_joined":
        case "quick_match_found":

            enterRoom(data);

            break;


        case "quick_match_searching":

            setText(
                "multiplayerMessage",
                "Recherche d'une partie..."
            );

            break;


        case "player_joined":

            addPlayer(
                data.player
            );

            break;


        case "player_left":

            delete players[
                data.playerId
            ];

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

            updateRemoteVehicle(
                data
            );

            break;


        case "vehicle_enter":

            updateRemoteVehicle(
                data
            );

            break;


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

            currentUser =
                data.user;

            renderFriends();

            break;
    }
}


/* =========================================================
   ERREUR
========================================================= */

function handleServerError(message) {

    if (
        $("authScreen") &&
        !$("authScreen")
            .classList
            .contains("hidden")
    ) {

        authMessage(message);

        return;
    }

    if ($("multiplayerMessage")) {

        $("multiplayerMessage")
            .textContent =
            message;
    }

    notify(
        "❌ " + message
    );
}


/* =========================================================
   INSCRIPTION
========================================================= */

function registerAccount() {

    if (!connected) {

        authMessage(
            "Serveur non connecté. Utilise le mode invité ou réessaie."
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


/* =========================================================
   CONNEXION
========================================================= */

function loginAccount() {

    if (!connected) {

        authMessage(
            "Serveur non connecté."
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
    hide("multiplayerScreen");
    hide("privateRoomScreen");
    hide("roomScreen");
    hide("garageScreen");
    hide("shopScreen");
    hide("friendsScreen");
    hide("settingsScreen");
    hide("usernameScreen");
    hide("pauseScreen");

    show("mainMenu");

    setText(
        "welcomeText",
        "Bienvenue " +
        currentUser.username
    );

    renderGarage();
    renderShop();
    renderFriends();
}


/* =========================================================
   ADRESSE OPENSTREETMAP
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

    if (!query) {

        result.textContent =
            "Écris une ville ou une adresse.";

        return;
    }

    result.textContent =
        "🔎 Recherche de l'adresse...";

    try {

        const url =
            "https://nominatim.openstreetmap.org/search" +
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

        result.innerHTML = "";

        if (!results.length) {

            result.textContent =
                "❌ Adresse introuvable.";

            return;
        }

        results.forEach(item => {

            const button =
                document.createElement(
                    "button"
                );

            button.className =
                "addressChoice";

            button.style.width =
                "100%";

            button.style.textAlign =
                "left";

            button.textContent =
                "📍 " +
                item.display_name;

            button.addEventListener(
                "click",
                () => {

                    const latitude =
                        Number(item.lat);

                    const longitude =
                        Number(item.lon);

                    if (
                        !Number.isFinite(latitude) ||
                        !Number.isFinite(longitude)
                    ) {
                        return;
                    }

                    spawnLocation = {

                        latitude,

                        longitude,

                        name:
                            item.display_name
                    };

                    result.innerHTML =
                        "✅ Spawn sélectionné :<br>" +
                        item.display_name;

                    notify(
                        "📍 Spawn sélectionné !"
                    );

                    saveSpawnLocation();

                }
            );

            result.appendChild(
                button
            );
        });

    } catch (error) {

        console.error(error);

        result.textContent =
            "❌ Impossible de rechercher l'adresse. Vérifie ta connexion.";
    }
}


/* =========================================================
   SAUVEGARDE LOCAL DU SPAWN
========================================================= */

function saveSpawnLocation() {

    try {

        localStorage.setItem(
            "roadgame_spawn",
            JSON.stringify(
                spawnLocation
            )
        );

    } catch {}
}


function loadSpawnLocation() {

    try {

        const data =
            localStorage.getItem(
                "roadgame_spawn"
            );

        if (!data) {
            return;
        }

        const parsed =
            JSON.parse(data);

        if (
            Number.isFinite(parsed.latitude) &&
            Number.isFinite(parsed.longitude)
        ) {

            spawnLocation =
                parsed;
        }

    } catch {}
}


/* =========================================================
   MULTIJOUEUR
========================================================= */

function openMultiplayer() {

    hide("mainMenu");

    show("multiplayerScreen");

    $("multiplayerMessage").textContent =
        "";
}


function createPublicRoom() {

    if (!connected) {

        notify(
            "Serveur non connecté."
        );

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


function quickMatch() {

    if (!connected) {

        notify(
            "Serveur non connecté."
        );

        return;
    }

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


function openPrivateRoom() {

    hide("multiplayerScreen");

    show("privateRoomScreen");
}


function createPrivateRoom() {

    const password =
        $("privatePasswordInput")
            .value;

    if (!password) {

        $("privateRoomMessage")
            .textContent =
            "Entre un mot de passe.";

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

    const code =
        $("roomCodeInput")
            .value
            .trim()
            .toUpperCase();

    const password =
        $("roomPasswordInput")
            .value;

    if (code.length !== 6) {

        $("multiplayerMessage")
            .textContent =
            "Le code doit contenir 6 caractères.";

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


/* =========================================================
   ROOM
========================================================= */

function enterRoom(data) {

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


/* =========================================================
   JOUEURS
========================================================= */

function addPlayer(player) {

    if (!player) {
        return;
    }

    players[player.id] =
        player;

    refreshPlayersList();

    if (
        gameStarted &&
        player.id !== currentPlayerId
    ) {

        createRemotePlayer(
            player
        );
    }
}


function updateRemotePlayer(player) {

    if (!player) {
        return;
    }

    players[player.id] =
        player;

    if (
        gameStarted &&
        player.id !== currentPlayerId
    ) {

        updateRemoteObject(
            player
        );
    }

    refreshPlayersList();
}


function updateRemoteVehicle(data) {

    const player =
        players[data.playerId];

    if (!player) {
        return;
    }

    player.vehicle =
        data.vehicle;

    player.inVehicle =
        data.inVehicle;

    if (
        remoteObjects[data.playerId]
    ) {

        setRemoteVehicleAppearance(
            remoteObjects[data.playerId],
            data.vehicle
        );
    }
}


/* =========================================================
   LISTE JOUEURS
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

            div.textContent =
                player.name +
                (
                    player.inVehicle
                        ? " — 🚗 " +
                          player.vehicle
                        : " — 🚶 À pied"
                );

            list.appendChild(div);
        });
}


/* =========================================================
   THREE.JS INITIALISATION
========================================================= */

function init3D() {

    if (renderer) {
        return;
    }

    const canvas =
        $("gameCanvas");

    renderer =
        new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            powerPreference: "high-performance"
        });

    renderer.setPixelRatio(
        Math.min(
            window.devicePixelRatio || 1,
            2
        )
    );

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.shadowMap.enabled = true;

    scene =
        new THREE.Scene();

    scene.background =
        new THREE.Color(0x87ceeb);

    camera =
        new THREE.PerspectiveCamera(
            60,
            window.innerWidth /
            window.innerHeight,
            0.1,
            2000
        );

    camera.position.set(
        0,
        6,
        10
    );

    clock =
        new THREE.Clock();

    createLighting();

    createWorld();

    createLocalVehicle();

    window.addEventListener(
        "resize",
        resize3D
    );

    animate3D();

    worldReady = true;
}


/* =========================================================
   LUMIÈRES
========================================================= */

function createLighting() {

    const ambient =
        new THREE.HemisphereLight(
            0xffffff,
            0x557755,
            2
        );

    scene.add(ambient);

    const sun =
        new THREE.DirectionalLight(
            0xffffff,
            2.5
        );

    sun.position.set(
        100,
        150,
        80
    );

    sun.castShadow = true;

    sun.shadow.mapSize.width =
        2048;

    sun.shadow.mapSize.height =
        2048;

    scene.add(sun);
}


/* =========================================================
   MONDE 3D
========================================================= */

function createWorld() {

    /* SOL HERBE */

    const grassGeometry =
        new THREE.PlaneGeometry(
            1000,
            1000
        );

    const grassMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x3f8f3f,
            roughness: 1
        });

    const grass =
        new THREE.Mesh(
            grassGeometry,
            grassMaterial
        );

    grass.rotation.x =
        -Math.PI / 2;

    grass.receiveShadow = true;

    scene.add(grass);


    /* ROUTES */

    createRoad(
        0,
        0,
        1000,
        18,
        false
    );

    createRoad(
        0,
        0,
        18,
        1000,
        true
    );


    /* ROUTES SECONDAIRES */

    createRoad(
        0,
        150,
        1000,
        12,
        false
    );

    createRoad(
        150,
        0,
        12,
        1000,
        true
    );


    /* BÂTIMENTS */

    for (
        let x = -250;
        x <= 250;
        x += 50
    ) {

        for (
            let z = -250;
            z <= 250;
            z += 50
        ) {

            if (
                Math.abs(x) < 30 ||
                Math.abs(z) < 30
            ) {
                continue;
            }

            createBuilding(
                x,
                z
            );
        }
    }


    /* ARBRES */

    for (
        let i = 0;
        i < 120;
        i++
    ) {

        const x =
            THREE.MathUtils.randFloatSpread(
                800
            );

        const z =
            THREE.MathUtils.randFloatSpread(
                800
            );

        if (
            Math.abs(x) < 30 ||
            Math.abs(z) < 30
        ) {
            continue;
        }

        createTree(
            x,
            z
        );
    }
}


/* =========================================================
   ROUTE
========================================================= */

function createRoad(
    x,
    z,
    width,
    depth,
    vertical
) {

    const geometry =
        new THREE.BoxGeometry(
            vertical
                ? width
                : depth,
            0.08,
            vertical
                ? depth
                : width
        );

    const material =
        new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: .9
        });

    const road =
        new THREE.Mesh(
            geometry,
            material
        );

    road.position.set(
        x,
        0.04,
        z
    );

    road.receiveShadow = true;

    scene.add(road);


    /* lignes */

    const lineMaterial =
        new THREE.MeshBasicMaterial({
            color: 0xffffff
        });

    if (!vertical) {

        for (
            let px = x - 450;
            px <= x + 450;
            px += 25
        ) {

            const line =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        12,
                        .03,
                        .35
                    ),
                    lineMaterial
                );

            line.position.set(
                px,
                .11,
                z
            );

            scene.add(line);
        }

    } else {

        for (
            let pz = z - 450;
            pz <= z + 450;
            pz += 25
        ) {

            const line =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        .35,
                        .03,
                        12
                    ),
                    lineMaterial
                );

            line.position.set(
                x,
                .11,
                pz
            );

            scene.add(line);
        }
    }
}


/* =========================================================
   BÂTIMENT
========================================================= */

function createBuilding(x, z) {

    const width =
        THREE.MathUtils.randFloat(
            12,
            25
        );

    const depth =
        THREE.MathUtils.randFloat(
            12,
            25
        );

    const height =
        THREE.MathUtils.randFloat(
            7,
            25
        );

    const geometry =
        new THREE.BoxGeometry(
            width,
            height,
            depth
        );

    const material =
        new THREE.MeshStandardMaterial({
            color:
                new THREE.Color()
                    .setHSL(
                        Math.random(),
                        .25,
                        .45
                    )
        });

    const building =
        new THREE.Mesh(
            geometry,
            material
        );

    building.position.set(
        x,
        height / 2,
        z
    );

    building.castShadow = true;
    building.receiveShadow = true;

    scene.add(building);
}


/* =========================================================
   ARBRE
========================================================= */

function createTree(x, z) {

    const trunk =
        new THREE.Mesh(
            new THREE.CylinderGeometry(
                .45,
                .55,
                4,
                8
            ),
            new THREE.MeshStandardMaterial({
                color: 0x6b4423
            })
        );

    trunk.position.set(
        x,
        2,
        z
    );

    trunk.castShadow = true;

    scene.add(trunk);


    const crown =
        new THREE.Mesh(
            new THREE.SphereGeometry(
                2.8,
                10,
                8
            ),
            new THREE.MeshStandardMaterial({
                color: 0x2f7d32
            })
        );

    crown.position.set(
        x,
        5.2,
        z
    );

    crown.castShadow = true;

    scene.add(crown);
}


/* =========================================================
   VOITURE 3D
========================================================= */

function createCarMesh(color = 0x1976d2) {

    const group =
        new THREE.Group();


    /* carrosserie */

    const body =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                2.2,
                .65,
                4.2
            ),
            new THREE.MeshStandardMaterial({
                color
            })
        );

    body.position.y =
        .75;

    body.castShadow = true;

    group.add(body);


    /* toit */

    const roof =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                1.65,
                .55,
                1.9
            ),
            new THREE.MeshStandardMaterial({
                color:
                    0x222222
            })
        );

    roof.position.y =
        1.3;

    roof.position.z =
        -.15;

    roof.castShadow = true;

    group.add(roof);


    /* roues */

    const wheelMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x111111
        });

    const wheelGeometry =
        new THREE.CylinderGeometry(
            .38,
            .38,
            .28,
            16
        );

    const wheelPositions = [
        [-1.05,.45,1.35],
        [1.05,.45,1.35],
        [-1.05,.45,-1.35],
        [1.05,.45,-1.35]
    ];

    wheelPositions.forEach(
        position => {

            const wheel =
                new THREE.Mesh(
                    wheelGeometry,
                    wheelMaterial
                );

            wheel.rotation.z =
                Math.PI / 2;

            wheel.position.set(
                position[0],
                position[1],
                position[2]
            );

            wheel.castShadow = true;

            group.add(wheel);
        }
    );

    return group;
}


/* =========================================================
   CRÉER VOITURE LOCALE
========================================================= */

function createLocalVehicle() {

    localVehicle =
        createCarMesh();

    localVehicle.position.set(
        0,
        0,
        0
    );

    scene.add(
        localVehicle
    );

    localVehicleBody =
        localVehicle;
}


/* =========================================================
   SPAWN 3D
========================================================= */

function spawnAtAddress() {

    if (!localVehicle) {
        return;
    }

    /*
       La position GPS sert de point de départ.
       On crée une origine locale autour de l'adresse.
    */

    localVehicle.position.set(
        0,
        0,
        0
    );

    localVehicle.rotation.y =
        0;

    vehicleSpeed = 0;

    cameraYaw = 0;

    cameraPitch = .38;

    notify(
        "📍 Spawn : " +
        spawnLocation.name
    );

    updateCamera(true);
}


/* =========================================================
   DÉMARRER JEU
========================================================= */

function startGame() {

    gameStarted = true;

    hide("mainMenu");
    hide("roomScreen");
    hide("pauseScreen");

    show("gameHud");

    init3D();

    spawnAtAddress();

    /*
       Envoie les coordonnées réelles
       au serveur.
    */

    send({
        type: "player_update",

        latitude:
            spawnLocation.latitude,

        longitude:
            spawnLocation.longitude,

        rotation: 0
    });

    updateHUD();
}


/* =========================================================
   ANIMATION 3D
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

    updateVehicle(delta);

    updateCamera(false);

    updateRemoteAnimations();

    renderer.render(
        scene,
        camera
    );
}


/* =========================================================
   CONDUITE
========================================================= */

function updateVehicle(delta) {

    if (
        !gameStarted ||
        !localVehicle
    ) {
        return;
    }

    const forward =
        -joystickY;

    const turn =
        joystickX;


    if (forward > .08) {

        vehicleSpeed +=
            ACCELERATION;

    } else if (forward < -.08) {

        vehicleSpeed -=
            BRAKE;

    } else {

        vehicleSpeed *=
            FRICTION;
    }


    vehicleSpeed =
        THREE.MathUtils.clamp(
            vehicleSpeed,
            -MAX_SPEED * .35,
            MAX_SPEED
        );


    steering =
        THREE.MathUtils.lerp(
            steering,
            turn,
            .15
        );


    localVehicle.rotation.y -=
        steering *
        Math.abs(vehicleSpeed) *
        0.055;


    const direction =
        new THREE.Vector3(
            0,
            0,
            -1
        );

    direction.applyQuaternion(
        localVehicle.quaternion
    );

    localVehicle.position.addScaledVector(
        direction,
        vehicleSpeed *
        delta *
        60
    );


    /* limite monde */

    localVehicle.position.x =
        THREE.MathUtils.clamp(
            localVehicle.position.x,
            -480,
            480
        );

    localVehicle.position.z =
        THREE.MathUtils.clamp(
            localVehicle.position.z,
            -480,
            480
        );


    /* envoi multijoueur */

    if (
        connected &&
        currentPlayerId &&
        Math.abs(vehicleSpeed) > .001
    ) {

        send({
            type:
                "player_update",

            latitude:
                spawnLocation.latitude,

            longitude:
                spawnLocation.longitude,

            rotation:
                localVehicle.rotation.y
        });
    }
}


/* =========================================================
   CAMÉRA
========================================================= */

function updateCamera(force = false) {

    if (
        !camera ||
        !localVehicle
    ) {
        return;
    }

    const target =
        localVehicle.position.clone();

    target.y += 1.1;


    const offset =
        new THREE.Vector3(
            Math.sin(cameraYaw) *
            cameraDistance,

            cameraDistance *
            Math.sin(cameraPitch),

            Math.cos(cameraYaw) *
            cameraDistance
        );


    const desired =
        target.clone()
            .add(offset);


    if (force) {

        camera.position.copy(
            desired
        );

    } else {

        camera.position.lerp(
            desired,
            .12
        );
    }


    camera.lookAt(
        target
    );
}


/* =========================================================
   CAMÉRA AU DOIGT
========================================================= */

function setupCameraTouch() {

    const canvas =
        $("gameCanvas");

    if (!canvas) {
        return;
    }

    canvas.addEventListener(
        "pointerdown",
        event => {

            /*
               Le côté gauche est réservé
               au joystick.
            */

            if (
                event.clientX <
                window.innerWidth * .45
            ) {
                return;
            }

            cameraTouching = true;

            cameraLastX =
                event.clientX;

            cameraLastY =
                event.clientY;

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
                cameraLastX;

            const dy =
                event.clientY -
                cameraLastY;

            cameraLastX =
                event.clientX;

            cameraLastY =
                event.clientY;


            cameraYaw -=
                dx * .008;

            cameraPitch -=
                dy * .006;


            cameraPitch =
                THREE.MathUtils.clamp(
                    cameraPitch,
                    .08,
                    1.05
                );
        }
    );


    const stop =
        () => {

            cameraTouching =
                false;
        };


    canvas.addEventListener(
        "pointerup",
        stop
    );

    canvas.addEventListener(
        "pointercancel",
        stop
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

    function update(
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
            10;

        const distance =
            Math.hypot(dx,dy);

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

        joystickActive =
            false;

        joystickX = 0;
        joystickY = 0;

        stick.style.transform =
            "translate(0,0)";
    }


    joystick.addEventListener(
        "pointerdown",
        event => {

            joystickActive =
                true;

            try {

                joystick.setPointerCapture(
                    event.pointerId
                );

            } catch {}

            update(
                event.clientX,
                event.clientY
            );
        }
    );


    joystick.addEventListener(
        "pointermove",
        event => {

            if (!joystickActive) {
                return;
            }

            update(
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
        currentUser
            ? currentUser.vehicles || ["car"]
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
        }
    );
}


function useVehicle() {

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
                "<br>✅ Possédé";

        } else {

            const button =
                document.createElement(
                    "button"
                );

            button.textContent =
                "Acheter";

            button.style.marginTop =
                "10px";

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

    const input =
        $("friendUsernameInput");

    if (!input) {
        return;
    }

    const username =
        input.value.trim();

    if (!username) {
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

    const requests =
        $("friendRequestsList");

    const friends =
        $("friendsList");

    if (requests) {

        requests.innerHTML =
            "<p>Aucune demande.</p>";
    }

    if (friends) {

        friends.innerHTML =
            "<p>Aucun ami.</p>";
    }
}


/* =========================================================
   SETTINGS
========================================================= */

function saveSettings() {

    const sound =
        $("soundToggle")
            ? $("soundToggle").checked
            : true;

    const music =
        $("musicToggle")
            ? $("musicToggle").checked
            : true;

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
        return;
    }

    send({

        type:
            "change_username",

        username
    });
}


/* =========================================================
   MAP LEAFLET
========================================================= */

let leafletMap = null;
let leafletMarker = null;


function openMap() {

    show("mapScreen");

    setTimeout(() => {

        if (!leafletMap) {

            leafletMap =
                L.map(
                    "map",
                    {
                        zoomControl: true,
                        touchZoom: true
                    }
                );

            L.tileLayer(
                "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                {
                    maxZoom: 19,
                    attribution:
                        "© OpenStreetMap contributors"
                }
            ).addTo(
                leafletMap
            );
        }

        leafletMap.setView(
            [
                spawnLocation.latitude,
                spawnLocation.longitude
            ],
            15
        );


        if (leafletMarker) {

            leafletMarker.setLatLng([
                spawnLocation.latitude,
                spawnLocation.longitude
            ]);

        } else {

            leafletMarker =
                L.marker([
                    spawnLocation.latitude,
                    spawnLocation.longitude
                ])
                .addTo(
                    leafletMap
                )
                .bindPopup(
                    "📍 Ton spawn"
                );
        }

        leafletMap.invalidateSize();

    }, 100);
}


function closeMap() {

    hide("mapScreen");
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
   ENTRER / SORTIR
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
   MULTIJOUEUR 3D
========================================================= */

function createRemotePlayer(player) {

    if (
        !scene ||
        remoteObjects[player.id]
    ) {
        return;
    }

    const object =
        createCarMesh(
            0xff4444
        );

    object.position.set(
        player.longitude -
        spawnLocation.longitude,
        0,
        player.latitude -
        spawnLocation.latitude
    );

    object.scale.set(
        .8,
        .8,
        .8
    );

    scene.add(
        object
    );

    remoteObjects[player.id] =
        object;
}


function updateRemoteObject(player) {

    if (!remoteObjects[player.id]) {

        createRemotePlayer(
            player
        );
    }

    const object =
        remoteObjects[player.id];

    if (!object) {
        return;
    }

    const x =
        (
            player.longitude -
            spawnLocation.longitude
        ) * 100000;

    const z =
        -(
            player.latitude -
            spawnLocation.latitude
        ) * 100000;


    /*
       Conversion simplifiée GPS -> monde 3D.
    */

    object.position.x =
        THREE.MathUtils.clamp(
            x,
            -450,
            450
        );

    object.position.z =
        THREE.MathUtils.clamp(
            z,
            -450,
            450
        );

    if (
        Number.isFinite(
            player.rotation
        )
    ) {

        object.rotation.y =
            player.rotation;
    }
}


function setRemoteVehicleAppearance(
    object,
    vehicle
) {

    if (!object) {
        return;
    }

    const colors = {

        car: 0xff4444,
        truck: 0xffaa22,
        bus: 0x8844ff,
        plane: 0xffffff,
        boat: 0x22aaff,
        walk: 0xffffff
    };

    object.traverse(
        child => {

            if (
                child.isMesh &&
                child.material &&
                child.material.color
            ) {

                child.material.color.set(
                    colors[vehicle] ||
                    0xff4444
                );
            }
        }
    );
}


function removeRemotePlayer(id) {

    const object =
        remoteObjects[id];

    if (!object) {
        return;
    }

    scene.remove(
        object
    );

    delete remoteObjects[id];
}


function updateRemoteAnimations() {

    /* réservé aux animations futures */
}


/* =========================================================
   RESIZE
========================================================= */

function resize3D() {

    if (
        !renderer ||
        !camera
    ) {
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
   QUITTER ROOM
========================================================= */

function leaveRoom() {

    currentRoom = null;
    currentPlayerId = null;

    players = {};

    hide("roomScreen");

    show("mainMenu");

    notify(
        "Partie quittée."
    );
}


/* =========================================================
   LOGOUT
========================================================= */

function logout() {

    currentUser = null;

    loggedIn = false;

    gameStarted = false;

    hide("mainMenu");
    hide("gameHud");

    show("authScreen");

    $("usernameInput").value =
        "";

    $("passwordInput").value =
        "";

    authMessage(
        "Déconnecté."
    );
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


    $("spawnVehicleButton")
        ?.addEventListener(
            "click",
            useVehicle
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


    setupCameraTouch();
    setupJoystick();
}


/* =========================================================
   CLAVIER
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape" &&
            gameStarted
        ) {

            openPause();
        }
    }
);


/* =========================================================
   INITIALISATION
========================================================= */

function init() {

    console.log(
        "🚗 RoadGame démarrage..."
    );

    setLoadingProgress(5);

    setLoadingText(
        "Préparation de RoadGame..."
    );

    loadSpawnLocation();

    setupEvents();

    setupScreens();


    /*
       Initialisation 3D immédiatement.
       Cela évite de rester bloqué à 90%.
    */

    try {

        init3D();

        setLoadingProgress(50);

        setLoadingText(
            "Moteur 3D prêt..."
        );

    } catch (error) {

        console.error(
            "Erreur 3D:",
            error
        );

        setLoadingText(
            "Erreur du moteur 3D."
        );
    }


    setTimeout(() => {

        setLoadingProgress(70);

        connectServer();

    }, 150);
}


/* =========================================================
   DOM READY
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
