/* =========================================================
   ROADGAME V6
   - OpenStreetMap / Nominatim
   - Routes OSM en 3D
   - Bâtiments OSM en 3D
   - Spawn à l'adresse recherchée
   - Voiture 3D
   - Joystick tactile
   - Caméra 3e personne rotative
   - Carte 2D OSM simplifiée
   - Zoom tactile
   - Comptes
   - Multijoueur
   ========================================================= */

"use strict";

/* =========================================================
   SERVEUR ROADGAME
   ========================================================= */

const SERVER_URL = "wss://roadgame-server.onrender.com";

/* =========================================================
   OPENSTREETMAP
   ========================================================= */

const NOMINATIM_URL =
    "https://nominatim.openstreetmap.org/search";

const OVERPASS_SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
];

/*
   Rayon de génération.
   500 m = beaucoup plus rapide sur iPhone.
*/
const OSM_RADIUS = 500;


/* =========================================================
   VARIABLES SERVEUR
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


/* =========================================================
   POSITION OSM
   ========================================================= */

let spawnLocation = {
    lat: null,
    lon: null,
    displayName: ""
};

let spawnWorld = {
    x: 0,
    z: 0
};

let currentRoadAngle = 0;


/* =========================================================
   THREE.JS
   ========================================================= */

let THREE = null;

let scene = null;
let camera = null;
let renderer = null;

let gameContainer = null;

let roadGroup = null;
let buildingGroup = null;
let decorationGroup = null;

let playerCar = null;
let playerCarBody = null;

let threeReady = false;
let worldReady = false;


/* =========================================================
   JOUEUR
   ========================================================= */

let playerPosition = {
    x: 0,
    y: 0,
    z: 0
};

let playerRotation = 0;

let carSpeed = 0;

let joystickX = 0;
let joystickY = 0;

let cameraYaw = Math.PI;
let cameraPitch = 0.48;
let cameraDistance = 8;

let cameraTouchActive = false;
let cameraTouchId = null;
let cameraLastX = 0;
let cameraLastY = 0;


/* =========================================================
   CARTE
   ========================================================= */

let mapZoom = 1;

let mapFeatures = {
    roads: [],
    buildings: []
};


/* =========================================================
   CHARGEMENT
   ========================================================= */

let loadingProgress = 0;


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

    const container = $("notifications");

    if (!container) {
        console.log(message);
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

    if (!element) return;

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
   CHARGEMENT
   ========================================================= */

function setLoadingProgress(value) {

    loadingProgress =
        Math.max(
            0,
            Math.min(100, value)
        );

    const text = $("loadingText");

    if (text) {

        text.textContent =
            "Chargement... " +
            Math.round(loadingProgress) +
            "%";
    }

    const bar =
        $("loadingBar") ||
        $("progressBar") ||
        $("loadingProgress");

    if (bar) {

        if (
            bar.tagName === "PROGRESS"
        ) {

            bar.value =
                loadingProgress;

        } else {

            bar.style.width =
                loadingProgress + "%";
        }
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
                "🟢 RoadGame serveur connecté"
            );

            /*
               Important :
               Le chargement ne reste pas bloqué
               en attendant le serveur.
            */

            setTimeout(() => {

                if (
                    $("loadingScreen") &&
                    !$("loadingScreen")
                        .classList
                        .contains("hidden")
                ) {

                    hide("loadingScreen");
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

            /*
               Ne bloque jamais le jeu
               si Render dort ou répond lentement.
            */

            if (!gameStarted) {

                setTimeout(() => {

                    if (
                        !$("authScreen") ||
                        $("authScreen")
                            .classList
                            .contains("hidden")
                    ) {
                        return;
                    }

                }, 1000);
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
        }
    );
}


/* =========================================================
   ENVOI SERVEUR
   ========================================================= */

function send(data) {

    if (
        !socket ||
        socket.readyState !==
        WebSocket.OPEN
    ) {

        return false;
    }

    try {

        socket.send(
            JSON.stringify(data)
        );

        return true;

    } catch {

        return false;
    }
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

            if (data.player) {
                addPlayer(data.player);
            }

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

        case "friend_added":

            if (currentUser) {
                currentUser = data.user;
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
   ERREURS
   ========================================================= */

function handleServerError(message) {

    console.error(
        "Serveur:",
        message
    );

    authMessage(
        message
    );

    multiplayerMessage(
        message
    );

    privateMessage(
        message
    );

    usernameMessage(
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
            "Serveur indisponible. Tu peux réessayer."
        );

        /*
           On ne bloque plus le jeu
           sur le chargement.
        */

        connectServer();

        return;
    }

    const username =
        $("usernameInput")
            ?.value
            .trim();

    const password =
        $("passwordInput")
            ?.value || "";

    if (!username || username.length < 3) {

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
            "Serveur indisponible. Réessaie dans quelques secondes."
        );

        connectServer();

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
   ADRESSE
   ========================================================= */

function setupAddressSystem() {

    const button =
        $("searchAddressButton");

    const input =
        $("addressInput");

    if (!button || !input) {
        console.warn(
            "addressInput/searchAddressButton absent"
        );

        return;
    }

    button.addEventListener(
        "click",
        searchAddress
    );

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
}


async function searchAddress() {

    const input =
        $("addressInput");

    const result =
        $("addressResult");

    if (!input) return;

    const query =
        input.value.trim();

    if (!query) {

        if (result) {
            result.textContent =
                "Écris une ville ou une adresse.";
        }

        return;
    }

    if (result) {

        result.textContent =
            "🔎 Recherche de l'adresse...";
    }

    setLoadingText(
        "Recherche de l'adresse..."
    );

    setLoadingProgress(20);

    try {

        const url =
            new URL(
                NOMINATIM_URL
            );

        url.searchParams.set(
            "q",
            query
        );

        url.searchParams.set(
            "format",
            "jsonv2"
        );

        url.searchParams.set(
            "limit",
            "1"
        );

        url.searchParams.set(
            "addressdetails",
            "1"
        );

        const response =
            await fetch(
                url.toString(),
                {
                    headers: {
                        "Accept":
                            "application/json",
                        "Accept-Language":
                            "fr-FR,fr"
                    }
                }
            );

        if (!response.ok) {
            throw new Error(
                "Nominatim HTTP " +
                response.status
            );
        }

        const results =
            await response.json();

        if (
            !Array.isArray(results) ||
            !results.length
        ) {

            throw new Error(
                "Adresse introuvable"
            );
        }

        const location =
            results[0];

        spawnLocation.lat =
            Number(location.lat);

        spawnLocation.lon =
            Number(location.lon);

        spawnLocation.displayName =
            location.display_name ||
            query;

        localStorage.setItem(
            "roadgame_spawn",
            JSON.stringify(
                spawnLocation
            )
        );

        setLoadingProgress(35);

        if (result) {

            result.innerHTML =
                "📍 <b>" +
                escapeHTML(
                    spawnLocation.displayName
                ) +
                "</b><br>" +
                "<span>Adresse trouvée !</span>";
        }

        notify(
            "📍 Adresse trouvée !"
        );

        /*
           On génère immédiatement la zone 3D.
        */

        await generateOSMWorld();

    } catch (error) {

        console.error(
            "Erreur adresse:",
            error
        );

        if (result) {

            result.textContent =
                "❌ Impossible de trouver cette adresse.";
        }

        setLoadingText(
            "Adresse introuvable"
        );

        notify(
            "❌ Adresse introuvable."
        );
    }
}


/* =========================================================
   ÉCHAPPEMENT HTML
   ========================================================= */

function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================================================
   OUVERTURE JEU
   ========================================================= */

async function startGame() {

    gameStarted = true;

    hide("mainMenu");
    hide("roomScreen");
    hide("pauseScreen");

    show("gameHud");

    if (!threeReady) {

        await initThree();
    }

    /*
       Si aucune adresse n'a encore été choisie,
       on essaie de récupérer la dernière.
    */

    loadSavedSpawn();

    if (
        spawnLocation.lat !== null &&
        spawnLocation.lon !== null
    ) {

        await generateOSMWorld();

    } else {

        /*
           Pas d'adresse :
           petite scène vide propre,
           mais PAS de carrés.
        */

        createEmptyWorld();

        notify(
            "📍 Choisis une adresse pour générer la ville."
        );
    }

    updateHUD();
}


/* =========================================================
   CHARGEMENT DERNIÈRE ADRESSE
   ========================================================= */

function loadSavedSpawn() {

    try {

        const saved =
            localStorage.getItem(
                "roadgame_spawn"
            );

        if (!saved) {
            return;
        }

        const data =
            JSON.parse(saved);

        if (
            Number.isFinite(
                Number(data.lat)
            ) &&
            Number.isFinite(
                Number(data.lon)
            )
        ) {

            spawnLocation = {
                lat:
                    Number(data.lat),

                lon:
                    Number(data.lon),

                displayName:
                    data.displayName ||
                    ""
            };
        }

    } catch (error) {

        console.warn(
            "Spawn sauvegardé invalide",
            error
        );
    }
}


/* =========================================================
   THREE INITIALISATION
   ========================================================= */

async function initThree() {

    if (threeReady) {
        return;
    }

    setLoadingText(
        "Chargement du moteur 3D..."
    );

    setLoadingProgress(10);

    try {

        const module =
            await import(
                "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js"
            );

        THREE = module;

        threeReady = true;

        createThreeScene();

        setLoadingProgress(15);

    } catch (error) {

        console.error(
            "Three.js impossible à charger",
            error
        );

        notify(
            "❌ Impossible de charger le moteur 3D."
        );
    }
}


/* =========================================================
   SCÈNE THREE
   ========================================================= */

function createThreeScene() {

    gameContainer =
        $("game3D") ||
        $("gameContainer") ||
        $("gameCanvasContainer");

    if (!gameContainer) {

        gameContainer =
            document.createElement("div");

        gameContainer.id =
            "game3D";

        document.body.appendChild(
            gameContainer
        );
    }

    gameContainer.innerHTML = "";

    gameContainer.style.position =
        "fixed";

    gameContainer.style.inset =
        "0";

    gameContainer.style.overflow =
        "hidden";

    scene =
        new THREE.Scene();

    scene.background =
        new THREE.Color(
            0x87ceeb
        );

    scene.fog =
        new THREE.Fog(
            0x87ceeb,
            250,
            900
        );


    camera =
        new THREE.PerspectiveCamera(
            60,
            window.innerWidth /
            window.innerHeight,
            0.1,
            2000
        );


    renderer =
        new THREE.WebGLRenderer({
            antialias: true,
            powerPreference:
                "high-performance"
        });

    renderer.setPixelRatio(
        Math.min(
            window.devicePixelRatio || 1,
            1.5
        )
    );

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.shadowMap.enabled = true;

    gameContainer.appendChild(
        renderer.domElement
    );


    /*
       Lumières
    */

    const hemisphere =
        new THREE.HemisphereLight(
            0xffffff,
            0x445544,
            2.2
        );

    scene.add(hemisphere);


    const sun =
        new THREE.DirectionalLight(
            0xffffff,
            2.4
        );

    sun.position.set(
        100,
        250,
        100
    );

    sun.castShadow = true;

    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;

    scene.add(sun);


    /*
       Groupes
    */

    roadGroup =
        new THREE.Group();

    buildingGroup =
        new THREE.Group();

    decorationGroup =
        new THREE.Group();

    scene.add(roadGroup);
    scene.add(buildingGroup);
    scene.add(decorationGroup);


    setupCameraTouch();

    setupJoystick();

    window.addEventListener(
        "resize",
        resizeThree
    );


    animateThree();
}


/* =========================================================
   REDIMENSIONNEMENT
   ========================================================= */

function resizeThree() {

    if (!renderer || !camera) {
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
   RÉCUPÉRATION OSM
   ========================================================= */

async function fetchOSMData(
    lat,
    lon
) {

    /*
       Routes principales + rues.
       Bâtiments.
    */

    const query = `
[out:json][timeout:25];
(
  way["highway"]["highway"!="footway"]["highway"!="path"]["highway"!="cycleway"]["highway"!="steps"](around:${OSM_RADIUS},${lat},${lon});
  way["building"](around:${OSM_RADIUS},${lat},${lon});
);
out geom;
`;

    let lastError = null;

    for (
        const server of OVERPASS_SERVERS
    ) {

        try {

            setLoadingText(
                "Téléchargement de la ville..."
            );

            const response =
                await fetch(
                    server,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/x-www-form-urlencoded"
                        },
                        body:
                            "data=" +
                            encodeURIComponent(
                                query
                            )
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

            return data;

        } catch (error) {

            lastError = error;

            console.warn(
                "Overpass indisponible:",
                server,
                error
            );
        }
    }

    throw lastError ||
        new Error(
            "Impossible de récupérer OSM"
        );
}


/* =========================================================
   GÉNÉRATION DE LA VILLE
   ========================================================= */

async function generateOSMWorld() {

    if (
        spawnLocation.lat === null ||
        spawnLocation.lon === null
    ) {

        createEmptyWorld();

        return;
    }

    if (!threeReady) {

        await initThree();
    }

    if (!threeReady) {
        return;
    }

    setLoadingText(
        "Préparation de la carte 3D..."
    );

    setLoadingProgress(40);

    clearWorld();

    try {

        const data =
            await fetchOSMData(
                spawnLocation.lat,
                spawnLocation.lon
            );

        setLoadingProgress(65);

        parseOSMData(
            data
        );

        setLoadingProgress(85);

        /*
           Spawn sur la route la plus proche.
        */

        findBestSpawnRoad();

        createPlayerCar();

        updateCamera();

        worldReady = true;

        setLoadingProgress(100);

        setLoadingText(
            "Ville générée !"
        );

        setTimeout(() => {

            if (gameStarted) {

                hide("loadingScreen");
                show("gameHud");

            }

        }, 250);

        notify(
            "🗺️ Ville OpenStreetMap générée !"
        );

        drawMap();

    } catch (error) {

        console.error(
            "Génération OSM:",
            error
        );

        /*
           Ne laisse jamais le joueur
           bloqué sur l'écran de chargement.
        */

        createEmptyWorld();

        setLoadingProgress(100);

        setLoadingText(
            "Carte simplifiée"
        );

        notify(
            "⚠️ OSM est momentanément indisponible."
        );

        setTimeout(() => {

            hide("loadingScreen");

        }, 500);
    }
}


/* =========================================================
   NETTOYAGE MONDE
   ========================================================= */

function clearWorld() {

    [
        roadGroup,
        buildingGroup,
        decorationGroup
    ].forEach(group => {

        if (!group) return;

        while (
            group.children.length
        ) {

            const object =
                group.children.pop();

            disposeObject(
                object
            );
        }
    });

    playerCar = null;

    mapFeatures = {
        roads: [],
        buildings: []
    };

    worldReady = false;
}


/* =========================================================
   DISPOSE
   ========================================================= */

function disposeObject(object) {

    object.traverse(
        child => {

            if (child.geometry) {
                child.geometry.dispose();
            }

            if (child.material) {

                const materials =
                    Array.isArray(
                        child.material
                    )
                        ? child.material
                        : [
                            child.material
                        ];

                materials.forEach(
                    material => {

                        if (
                            material.map
                        ) {
                            material.map.dispose();
                        }

                        material.dispose();
                    }
                );
            }
        }
    );
}


/* =========================================================
   PROJECTION GPS -> MONDE
   ========================================================= */

function gpsToWorld(
    lat,
    lon
) {

    const metersLat =
        111320;

    const metersLon =
        111320 *
        Math.cos(
            spawnLocation.lat *
            Math.PI /
            180
        );

    return {

        x:
            (
                lon -
                spawnLocation.lon
            ) *
            metersLon,

        z:
            -(
                lat -
                spawnLocation.lat
            ) *
            metersLat
    };
}


/* =========================================================
   PARSING OSM
   ========================================================= */

function parseOSMData(data) {

    if (
        !data ||
        !Array.isArray(
            data.elements
        )
    ) {

        throw new Error(
            "Données OSM invalides"
        );
    }

    let roadCount = 0;
    let buildingCount = 0;

    for (
        const element of data.elements
    ) {

        if (
            element.type !== "way" ||
            !Array.isArray(
                element.geometry
            )
        ) {
            continue;
        }

        const tags =
            element.tags || {};

        if (tags.highway) {

            buildRoad(
                element
            );

            roadCount++;

            mapFeatures.roads.push(
                element.geometry
            );

            continue;
        }

        if (tags.building) {

            buildBuilding(
                element
            );

            buildingCount++;

            mapFeatures.buildings.push(
                element.geometry
            );
        }
    }

    console.log(
        "OSM:",
        roadCount,
        "routes /",
        buildingCount,
        "bâtiments"
    );

    if (roadCount === 0) {

        throw new Error(
            "Aucune route OSM trouvée"
        );
    }
}


/* =========================================================
   ROUTES 3D
   ========================================================= */

function buildRoad(element) {

    const geometry =
        element.geometry;

    if (
        !geometry ||
        geometry.length < 2
    ) {
        return;
    }

    const points = [];

    for (
        const node of geometry
    ) {

        const p =
            gpsToWorld(
                Number(node.lat),
                Number(node.lon)
            );

        points.push(
            new THREE.Vector3(
                p.x,
                0.04,
                p.z
            )
        );
    }

    const highway =
        element.tags?.highway ||
        "residential";

    const width =
        getRoadWidth(
            highway
        );

    const roadMaterial =
        new THREE.MeshStandardMaterial({
            color:
                getRoadColor(
                    highway
                ),
            roughness: 0.9
        });

    /*
       Crée une bande 3D autour de chaque
       segment de vraie route OSM.
    */

    for (
        let i = 0;
        i < points.length - 1;
        i++
    ) {

        createRoadSegment(
            points[i],
            points[i + 1],
            width,
            roadMaterial
        );
    }

    /*
       Ligne centrale seulement sur
       les routes assez importantes.
    */

    if (
        highway === "primary" ||
        highway === "secondary" ||
        highway === "tertiary"
    ) {

        const lineMaterial =
            new THREE.MeshBasicMaterial({
                color: 0xf2df62
            });

        for (
            let i = 0;
            i < points.length - 1;
            i++
        ) {

            createRoadLine(
                points[i],
                points[i + 1],
                lineMaterial
            );
        }
    }
}


/* =========================================================
   LARGEUR ROUTE
   ========================================================= */

function getRoadWidth(type) {

    switch (type) {

        case "motorway":
            return 14;

        case "trunk":
            return 12;

        case "primary":
            return 10;

        case "secondary":
            return 9;

        case "tertiary":
            return 8;

        case "residential":
            return 6.5;

        case "unclassified":
            return 5.5;

        case "service":
            return 4;

        default:
            return 5;
    }
}


function getRoadColor(type) {

    if (
        type === "motorway" ||
        type === "trunk"
    ) {
        return 0x45484c;
    }

    if (
        type === "primary" ||
        type === "secondary"
    ) {
        return 0x55585c;
    }

    return 0x4a4d50;
}


/* =========================================================
   SEGMENT ROUTE
   ========================================================= */

function createRoadSegment(
    a,
    b,
    width,
    material
) {

    const dx =
        b.x - a.x;

    const dz =
        b.z - a.z;

    const length =
        Math.sqrt(
            dx * dx +
            dz * dz
        );

    if (length < 0.5) {
        return;
    }

    const geometry =
        new THREE.BoxGeometry(
            width,
            0.12,
            length
        );

    const mesh =
        new THREE.Mesh(
            geometry,
            material
        );

    mesh.position.set(
        (a.x + b.x) / 2,
        0,
        (a.z + b.z) / 2
    );

    mesh.rotation.y =
        -Math.atan2(
            dx,
            dz
        );

    mesh.receiveShadow = true;

    roadGroup.add(mesh);
}


/* =========================================================
   MARQUAGE ROUTE
   ========================================================= */

function createRoadLine(
    a,
    b,
    material
) {

    const dx =
        b.x - a.x;

    const dz =
        b.z - a.z;

    const length =
        Math.sqrt(
            dx * dx +
            dz * dz
        );

    if (length < 4) {
        return;
    }

    const geometry =
        new THREE.BoxGeometry(
            0.12,
            0.025,
            Math.min(
                length,
                12
            )
        );

    const mesh =
        new THREE.Mesh(
            geometry,
            material
        );

    mesh.position.set(
        (a.x + b.x) / 2,
        0.08,
        (a.z + b.z) / 2
    );

    mesh.rotation.y =
        -Math.atan2(
            dx,
            dz
        );

    roadGroup.add(mesh);
}


/* =========================================================
   BÂTIMENTS 3D
   ========================================================= */

function buildBuilding(element) {

    const geometry =
        element.geometry;

    if (
        !geometry ||
        geometry.length < 3
    ) {
        return;
    }

    const points = [];

    for (
        const node of geometry
    ) {

        const p =
            gpsToWorld(
                Number(node.lat),
                Number(node.lon)
            );

        points.push(
            new THREE.Vector2(
                p.x,
                p.z
            )
        );
    }

    /*
       Supprime les bâtiments trop énormes
       qui pourraient être des géométries
       OSM problématiques.
    */

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    points.forEach(
        p => {

            minX =
                Math.min(
                    minX,
                    p.x
                );

            maxX =
                Math.max(
                    maxX,
                    p.x
                );

            minZ =
                Math.min(
                    minZ,
                    p.y
                );

            maxZ =
                Math.max(
                    maxZ,
                    p.y
                );
        }
    );

    const width =
        maxX - minX;

    const depth =
        maxZ - minZ;

    if (
        width > 150 ||
        depth > 150
    ) {
        return;
    }

    const shape =
        new THREE.Shape();

    points.forEach(
        (p, index) => {

            if (index === 0) {

                shape.moveTo(
                    p.x,
                    -p.y
                );

            } else {

                shape.lineTo(
                    p.x,
                    -p.y
                );
            }
        }
    );

    shape.closePath();

    const levels =
        Number(
            element.tags?.building_levels ||
            element.tags?.["building:levels"] ||
            1
        );

    const height =
        Math.max(
            3,
            Math.min(
                levels * 3,
                30
            )
        );

    const extrude =
        new THREE.ExtrudeGeometry(
            shape,
            {
                depth: height,
                bevelEnabled: false
            }
        );

    /*
       L'ExtrudeGeometry travaille sur XY,
       on le remet verticalement dans le monde.
    */

    const material =
        new THREE.MeshStandardMaterial({
            color:
                getBuildingColor(
                    element.tags
                ),
            roughness: 0.85
        });

    const mesh =
        new THREE.Mesh(
            extrude,
            material
        );

    mesh.rotation.x =
        -Math.PI / 2;

    mesh.position.y = 0;

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    buildingGroup.add(mesh);
}


/* =========================================================
   COULEUR BÂTIMENT
   ========================================================= */

function getBuildingColor(tags) {

    const type =
        String(
            tags?.building || ""
        ).toLowerCase();

    if (
        type.includes("commercial") ||
        type.includes("retail")
    ) {
        return 0xb7a58a;
    }

    if (
        type.includes("industrial")
    ) {
        return 0x858585;
    }

    if (
        type.includes("school")
    ) {
        return 0xc9b07d;
    }

    return 0xa99f91;
}


/* =========================================================
   TERRAIN SANS CARRÉS
   ========================================================= */

function createGround() {

    /*
       Un seul grand terrain plat.
       Les routes OSM sont par-dessus.
       On n'utilise plus de grille de carrés.
    */

    const geometry =
        new THREE.PlaneGeometry(
            1600,
            1600
        );

    const material =
        new THREE.MeshStandardMaterial({
            color: 0x304c36,
            roughness: 1
        });

    const ground =
        new THREE.Mesh(
            geometry,
            material
        );

    ground.rotation.x =
        -Math.PI / 2;

    ground.position.y =
        -0.08;

    ground.receiveShadow = true;

    decorationGroup.add(
        ground
    );
}


/* =========================================================
   MONDE VIDE
   ========================================================= */

function createEmptyWorld() {

    if (!scene) {
        return;
    }

    clearWorld();

    createGround();

    playerPosition.x = 0;
    playerPosition.z = 0;

    createPlayerCar();

    updateCamera();

    worldReady = true;
}


/* =========================================================
   SPAWN SUR ROUTE
   ========================================================= */

function findBestSpawnRoad() {

    let best = null;
    let bestDistance =
        Infinity;

    const target =
        new THREE.Vector3(
            0,
            0,
            0
        );

    roadGroup.traverse(
        object => {

            if (
                !object.isMesh ||
                !object.geometry
            ) {
                return;
            }

            const position =
                object.position;

            const distance =
                Math.hypot(
                    position.x -
                    target.x,

                    position.z -
                    target.z
                );

            if (
                distance <
                bestDistance
            ) {

                bestDistance =
                    distance;

                best =
                    object;
            }
        }
    );

    if (best) {

        playerPosition.x =
            best.position.x;

        playerPosition.z =
            best.position.z;

        currentRoadAngle =
            best.rotation.y;

        playerRotation =
            currentRoadAngle;
    } else {

        playerPosition.x = 0;
        playerPosition.z = 0;
    }

    spawnWorld.x =
        playerPosition.x;

    spawnWorld.z =
        playerPosition.z;
}


/* =========================================================
   VOITURE
   ========================================================= */

function createPlayerCar() {

    if (playerCar) {

        scene.remove(
            playerCar
        );
    }

    playerCar =
        new THREE.Group();

    playerCarBody =
        new THREE.Group();


    /*
       Carrosserie
    */

    const bodyGeometry =
        new THREE.BoxGeometry(
            2.2,
            0.55,
            4.2
        );

    const bodyMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x1976d2,
            roughness: 0.55
        });

    const body =
        new THREE.Mesh(
            bodyGeometry,
            bodyMaterial
        );

    body.position.y =
        0.65;

    body.castShadow = true;

    playerCarBody.add(body);


    /*
       Habitacle
    */

    const cabinGeometry =
        new THREE.BoxGeometry(
            1.65,
            0.65,
            1.8
        );

    const cabinMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x20252b,
            roughness: 0.35
        });

    const cabin =
        new THREE.Mesh(
            cabinGeometry,
            cabinMaterial
        );

    cabin.position.y =
        1.18;

    cabin.position.z =
        -0.15;

    cabin.castShadow = true;

    playerCarBody.add(cabin);


    /*
       Roues
    */

    const wheelGeometry =
        new THREE.CylinderGeometry(
            0.42,
            0.42,
            0.28,
            16
        );

    const wheelMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x101010,
            roughness: 0.9
        });

    const wheelPositions = [
        [-1.08, 0.42, -1.35],
        [ 1.08, 0.42, -1.35],
        [-1.08, 0.42,  1.35],
        [ 1.08, 0.42,  1.35]
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

            playerCarBody.add(
                wheel
            );
        }
    );


    playerCar.add(
        playerCarBody
    );

    scene.add(
        playerCar
    );

    playerCar.position.set(
        playerPosition.x,
        0,
        playerPosition.z
    );

    playerCar.rotation.y =
        playerRotation;
}


/* =========================================================
   JOYSTICK
   ========================================================= */

function setupJoystick() {

    const joystick =
        $("joystick");

    const stick =
        $("joystickStick");

    if (
        !joystick ||
        !stick
    ) {
        console.warn(
            "Joystick absent"
        );

        return;
    }

    if (
        joystick.dataset.ready === "1"
    ) {
        return;
    }

    joystick.dataset.ready = "1";

    let active = false;
    let pointerId = null;

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

        joystickX =
            dx / max;

        joystickY =
            dy / max;

        stick.style.transform =
            "translate(" +
            dx +
            "px, " +
            dy +
            "px)";
    }

    function reset() {

        active = false;
        pointerId = null;

        joystickX = 0;
        joystickY = 0;

        stick.style.transform =
            "translate(0,0)";
    }


    joystick.addEventListener(
        "pointerdown",
        event => {

            active = true;
            pointerId =
                event.pointerId;

            try {
                joystick.setPointerCapture(
                    pointerId
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

            if (
                !active ||
                event.pointerId !==
                pointerId
            ) {
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
   CAMÉRA TACTILE
   ========================================================= */

function setupCameraTouch() {

    if (!renderer) {
        return;
    }

    const canvas =
        renderer.domElement;

    canvas.style.touchAction =
        "none";

    canvas.addEventListener(
        "pointerdown",
        event => {

            /*
               Ne démarre pas la caméra
               quand on touche le joystick.
            */

            const target =
                event.target;

            if (
                target.closest &&
                target.closest(
                    "#joystick"
                )
            ) {
                return;
            }

            cameraTouchActive = true;

            cameraTouchId =
                event.pointerId;

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

            if (
                !cameraTouchActive ||
                event.pointerId !==
                cameraTouchId
            ) {
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
                dx * 0.008;

            cameraPitch +=
                dy * 0.005;

            cameraPitch =
                Math.max(
                    0.15,
                    Math.min(
                        1.15,
                        cameraPitch
                    )
                );
        }
    );


    function stopCamera() {

        cameraTouchActive =
            false;

        cameraTouchId =
            null;
    }

    canvas.addEventListener(
        "pointerup",
        stopCamera
    );

    canvas.addEventListener(
        "pointercancel",
        stopCamera
    );

    canvas.addEventListener(
        "lostpointercapture",
        stopCamera
    );
}


/* =========================================================
   MOUVEMENT
   ========================================================= */

function updatePlayer(delta) {

    if (
        !gameStarted ||
        !playerCar
    ) {
        return;
    }

    /*
       joystickY :
       haut = -1
       bas = +1
    */

    const throttle =
        -joystickY;

    const steering =
        joystickX;

    /*
       Accélération
    */

    if (
        Math.abs(throttle) >
        0.08
    ) {

        carSpeed +=
            throttle *
            18 *
            delta;

    } else {

        /*
           Friction
        */

        carSpeed *=
            Math.pow(
                0.05,
                delta
            );
    }

    carSpeed =
        Math.max(
            -8,
            Math.min(
                22,
                carSpeed
            )
        );


    /*
       Direction
    */

    const steeringStrength =
        Math.min(
            1,
            Math.abs(carSpeed) /
            5
        );

    playerRotation +=
        steering *
        steeringStrength *
        1.8 *
        delta *
        (
            carSpeed >= 0
                ? 1
                : -1
        );


    /*
       Déplacement
    */

    playerPosition.x +=
        Math.sin(
            playerRotation
        ) *
        carSpeed *
        delta;

    playerPosition.z +=
        Math.cos(
            playerRotation
        ) *
        carSpeed *
        delta;


    /*
       Voiture
    */

    playerCar.position.x =
        playerPosition.x;

    playerCar.position.z =
        playerPosition.z;

    playerCar.rotation.y =
        playerRotation;


    /*
       Envoie position au serveur
    */

    sendPlayerUpdate();
}


/* =========================================================
   MULTIJOUEUR POSITION
   ========================================================= */

let lastNetworkUpdate = 0;

function sendPlayerUpdate() {

    const now =
        performance.now();

    if (
        now -
        lastNetworkUpdate <
        100
    ) {
        return;
    }

    lastNetworkUpdate =
        now;

    send({
        type:
            "player_update",

        player: {

            id:
                currentPlayerId,

            name:
                currentUser?.username ||
                "Invité",

            x:
                playerPosition.x,

            y: 0,

            z:
                playerPosition.z,

            rotation:
                playerRotation,

            vehicle:
                selectedVehicle,

            inVehicle:
                selectedVehicle !==
                "walk"
        }
    });
}


/* =========================================================
   CAMÉRA
   ========================================================= */

function updateCamera() {

    if (
        !camera ||
        !playerCar
    ) {
        return;
    }

    const target =
        new THREE.Vector3(
            playerPosition.x,
            1.2,
            playerPosition.z
        );

    const horizontal =
        Math.cos(
            cameraPitch
        ) *
        cameraDistance;

    const vertical =
        Math.sin(
            cameraPitch
        ) *
        cameraDistance;

    camera.position.set(

        target.x +
        Math.sin(cameraYaw) *
        horizontal,

        target.y +
        vertical,

        target.z +
        Math.cos(cameraYaw) *
        horizontal
    );

    camera.lookAt(
        target
    );
}


/* =========================================================
   BOUCLE 3D
   ========================================================= */

let previousTime =
    performance.now();

function animateThree() {

    requestAnimationFrame(
        animateThree
    );

    if (!renderer || !scene) {
        return;
    }

    const now =
        performance.now();

    let delta =
        (now - previousTime) /
        1000;

    previousTime = now;

    delta =
        Math.min(
            delta,
            0.05
        );

    updatePlayer(
        delta
    );

    updateCamera();

    renderer.render(
        scene,
        camera
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
            : "🚗 Voiture"
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

            button.addEventListener(
                "click",
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
                }
            );

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
        currentUser?.vehicles ||
        ["car"];

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

    const username =
        input?.value
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

    const input =
        $("newUsernameInput");

    const username =
        input?.value
            .trim();

    if (
        !username ||
        username.length < 3
    ) {

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
        type:
            "create_room",

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

    const code =
        $("roomCodeInput")
            ?.value
            .trim()
            .toUpperCase();

    const password =
        $("roomPasswordInput")
            ?.value || "";

    if (!code || code.length !== 6) {

        multiplayerMessage(
            "Le code doit contenir 6 caractères."
        );

        return;
    }

    send({
        type:
            "join_room",

        room: code,

        password,

        vehicle:
            selectedVehicle
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
        type:
            "quick_match",

        vehicle:
            selectedVehicle
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

    (
        data.players ||
        []
    ).forEach(
        player => {

            players[player.id] =
                player;
        }
    );

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

    (
        data.players ||
        []
    ).forEach(
        player => {

            players[player.id] =
                player;
        }
    );

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

    (
        data.players ||
        []
    ).forEach(
        player => {

            players[player.id] =
                player;
        }
    );

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

    if (!player) {
        return;
    }

    players[player.id] =
        player;

    refreshPlayersList();
}


function updateRemoteVehicle(data) {

    if (
        !data ||
        !players[data.playerId]
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

                div.textContent =
                    (
                        player.name ||
                        player.username ||
                        "Joueur"
                    ) +
                    " — " +
                    (
                        player.inVehicle
                            ? "🚗"
                            : "🚶"
                    );

                list.appendChild(
                    div
                );
            }
        );
}


/* =========================================================
   QUITTER ROOM
   ========================================================= */

function leaveRoom() {

    send({
        type:
            "leave_room"
    });

    currentRoom = null;
    currentPlayerId = null;

    players = {};

    hide("roomScreen");

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
   CARTE 2D
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
            1,
            Math.floor(
                rect.width ||
                window.innerWidth
            )
        );

    canvas.height =
        Math.max(
            1,
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

    ctx.fillStyle =
        "#26382c";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    const scale =
        0.75 *
        mapZoom;

    const centerX =
        canvas.width / 2;

    const centerY =
        canvas.height / 2;


    /*
       Bâtiments
    */

    ctx.fillStyle =
        "#827b70";

    for (
        const building of
        mapFeatures.buildings
    ) {

        if (
            !building ||
            building.length < 3
        ) {
            continue;
        }

        ctx.beginPath();

        building.forEach(
            (node, index) => {

                const p =
                    gpsToWorld(
                        Number(node.lat),
                        Number(node.lon)
                    );

                const x =
                    centerX +
                    p.x *
                    scale;

                const y =
                    centerY +
                    p.z *
                    scale;

                if (index === 0) {
                    ctx.moveTo(
                        x,
                        y
                    );
                } else {
                    ctx.lineTo(
                        x,
                        y
                    );
                }
            }
        );

        ctx.closePath();
        ctx.fill();
    }


    /*
       Routes
    */

    ctx.strokeStyle =
        "#d2d2d2";

    ctx.lineWidth =
        Math.max(
            2,
            4 * mapZoom
        );

    for (
        const road of
        mapFeatures.roads
    ) {

        if (
            !road ||
            road.length < 2
        ) {
            continue;
        }

        ctx.beginPath();

        road.forEach(
            (node, index) => {

                const p =
                    gpsToWorld(
                        Number(node.lat),
                        Number(node.lon)
                    );

                const x =
                    centerX +
                    p.x *
                    scale;

                const y =
                    centerY +
                    p.z *
                    scale;

                if (index === 0) {
                    ctx.moveTo(
                        x,
                        y
                    );
                } else {
                    ctx.lineTo(
                        x,
                        y
                    );
                }
            }
        );

        ctx.stroke();
    }


    /*
       Joueur
    */

    ctx.fillStyle =
        "#ff3030";

    ctx.beginPath();

    ctx.arc(
        centerX,
        centerY,
        8,
        0,
        Math.PI * 2
    );

    ctx.fill();


    /*
       Point de spawn
    */

    ctx.strokeStyle =
        "#ffffff";

    ctx.lineWidth = 2;

    ctx.beginPath();

    ctx.arc(
        centerX,
        centerY,
        13,
        0,
        Math.PI * 2
    );

    ctx.stroke();
}


/* =========================================================
   ZOOM CARTE
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
   PINCH ZOOM CARTE
   ========================================================= */

function setupMapTouch() {

    const canvas =
        $("mapCanvas");

    if (!canvas) {
        return;
    }

    if (
        canvas.dataset.ready === "1"
    ) {
        return;
    }

    canvas.dataset.ready = "1";

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

            const ratio =
                distance /
                startDistance;

            if (
                Math.abs(
                    ratio - 1
                ) >
                0.03
            ) {

                mapZoom *= ratio;

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

            startDistance =
                null;
        },
        {
            passive: true
        }
    );
}


/* =========================================================
   JOUEURS DISTANTS
   ========================================================= */

function updateRemotePlayers3D() {

    /*
       La synchronisation complète des voitures
       distantes pourra être ajoutée côté serveur.
       Pour l'instant les positions sont conservées
       dans players sans casser la partie locale.
    */
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
   SCREENS
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
                            id ===
                            "usernameScreen"
                                ? "settingsScreen"
                                : "mainMenu"
                        );
                    }
                );
            }
        );
}


/* =========================================================
   MASQUER LES ANCIENS 4 BOUTONS
   ========================================================= */

function removeOldDriveButtons() {

    [
        "accelerateButton",
        "brakeButton",
        "leftButton",
        "rightButton"
    ].forEach(
        id => {

            const element =
                $(id);

            if (element) {

                element.style.display =
                    "none";

                element.setAttribute(
                    "aria-hidden",
                    "true"
                );
            }
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

async function init() {

    console.log(
        "🚗 RoadGame V6"
    );

    console.log(
        "📡 Serveur:",
        SERVER_URL
    );

    /*
       On ne reste PAS bloqué à 90 %.
    */

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
    setupAddressSystem();
    setupMapTouch();

    removeOldDriveButtons();

    /*
       Three.js est chargé indépendamment
       du serveur Render.
    */

    await initThree();

    setLoadingProgress(50);

    setLoadingText(
        "Connexion au serveur..."
    );

    connectServer();

    /*
       Au bout de 2 secondes,
       on affiche l'auth même si Render
       n'a pas encore répondu.
    */

    setTimeout(() => {

        if (
            $("loadingScreen") &&
            !$("loadingScreen")
                .classList
                .contains("hidden")
        ) {

            setLoadingProgress(100);

            setLoadingText(
                "Prêt !"
            );

            setTimeout(() => {

                hide("loadingScreen");
                show("authScreen");

            }, 200);
        }

    }, 2000);
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
