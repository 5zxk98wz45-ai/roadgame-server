“use strict”;

/* =========================================================
ROADGAME V3

* Comptes / connexion
* Pseudo unique
* Multijoueur WebSocket
* Parties publiques / privées
* Recherche ville / adresse avec Nominatim
* Choix du spawn
* Carte OpenStreetMap
* Zoom tactile
* Véhicules
    ========================================================= */

/* =========================================================
SERVEUR
========================================================= */

const SERVER_URL =
“wss://roadgame-server.onrender.com”;

/* =========================================================
VARIABLES
========================================================= */

let socket = null;

let connected = false;
let loggedIn = false;

let currentUser = null;

let currentRoom = null;
let currentPlayerId = null;

let selectedVehicle = “car”;

let players = {};

let gameStarted = false;

let mapZoom = 15;

let spawnLatitude = 48.8566;
let spawnLongitude = 2.3522;

let spawnName = “Paris”;

let lastSearchTime = 0;

let map = null;
let spawnMarker = null;
let mapInitialized = false;

/* =========================================================
OUTILS
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
        ? "#35e875"
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
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
    )
) {
    return;
}
setText(
    "loadingText",
    "Connexion au serveur..."
);
try {
    socket =
        new WebSocket(
            SERVER_URL
        );
} catch (error) {
    console.error(error);
    setText(
        "loadingText",
        "Erreur de connexion au serveur."
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
        setText(
            "loadingText",
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
        } catch (error) {
            console.error(
                "Message invalide",
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
        if (!gameStarted) {
            authMessage(
                "Le serveur ne répond plus. Réessaie dans quelques secondes."
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
        if (!gameStarted) {
            authMessage(
                "Impossible de contacter le serveur."
            );
        }
    }
);

}

/* =========================================================
ENVOYER
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
        console.log(
            "✅ Serveur RoadGame prêt"
        );
        break;
    /* =========================
       COMPTES
    ========================= */
    case "account_created":
        currentUser =
            data.user;
        loggedIn = true;
        selectedVehicle =
            data.user.selectedVehicle ||
            "car";
        authMessage(
            "Compte créé avec succès !",
            true
        );
        setTimeout(
            openMainMenu,
            300
        );
        break;
    case "login_success":
        currentUser =
            data.user;
        loggedIn = true;
        selectedVehicle =
            data.user.selectedVehicle ||
            "car";
        authMessage(
            "Connexion réussie !",
            true
        );
        setTimeout(
            openMainMenu,
            300
        );
        break;
    /* =========================
       ERREURS
    ========================= */
    case "error":
        handleServerError(
            data.message
        );
        break;
    /* =========================
       PSEUDO
    ========================= */
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
    /* =========================
       PARTIES
    ========================= */
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
    /* =========================
       JOUEURS
    ========================= */
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
    /* =========================
       VÉHICULES
    ========================= */
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
    /* =========================
       AMIS
    ========================= */
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
    /* =========================
       PARAMÈTRES
    ========================= */
    case "settings_updated":
        if (currentUser) {
            currentUser.settings =
                data.settings;
        }
        break;
    default:
        console.log(
            "Message serveur non géré :",
            data
        );
}

}

/* =========================================================
ERREURS
========================================================= */

function handleServerError(message) {

console.error(
    "❌",
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

const screens = [
    "loadingScreen",
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
    "gameHud",
    "spawnScreen"
];
screens.forEach(hide);
show("mainMenu");
const name =
    currentUser
        ? currentUser.username
        : "Invité";
setText(
    "welcomeText",
    "Bienvenue " + name
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

const code =
    $("roomCodeInput")
        ?.value
        .trim()
        .toUpperCase();
const password =
    $("roomPasswordInput")
        ?.value || "";
if (!code) {
    multiplayerMessage(
        "Entre le code de la partie."
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
if (socket) {
    socket.close();
}
socket = null;
connected = false;
hide("roomScreen");
show("mainMenu");
setTimeout(
    connectServer,
    500
);

}

/* =========================================================
SPAWN
========================================================= */

function openSpawnScreen() {

hide("mainMenu");
show("spawnScreen");
setText(
    "spawnLocationText",
    spawnName
        ? "Lieu : " + spawnName
        : "Aucun lieu sélectionné"
);
initializeMap();

}

async function searchSpawnLocation() {

const input =
    $("spawnSearchInput");
if (!input) {
    return;
}
const query =
    input.value.trim();
if (!query) {
    notify(
        "Entre une ville ou une adresse."
    );
    return;
}
/*
   Nominatim demande de ne pas dépasser
   1 requête/seconde.
*/
const now =
    Date.now();
if (
    now - lastSearchTime <
    1000
) {
    notify(
        "Attends une seconde avant une nouvelle recherche."
    );
    return;
}
lastSearchTime =
    now;
const results =
    $("spawnSearchResults");
if (results) {
    results.innerHTML =
        "<p>🔎 Recherche...</p>";
}
try {
    const url =
        "https://nominatim.openstreetmap.org/search?" +
        new URLSearchParams({
            q: query,
            format: "json",
            limit: "5",
            addressdetails: "1",
            "accept-language":
                "fr"
        });
    const response =
        await fetch(url);
    if (!response.ok) {
        throw new Error(
            "Erreur HTTP " +
            response.status
        );
    }
    const data =
        await response.json();
    if (!data.length) {
        if (results) {
            results.innerHTML =
                "<p>Aucun résultat.</p>";
        }
        return;
    }
    if (results) {
        results.innerHTML = "";
        data.forEach(
            result => {
                const button =
                    document.createElement(
                        "button"
                    );
                button.className =
                    "spawnResult";
                button.textContent =
                    result.display_name;
                button.addEventListener(
                    "click",
                    () => {
                        selectSpawnLocation(
                            result
                        );
                    }
                );
                results.appendChild(
                    button
                );
            }
        );
    }
} catch (error) {
    console.error(
        "Recherche OpenStreetMap :",
        error
    );
    if (results) {
        results.innerHTML =
            "<p>Impossible de rechercher ce lieu.</p>";
    }
}

}

function selectSpawnLocation(result) {

const lat =
    Number(result.lat);
const lon =
    Number(result.lon);
if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
) {
    return;
}
spawnLatitude =
    lat;
spawnLongitude =
    lon;
spawnName =
    result.display_name ||
    "Lieu sélectionné";
setText(
    "spawnLocationText",
    "📍 " + spawnName
);
notify(
    "📍 Point de spawn sélectionné !"
);
updateMapPosition();

}

function confirmSpawn() {

if (
    !Number.isFinite(spawnLatitude) ||
    !Number.isFinite(spawnLongitude)
) {
    notify(
        "Choisis d'abord un lieu."
    );
    return;
}
notify(
    "📍 Spawn défini sur " +
    spawnName
);
hide("spawnScreen");
show("mainMenu");

}

/* =========================================================
CARTE OPENSTREETMAP
========================================================= */

function initializeMap() {

const container =
    $("spawnMap");
if (!container) {
    return;
}
/*
   Si Leaflet est présent dans index.html,
   on utilise la vraie carte OpenStreetMap.
*/
if (
    typeof L === "undefined"
) {
    console.warn(
        "Leaflet n'est pas chargé."
    );
    container.innerHTML =
        "<div style='padding:20px'>" +
        "Carte indisponible : Leaflet n'est pas chargé." +
        "</div>";
    return;
}
if (!mapInitialized) {
    map =
        L.map(
            container,
            {
                zoomControl: true,
                touchZoom: true
            }
        );
    L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                "&copy; OpenStreetMap contributors"
        }
    ).addTo(map);
    mapInitialized = true;
}
updateMapPosition();

}

function updateMapPosition() {

if (!map) {
    return;
}
map.setView(
    [
        spawnLatitude,
        spawnLongitude
    ],
    mapZoom
);
if (spawnMarker) {
    spawnMarker.setLatLng([
        spawnLatitude,
        spawnLongitude
    ]);
} else {
    spawnMarker =
        L.marker([
            spawnLatitude,
            spawnLongitude
        ])
        .addTo(map)
        .bindPopup(
            "📍 Ton spawn"
        );
}
setTimeout(() => {
    map.invalidateSize();
}, 100);

}

/* =========================================================
CARTE DU JEU
========================================================= */

function openMap() {

show("mapScreen");
/*
   Si une carte Leaflet existe déjà,
   on peut afficher le spawn.
*/
initializeGameMap();

}

function closeMap() {

hide("mapScreen");

}

let gameMap = null;
let gameMarker = null;

function initializeGameMap() {

const container =
    $("gameMap");
if (!container) {
    return;
}
if (
    typeof L === "undefined"
) {
    return;
}
if (!gameMap) {
    gameMap =
        L.map(
            container,
            {
                zoomControl: true,
                touchZoom: true
            }
        );
    L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                "&copy; OpenStreetMap contributors"
        }
    ).addTo(gameMap);
}
gameMap.setView(
    [
        spawnLatitude,
        spawnLongitude
    ],
    mapZoom
);
if (!gameMarker) {
    gameMarker =
        L.marker([
            spawnLatitude,
            spawnLongitude
        ])
        .addTo(gameMap);
} else {
    gameMarker.setLatLng([
        spawnLatitude,
        spawnLongitude
    ]);
}
setTimeout(() => {
    gameMap.invalidateSize();
}, 100);

}

/* =========================================================
ZOOM CARTE
========================================================= */

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
if (map) {
    map.setZoom(mapZoom);
}
if (gameMap) {
    gameMap.setZoom(mapZoom);
}

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
updateHUD();
notify(
    "🚗 Spawn : " +
    spawnName
);
/*
   On envoie la position choisie
   au serveur.
*/
send({
    type:
        "player_update",
    latitude:
        spawnLatitude,
    longitude:
        spawnLongitude,
    rotation:
        0
});

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
        "<p>Aucun ami.</p>";
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

const input =
    $("newUsernameInput");
if (!input) {
    return;
}
const username =
    input.value.trim();
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
        Math.hypot(
            dx,
            dy
        );
    if (distance > max) {
        dx =
            dx / distance *
            max;
        dy =
            dy / distance *
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
CONTRÔLES
========================================================= */

function setupDriveControls() {

[
    "accelerateButton",
    "brakeButton",
    "leftButton",
    "rightButton"
].forEach(id => {
    const button =
        $(id);
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
TOUCH ZOOM CARTE
========================================================= */

function setupMapTouch() {

/*
   Leaflet gère directement le
   pinch-to-zoom avec touchZoom.
*/
document.addEventListener(
    "touchmove",
    event => {
        if (
            event.touches.length === 2 &&
            (
                map ||
                gameMap
            )
        ) {
            /*
               On laisse Leaflet gérer
               le zoom.
            */
        }
    },
    {
        passive: true
    }
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
/* SPAWN */
$("spawnButton")
    ?.addEventListener(
        "click",
        openSpawnScreen
    );
$("searchSpawnButton")
    ?.addEventListener(
        "click",
        searchSpawnLocation
    );
$("confirmSpawnButton")
    ?.addEventListener(
        "click",
        confirmSpawn
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
/* MAP */
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
        () => zoomMap(1)
    );
$("mapZoomOut")
    ?.addEventListener(
        "click",
        () => zoomMap(-1)
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
/* VEHICULE */
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
    $("usernameInput").value =
        "";
}
if ($("passwordInput")) {
    $("passwordInput").value =
        "";
}
authMessage(
    "Tu es déconnecté."
);

}

/* =========================================================
CLAVIER
========================================================= */

document.addEventListener(
“keydown”,
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
        event.key === "Enter" &&
        $("spawnSearchInput") &&
        document.activeElement ===
            $("spawnSearchInput")
    ) {
        searchSpawnLocation();
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
    "🚗 RoadGame V3"
);
console.log(
    "📡 Serveur :",
    SERVER_URL
);
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
    "pauseScreen",
    "spawnScreen"
].forEach(hide);
show("loadingScreen");
setText(
    "loadingText",
    "Chargement de RoadGame..."
);
setupEvents();
setupScreens();
setupJoystick();
setupDriveControls();
setupMapTouch();
setTimeout(
    connectServer,
    300
);

}

/* =========================================================
LANCEMENT
========================================================= */

if (
document.readyState ===
“loading”
) {

document.addEventListener(
    "DOMContentLoaded",
    init
);

} else {

init();

}
