/* =========================================================
   ROADGAME — GAME.JS V2
   =========================================================
   - Écran de chargement 🚗 + barre + pourcentage
   - Connexion WebSocket Render
   - Création de compte / connexion
   - Multijoueur
   - Partie rapide
   - Parties publiques / privées
   - Véhicules
   - Entrée / sortie du véhicule
   - Garage / magasin
   - Amis
   - Paramètres
   - Carte
   - Contrôles clavier + tactiles
   ========================================================= */


/* =========================================================
   CONFIGURATION SERVEUR
   ========================================================= */

// IMPORTANT : mets ici l'adresse EXACTE de ton serveur Render.
const SERVER_URL = "wss://roadgame-server.onrender.com";


/* =========================================================
   VARIABLES
   ========================================================= */

let socket = null;
let connected = false;
let connecting = false;

let currentUser = null;
let currentRoom = null;
let currentPlayerId = null;

let isPlaying = false;
let isPaused = false;

let THREE = null;

let scene = null;
let camera = null;
let renderer = null;
let clock = null;

let localPlayer = null;

const remotePlayers = new Map();

let playerPosition = {
    x: 0,
    z: 0
};

let playerRotation = 0;

let selectedVehicle = "car";
let currentVehicle = "car";
let inVehicle = true;

let lastPositionSend = 0;

let roomPlayers = [];


/* =========================================================
   VÉHICULES
   ========================================================= */

const VEHICLES = {

    walk: {
        name: "À pied",
        icon: "🚶"
    },

    car: {
        name: "Voiture",
        icon: "🚗"
    },

    truck: {
        name: "Camion",
        icon: "🚚"
    },

    bus: {
        name: "Bus",
        icon: "🚌"
    },

    plane: {
        name: "Avion",
        icon: "✈️"
    },

    boat: {
        name: "Bateau",
        icon: "🚤"
    }

};


/* =========================================================
   CONTRÔLES
   ========================================================= */

const controls = {
    forward: false,
    backward: false,
    left: false,
    right: false
};

let joystickActive = false;
let joystickTouchId = null;
let joystickX = 0;
let joystickY = 0;


/* =========================================================
   CHARGEMENT
   ========================================================= */

function setLoadingProgress(
    percent,
    status
) {

    const loadingScreen =
        document.getElementById("loadingScreen");

    const loadingBar =
        document.getElementById("loadingBar");

    const loadingPercent =
        document.getElementById("loadingPercent");

    const loadingStatus =
        document.getElementById("loadingStatus");


    if (loadingScreen) {
        loadingScreen.classList.remove("hidden");
    }


    if (loadingBar) {
        loadingBar.style.width =
            `${Math.max(0, Math.min(100, percent))}%`;
    }


    if (loadingPercent) {
        loadingPercent.textContent =
            `${Math.round(percent)}%`;
    }


    if (loadingStatus) {
        loadingStatus.textContent =
            status;
    }

}


function finishLoading() {

    setLoadingProgress(
        100,
        "RoadGame est prêt !"
    );


    setTimeout(() => {

        document
            .getElementById("loadingScreen")
            ?.classList.add("hidden");

    }, 500);

}


/* =========================================================
   INITIALISATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        setLoadingProgress(
            5,
            "Initialisation de RoadGame..."
        );


        setupButtons();


        setLoadingProgress(
            15,
            "Préparation des contrôles..."
        );


        setupKeyboard();
        setupTouchControls();
        setupDrivingButtons();


        setLoadingProgress(
            25,
            "Connexion au serveur..."
        );


        connectWebSocket();


        setLoadingProgress(
            40,
            "Chargement du moteur 3D..."
        );


        await loadThreeJS();


        setLoadingProgress(
            70,
            "Création du monde..."
        );


        initThree();


        setLoadingProgress(
            90,
            "Préparation du menu..."
        );


        showAuthScreen();


        finishLoading();

    }
);


/* =========================================================
   THREE.JS
   ========================================================= */

async function loadThreeJS() {

    if (window.THREE) {

        THREE = window.THREE;

        return;

    }


    try {

        THREE = await import(
            "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js"
        );

    } catch (error) {

        console.error(
            "Erreur Three.js :",
            error
        );

        showNotification(
            "Impossible de charger le moteur 3D."
        );

    }

}


/* =========================================================
   INITIALISATION THREE
   ========================================================= */

function initThree() {

    if (!THREE) {
        return;
    }


    const canvas =
        document.getElementById("gameCanvas");


    if (!canvas) {
        return;
    }


    scene =
        new THREE.Scene();


    scene.background =
        new THREE.Color(0x87ceeb);


    camera =
        new THREE.PerspectiveCamera(
            65,
            window.innerWidth /
            window.innerHeight,
            0.1,
            2000
        );


    camera.position.set(
        0,
        7,
        12
    );


    renderer =
        new THREE.WebGLRenderer({
            canvas,
            antialias: true
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


    clock =
        new THREE.Clock();


    setupWorld();


    createLocalPlayer();


    animate();

}


/* =========================================================
   MONDE
   ========================================================= */

function setupWorld() {

    if (!scene || !THREE) {
        return;
    }


    const ambient =
        new THREE.AmbientLight(
            0xffffff,
            1.8
        );


    scene.add(ambient);


    const sun =
        new THREE.DirectionalLight(
            0xffffff,
            2
        );


    sun.position.set(
        100,
        150,
        50
    );


    scene.add(sun);


    const groundGeometry =
        new THREE.PlaneGeometry(
            1000,
            1000
        );


    const groundMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x4b8b4b
        });


    const ground =
        new THREE.Mesh(
            groundGeometry,
            groundMaterial
        );


    ground.rotation.x =
        -Math.PI / 2;


    scene.add(ground);


    createRoad(
        0,
        0,
        1000,
        35
    );


    createRoad(
        0,
        0,
        35,
        1000
    );


    for (
        let i = -300;
        i <= 300;
        i += 120
    ) {

        createRoad(
            i,
            0,
            22,
            1000
        );


        createRoad(
            0,
            i,
            1000,
            22
        );

    }


    for (
        let x = -300;
        x <= 300;
        x += 60
    ) {

        for (
            let z = -300;
            z <= 300;
            z += 60
        ) {

            if (
                Math.abs(x) < 25 ||
                Math.abs(z) < 25
            ) {
                continue;
            }


            createBuilding(
                x,
                z
            );

        }

    }

}


/* =========================================================
   ROUTES
   ========================================================= */

function createRoad(
    x,
    z,
    width,
    depth
) {

    const geometry =
        new THREE.BoxGeometry(
            width,
            0.08,
            depth
        );


    const material =
        new THREE.MeshStandardMaterial({
            color: 0x333333
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


    scene.add(road);

}


/* =========================================================
   BÂTIMENTS
   ========================================================= */

function createBuilding(
    x,
    z
) {

    const width =
        25 +
        Math.random() * 20;


    const depth =
        25 +
        Math.random() * 20;


    const height =
        10 +
        Math.random() * 40;


    const geometry =
        new THREE.BoxGeometry(
            width,
            height,
            depth
        );


    const material =
        new THREE.MeshStandardMaterial({
            color:
                new THREE.Color(
                    0.25 +
                    Math.random() * 0.25,
                    0.25 +
                    Math.random() * 0.25,
                    0.25 +
                    Math.random() * 0.25
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


    scene.add(building);

}


/* =========================================================
   JOUEUR LOCAL
   ========================================================= */

function createLocalPlayer() {

    if (!THREE || !scene) {
        return;
    }


    if (localPlayer) {

        scene.remove(
            localPlayer
        );

    }


    localPlayer =
        createVehicleObject(
            currentVehicle
        );


    localPlayer.position.set(
        playerPosition.x,
        1,
        playerPosition.z
    );


    localPlayer.rotation.y =
        playerRotation;


    scene.add(
        localPlayer
    );

}


/* =========================================================
   OBJET VÉHICULE
   ========================================================= */

function createVehicleObject(
    vehicle
) {

    const group =
        new THREE.Group();


    let color =
        0x1677ff;


    if (vehicle === "truck") {
        color = 0x9b59b6;
    }


    if (vehicle === "bus") {
        color = 0xf1c40f;
    }


    if (vehicle === "plane") {
        color = 0xffffff;
    }


    if (vehicle === "boat") {
        color = 0x3498db;
    }


    if (vehicle === "walk") {
        color = 0x2ecc71;
    }


    const bodyGeometry =
        new THREE.BoxGeometry(
            vehicle === "bus"
                ? 3
                : 2.5,
            1,
            vehicle === "truck"
                ? 5
                : 4
        );


    const bodyMaterial =
        new THREE.MeshStandardMaterial({
            color
        });


    const body =
        new THREE.Mesh(
            bodyGeometry,
            bodyMaterial
        );


    body.position.y =
        0.8;


    group.add(body);


    if (
        vehicle === "car" ||
        vehicle === "truck" ||
        vehicle === "bus"
    ) {

        const cabinGeometry =
            new THREE.BoxGeometry(
                1.8,
                0.9,
                1.8
            );


        const cabinMaterial =
            new THREE.MeshStandardMaterial({
                color: 0x9ed8ff
            });


        const cabin =
            new THREE.Mesh(
                cabinGeometry,
                cabinMaterial
            );


        cabin.position.set(
            0,
            1.65,
            -0.2
        );


        group.add(cabin);


        createWheels(
            group,
            vehicle
        );

    }


    return group;

}


/* =========================================================
   ROUES
   ========================================================= */

function createWheels(
    group,
    vehicle
) {

    const wheelGeometry =
        new THREE.CylinderGeometry(
            0.45,
            0.45,
            0.3,
            16
        );


    const wheelMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x111111
        });


    const positions = [

        [-1.25, 0.45, -1.35],
        [1.25, 0.45, -1.35],
        [-1.25, 0.45, 1.35],
        [1.25, 0.45, 1.35]

    ];


    positions.forEach(
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


            group.add(wheel);

        }
    );

}


/* =========================================================
   ANIMATION
   ========================================================= */

function animate() {

    requestAnimationFrame(
        animate
    );


    const delta =
        clock
            ? clock.getDelta()
            : 0.016;


    if (
        isPlaying &&
        !isPaused
    ) {

        updateLocalPlayer(
            delta
        );

    }


    updateCamera();


    if (renderer && scene && camera) {

        renderer.render(
            scene,
            camera
        );

    }

}


/* =========================================================
   DÉPLACEMENT
   ========================================================= */

function updateLocalPlayer(
    delta
) {

    let speed =
        inVehicle
            ? 18
            : 7;


    if (
        currentVehicle === "plane"
    ) {
        speed = 30;
    }


    if (
        currentVehicle === "boat"
    ) {
        speed = 12;
    }


    let moveX = 0;
    let moveZ = 0;


    if (controls.forward) {
        moveZ -= 1;
    }


    if (controls.backward) {
        moveZ += 1;
    }


    if (controls.left) {

        playerRotation +=
            2.5 * delta;

    }


    if (controls.right) {

        playerRotation -=
            2.5 * delta;

    }


    if (joystickActive) {

        moveX += joystickX;
        moveZ += joystickY;

    }


    const length =
        Math.hypot(
            moveX,
            moveZ
        );


    if (length > 1) {

        moveX /= length;
        moveZ /= length;

    }


    const sin =
        Math.sin(
            playerRotation
        );


    const cos =
        Math.cos(
            playerRotation
        );


    const worldX =
        moveX * cos -
        moveZ * sin;


    const worldZ =
        moveX * sin +
        moveZ * cos;


    playerPosition.x +=
        worldX *
        speed *
        delta;


    playerPosition.z +=
        worldZ *
        speed *
        delta;


    if (localPlayer) {

        localPlayer.position.x =
            playerPosition.x;


        localPlayer.position.z =
            playerPosition.z;


        localPlayer.rotation.y =
            playerRotation;

    }


    sendPlayerPosition();

}


/* =========================================================
   CAMÉRA
   ========================================================= */

function updateCamera() {

    if (!camera || !localPlayer) {
        return;
    }


    const distance =
        inVehicle
            ? 12
            : 8;


    const height =
        inVehicle
            ? 7
            : 5;


    const targetX =
        playerPosition.x -
        Math.sin(playerRotation) *
        distance;


    const targetZ =
        playerPosition.z -
        Math.cos(playerRotation) *
        distance;


    camera.position.x +=
        (
            targetX -
            camera.position.x
        ) * 0.08;


    camera.position.y +=
        (
            height -
            camera.position.y
        ) * 0.08;


    camera.position.z +=
        (
            targetZ -
            camera.position.z
        ) * 0.08;


    camera.lookAt(
        playerPosition.x,
        1,
        playerPosition.z
    );

}


/* =========================================================
   WEBSOCKET
   ========================================================= */

function connectWebSocket() {

    if (connecting) {
        return;
    }


    if (
        socket &&
        socket.readyState === WebSocket.OPEN
    ) {
        return;
    }


    connecting = true;


    console.log(
        "Connexion à :",
        SERVER_URL
    );


    try {

        socket =
            new WebSocket(
                SERVER_URL
            );


        socket.onopen =
            () => {

                connecting = false;
                connected = true;


                console.log(
                    "🟢 RoadGame connecté"
                );


                showNotification(
                    "Serveur connecté"
                );

            };


        socket.onmessage =
            event => {

                try {

                    const data =
                        JSON.parse(
                            event.data
                        );


                    handleServerMessage(
                        data
                    );

                } catch (error) {

                    console.error(
                        "Message serveur invalide :",
                        error
                    );

                }

            };


        socket.onerror =
            error => {

                console.error(
                    "Erreur WebSocket :",
                    error
                );

            };


        socket.onclose =
            () => {

                connecting = false;
                connected = false;


                console.log(
                    "🔴 Serveur déconnecté"
                );


                showNotification(
                    "Serveur déconnecté"
                );


                // Reconnexion automatique
                setTimeout(
                    () => {

                        if (!connected) {
                            connectWebSocket();
                        }

                    },
                    5000
                );

            };

    } catch (error) {

        connecting = false;
        connected = false;


        console.error(
            "Impossible de créer WebSocket :",
            error
        );

    }

}


/* =========================================================
   ENVOYER AU SERVEUR
   ========================================================= */

function send(data) {

    if (
        !socket ||
        socket.readyState !==
            WebSocket.OPEN
    ) {

        showNotification(
            "Serveur non connecté"
        );


        return false;

    }


    try {

        socket.send(
            JSON.stringify(data)
        );


        return true;

    } catch (error) {

        console.error(
            "Erreur envoi :",
            error
        );


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

            currentUser =
                data.user;

            selectedVehicle =
                currentUser.selectedVehicle ||
                "car";

            updateUserInterface();

            showMainMenu();

            showNotification(
                "Compte créé !"
            );

            break;


        case "login_success":

            currentUser =
                data.user;

            selectedVehicle =
                currentUser.selectedVehicle ||
                "car";

            updateUserInterface();

            showMainMenu();

            showNotification(
                "Connexion réussie !"
            );

            break;


        case "username_changed":

            if (currentUser) {

                currentUser.username =
                    data.username;

            }


            updateUserInterface();


            closeScreen(
                "usernameScreen"
            );


            showNotification(
                "Pseudo modifié"
            );

            break;


        case "friend_request_sent":

            showNotification(
                "Demande d'ami envoyée"
            );

            break;


        case "friend_added":

            currentUser =
                data.user;

            updateFriendsUI();


            showNotification(
                "Ami ajouté !"
            );

            break;


        case "room_created":

            currentRoom =
                data.room;

            currentPlayerId =
                data.playerId;


            updateRoomUI(
                data
            );


            openScreen(
                "roomScreen"
            );

            break;


        case "room_joined":

            currentRoom =
                data.room;

            currentPlayerId =
                data.playerId;


            updateRoomUI(
                data
            );


            openScreen(
                "roomScreen"
            );

            break;


        case "quick_match_searching":

            showNotification(
                "Recherche d'une partie..."
            );

            break;


        case "quick_match_found":

            currentRoom =
                data.room;

            currentPlayerId =
                data.playerId;


            updateRoomUI(
                data
            );


            openScreen(
                "roomScreen"
            );


            showNotification(
                "Partie rapide trouvée !"
            );

            break;


        case "player_joined":

            addRemotePlayer(
                data.player
            );


            roomPlayers.push(
                data.player
            );


            updatePlayersList();

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

            updateRemoteVehicle({
                ...data,
                vehicle: "walk",
                inVehicle: false
            });

            break;


        case "player_left":

            removeRemotePlayer(
                data.playerId
            );


            roomPlayers =
                roomPlayers.filter(
                    player =>
                        player.id !==
                        data.playerId
                );


            updatePlayersList();

            break;


        case "vehicle_purchased":

            if (currentUser) {

                currentUser.vehicles =
                    data.vehicles;

            }


            updateGarageUI();
            updateShopUI();


            showNotification(
                "Véhicule ajouté au garage !"
            );

            break;


        case "settings_updated":

            if (currentUser) {

                currentUser.settings =
                    data.settings;

            }

            break;


        case "error":

            showNotification(
                data.message ||
                "Une erreur est survenue."
            );


            showErrorInCurrentScreen(
                data.message
            );

            break;


        case "pong":
            break;

    }

}


/* =========================================================
   COMPTE
   ========================================================= */

function register() {

    const username =
        document
            .getElementById(
                "usernameInput"
            )
            ?.value.trim();


    const password =
        document
            .getElementById(
                "passwordInput"
            )
            ?.value;


    if (!username || !password) {

        setAuthMessage(
            "Remplis tous les champs."
        );


        return;

    }


    if (!connected) {

        setAuthMessage(
            "Serveur non connecté. Attends quelques secondes."
        );


        return;

    }


    send({
        type: "register",
        username,
        password
    });

}


function login() {

    const username =
        document
            .getElementById(
                "usernameInput"
            )
            ?.value.trim();


    const password =
        document
            .getElementById(
                "passwordInput"
            )
            ?.value;


    if (!username || !password) {

        setAuthMessage(
            "Remplis tous les champs."
        );


        return;

    }


    if (!connected) {

        setAuthMessage(
            "Serveur non connecté. Attends quelques secondes."
        );


        return;

    }


    send({
        type: "login",
        username,
        password
    });

}


/* =========================================================
   INVITÉ
   ========================================================= */

function playGuest() {

    currentUser = {

        id: null,

        username: "Joueur",

        friends: [],

        friendRequests: [],

        vehicles: [
            "car"
        ],

        selectedVehicle: "car",

        settings: {
            sound: true,
            music: true
        }

    };


    selectedVehicle =
        "car";


    showMainMenu();

}


/* =========================================================
   PARTIE RAPIDE
   ========================================================= */

function startQuickMatch() {

    if (!connected) {

        showNotification(
            "Serveur non connecté."
        );


        return;

    }


    send({
        type: "quick_match",
        vehicle: selectedVehicle
    });

}


/* =========================================================
   PARTIE PUBLIQUE
   ========================================================= */

function createPublicRoom() {

    send({
        type: "create_room",
        vehicle: selectedVehicle
    });

}


/* =========================================================
   PARTIE PRIVÉE
   ========================================================= */

function createPrivateRoom() {

    const password =
        document
            .getElementById(
                "privatePasswordInput"
            )
            ?.value;


    if (!password) {

        setMessage(
            "privateRoomMessage",
            "Entre un mot de passe."
        );


        return;

    }


    send({

        type: "create_private_room",

        password,

        vehicle:
            selectedVehicle

    });

}


/* =========================================================
   REJOINDRE
   ========================================================= */

function joinRoom() {

    const room =
        document
            .getElementById(
                "roomCodeInput"
            )
            ?.value
            .trim();


    const password =
        document
            .getElementById(
                "roomPasswordInput"
            )
            ?.value ||
        "";


    if (!room) {

        setMessage(
            "multiplayerMessage",
            "Entre le code de la partie."
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


/* =========================================================
   DÉMARRER
   ========================================================= */

function startGame() {

    isPlaying = true;
    isPaused = false;


    closeAllScreens();


    document
        .getElementById(
            "gameHud"
        )
        ?.classList.remove(
            "hidden"
        );


    updateHud();


    if (currentRoom) {

        send({

            type: "player_update",

            latitude: 48.8566,

            longitude: 2.3522,

            rotation: playerRotation

        });

    }

}


/* =========================================================
   QUITTER LE JEU
   ========================================================= */

function exitGame() {

    isPlaying = false;
    isPaused = false;


    currentRoom = null;
    currentPlayerId = null;


    document
        .getElementById(
            "gameHud"
        )
        ?.classList.add(
            "hidden"
        );


    removeAllRemotePlayers();


    showMainMenu();

}


/* =========================================================
   ENTRER DANS LE VÉHICULE
   ========================================================= */

function enterVehicle() {

    if (inVehicle) {
        return;
    }


    inVehicle = true;


    currentVehicle =
        selectedVehicle;


    createLocalPlayer();


    updateHud();


    send({

        type: "enter_vehicle",

        vehicle:
            currentVehicle

    });


    updateVehicleButtons();

}


/* =========================================================
   SORTIR DU VÉHICULE
   ========================================================= */

function exitVehicle() {

    if (!inVehicle) {
        return;
    }


    inVehicle = false;


    currentVehicle =
        "walk";


    createLocalPlayer();


    updateHud();


    send({
        type: "exit_vehicle"
    });


    updateVehicleButtons();

}


/* =========================================================
   CHOISIR VÉHICULE
   ========================================================= */

function selectVehicle(vehicle) {

    if (!VEHICLES[vehicle]) {
        return;
    }


    if (
        currentUser &&
        currentUser.vehicles &&
        !currentUser.vehicles.includes(
            vehicle
        )
    ) {

        showNotification(
            "Tu ne possèdes pas ce véhicule."
        );


        return;

    }


    selectedVehicle =
        vehicle;


    if (currentUser) {

        currentUser.selectedVehicle =
            vehicle;

    }


    updateGarageUI();

}


/* =========================================================
   UTILISER VÉHICULE
   ========================================================= */

function useSelectedVehicle() {

    currentVehicle =
        selectedVehicle;


    inVehicle =
        selectedVehicle !== "walk";


    createLocalPlayer();


    updateHud();


    updateVehicleButtons();


    send({

        type: "vehicle_update",

        vehicle:
            selectedVehicle

    });


    closeScreen(
        "garageScreen"
    );


    showNotification(
        VEHICLES[selectedVehicle].icon +
        " " +
        VEHICLES[selectedVehicle].name +
        " sélectionné"
    );

}


/* =========================================================
   ACHETER
   ========================================================= */

function buyVehicle(vehicle) {

    send({

        type: "buy_vehicle",

        vehicle

    });

}


/* =========================================================
   POSITION MULTI
   ========================================================= */

function sendPlayerPosition() {

    if (
        !currentRoom ||
        !socket ||
        socket.readyState !==
            WebSocket.OPEN
    ) {
        return;
    }


    const now =
        performance.now();


    if (
        now - lastPositionSend <
        100
    ) {
        return;
    }


    lastPositionSend =
        now;


    send({

        type: "player_update",

        latitude:
            48.8566 +
            playerPosition.z /
            111000,

        longitude:
            2.3522 +
            playerPosition.x /
            111000,

        rotation:
            playerRotation

    });

}


/* =========================================================
   JOUEUR DISTANT
   ========================================================= */

function addRemotePlayer(player) {

    if (
        !player ||
        player.id === currentPlayerId
    ) {
        return;
    }


    removeRemotePlayer(
        player.id
    );


    const object =
        createVehicleObject(
            player.vehicle ||
            "car"
        );


    object.position.set(
        gpsToX(player.longitude),
        1,
        gpsToZ(player.latitude)
    );


    object.rotation.y =
        player.rotation || 0;


    scene?.add(
        object
    );


    remotePlayers.set(
        player.id,
        {
            object,
            data: player
        }
    );

}


function updateRemotePlayer(player) {

    if (
        !player ||
        player.id === currentPlayerId
    ) {
        return;
    }


    let remote =
        remotePlayers.get(
            player.id
        );


    if (!remote) {

        addRemotePlayer(
            player
        );


        return;

    }


    remote.data =
        player;


    remote.object.position.x =
        gpsToX(
            player.longitude
        );


    remote.object.position.z =
        gpsToZ(
            player.latitude
        );


    remote.object.rotation.y =
        player.rotation || 0;

}


function updateRemoteVehicle(data) {

    const remote =
        remotePlayers.get(
            data.playerId
        );


    if (!remote) {
        return;
    }


    const position =
        remote.object.position.clone();


    scene?.remove(
        remote.object
    );


    const newObject =
        createVehicleObject(
            data.vehicle ||
            "walk"
        );


    newObject.position.copy(
        position
    );


    scene?.add(
        newObject
    );


    remote.object =
        newObject;


    remote.data.vehicle =
        data.vehicle;

}


function removeRemotePlayer(id) {

    const remote =
        remotePlayers.get(id);


    if (!remote) {
        return;
    }


    scene?.remove(
        remote.object
    );


    remotePlayers.delete(
        id
    );

}


function removeAllRemotePlayers() {

    remotePlayers.forEach(
        remote => {

            scene?.remove(
                remote.object
            );

        }
    );


    remotePlayers.clear();

}


/* =========================================================
   GPS
   ========================================================= */

function gpsToX(longitude) {

    return (
        longitude -
        2.3522
    ) * 111000;

}


function gpsToZ(latitude) {

    return (
        latitude -
        48.8566
    ) * 111000;

}


/* =========================================================
   HUD
   ========================================================= */

function updateHud() {

    const name =
        document.getElementById(
            "hudPlayerName"
        );


    const vehicle =
        document.getElementById(
            "hudVehicle"
        );


    if (name) {

        name.textContent =
            currentUser
                ? currentUser.username
                : "Joueur";

    }


    if (vehicle) {

        const data =
            VEHICLES[currentVehicle];


        vehicle.textContent =
            data
                ? data.icon +
                  " " +
                  data.name
                : "À pied";

    }


    updateVehicleButtons();

}


function updateVehicleButtons() {

    const enter =
        document.getElementById(
            "enterVehicleButton"
        );


    const exit =
        document.getElementById(
            "exitVehicleButton"
        );


    if (!enter || !exit) {
        return;
    }


    if (inVehicle) {

        enter.classList.add(
            "hidden"
        );


        exit.classList.remove(
            "hidden"
        );

    } else {

        enter.classList.remove(
            "hidden"
        );


        exit.classList.add(
            "hidden"
        );

    }

}


/* =========================================================
   GARAGE
   ========================================================= */

function updateGarageUI() {

    const container =
        document.getElementById(
            "garageVehicles"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    const owned =
        currentUser?.vehicles ||
        ["car"];


    owned.forEach(
        vehicle => {

            if (!VEHICLES[vehicle]) {
                return;
            }


            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "vehicleCard";


            if (
                selectedVehicle ===
                vehicle
            ) {

                card.classList.add(
                    "selected"
                );

            }


            card.innerHTML = `

                <div class="vehicleIcon">
                    ${VEHICLES[vehicle].icon}
                </div>

                <div class="vehicleName">
                    ${VEHICLES[vehicle].name}
                </div>

                <button>
                    ${
                        selectedVehicle === vehicle
                            ? "✓ Sélectionné"
                            : "Choisir"
                    }
                </button>

            `;


            card
                .querySelector("button")
                .addEventListener(
                    "click",
                    () => {

                        selectVehicle(
                            vehicle
                        );

                    }
                );


            container.appendChild(
                card
            );

        }
    );


    const selectedText =
        document.getElementById(
            "selectedVehicleText"
        );


    if (selectedText) {

        const vehicle =
            VEHICLES[
                selectedVehicle
            ];


        selectedText.textContent =
            "Véhicule sélectionné : " +
            (
                vehicle
                    ? vehicle.icon +
                      " " +
                      vehicle.name
                    : selectedVehicle
            );

    }

}


/* =========================================================
   MAGASIN
   ========================================================= */

function updateShopUI() {

    const container =
        document.getElementById(
            "shopVehicles"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    const owned =
        currentUser?.vehicles ||
        [];


    Object.keys(
        VEHICLES
    ).forEach(
        vehicle => {

            if (vehicle === "walk") {
                return;
            }


            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "vehicleCard";


            const isOwned =
                owned.includes(
                    vehicle
                );


            card.innerHTML = `

                <div class="vehicleIcon">
                    ${VEHICLES[vehicle].icon}
                </div>

                <div class="vehicleName">
                    ${VEHICLES[vehicle].name}
                </div>

                <div class="vehiclePrice">
                    ${
                        isOwned
                            ? "Déjà possédé"
                            : "Disponible"
                    }
                </div>

                ${
                    isOwned
                        ? ""
                        : "<button>Acheter</button>"
                }

            `;


            if (!isOwned) {

                card
                    .querySelector(
                        "button"
                    )
                    .addEventListener(
                        "click",
                        () => {

                            buyVehicle(
                                vehicle
                            );

                        }
                    );

            }


            container.appendChild(
                card
            );

        }
    );

}


/* =========================================================
   AMIS
   ========================================================= */

function updateFriendsUI() {

    if (!currentUser) {
        return;
    }


    const requests =
        document.getElementById(
            "friendRequestsList"
        );


    const friends =
        document.getElementById(
            "friendsList"
        );


    if (requests) {

        requests.innerHTML = "";


        const list =
            currentUser.friendRequests ||
            [];


        if (!list.length) {

            requests.innerHTML =
                `<p class="emptyText">
                    Aucune demande.
                </p>`;

        } else {

            list.forEach(
                userId => {

                    const item =
                        document.createElement(
                            "div"
                        );


                    item.className =
                        "requestItem";


                    item.innerHTML = `

                        <span>
                            Demande d'ami
                        </span>

                        <button>
                            Accepter
                        </button>

                    `;


                    item
                        .querySelector(
                            "button"
                        )
                        .addEventListener(
                            "click",
                            () => {

                                send({

                                    type:
                                        "friend_accept",

                                    userId

                                });

                            }
                        );


                    requests.appendChild(
                        item
                    );

                }
            );

        }

    }


    if (friends) {

        friends.innerHTML = "";


        const list =
            currentUser.friends ||
            [];


        if (!list.length) {

            friends.innerHTML =
                `<p class="emptyText">
                    Tu n'as pas encore d'amis.
                </p>`;

        } else {

            list.forEach(
                userId => {

                    const item =
                        document.createElement(
                            "div"
                        );


                    item.className =
                        "friendItem";


                    item.innerHTML = `

                        <span class="friendName">
                            Ami
                        </span>

                    `;


                    friends.appendChild(
                        item
                    );

                }
            );

        }

    }

}


/* =========================================================
   SALLE
   ========================================================= */

function updateRoomUI(data) {

    roomPlayers =
        data.players ||
        [];


    const code =
        document.getElementById(
            "currentRoomCode"
        );


    if (code) {

        code.textContent =
            data.room ||
            "------";

    }


    updatePlayersList();

}


function updatePlayersList() {

    const container =
        document.getElementById(
            "playersList"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    roomPlayers.forEach(
        player => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "playerItem";


            item.innerHTML = `

                <span class="playerName">
                    ${
                        player.name ||
                        "Joueur"
                    }
                </span>

                <span>
                    ${
                        VEHICLES[
                            player.vehicle
                        ]?.icon ||
                        "🚗"
                    }
                </span>

            `;


            container.appendChild(
                item
            );

        }
    );

}


/* =========================================================
   INTERFACE
   ========================================================= */

function showAuthScreen() {

    closeAllScreens();


    document
        .getElementById(
            "authScreen"
        )
        ?.classList.remove(
            "hidden"
        );

}


function showMainMenu() {

    closeAllScreens();


    document
        .getElementById(
            "mainMenu"
        )
        ?.classList.remove(
            "hidden"
        );


    updateUserInterface();

}


function updateUserInterface() {

    const welcome =
        document.getElementById(
            "welcomeText"
        );


    if (welcome) {

        welcome.textContent =
            currentUser
                ? "Bonjour " +
                  currentUser.username
                : "Joueur";

    }

}


function openScreen(id) {

    document
        .getElementById(id)
        ?.classList.remove(
            "hidden"
        );

}


function closeScreen(id) {

    document
        .getElementById(id)
        ?.classList.add(
            "hidden"
        );

}


function closeAllScreens() {

    document
        .querySelectorAll(
            ".screen"
        )
        .forEach(
            element => {

                element.classList.add(
                    "hidden"
                );

            }
        );

}


/* =========================================================
   NOTIFICATIONS
   ========================================================= */

function showNotification(text) {

    const container =
        document.getElementById(
            "notifications"
        );


    if (!container) {
        return;
    }


    const notification =
        document.createElement(
            "div"
        );


    notification.className =
        "notification";


    notification.textContent =
        text;


    container.appendChild(
        notification
    );


    setTimeout(
        () => {

            notification.remove();

        },
        3000
    );

}


/* =========================================================
   MESSAGES
   ========================================================= */

function setMessage(
    id,
    text
) {

    const element =
        document.getElementById(id);


    if (element) {
        element.textContent =
            text;
    }

}


function setAuthMessage(text) {

    setMessage(
        "authMessage",
        text
    );

}


function showErrorInCurrentScreen(text) {

    setMessage(
        "multiplayerMessage",
        text
    );

}


/* =========================================================
   BOUTONS
   ========================================================= */

function setupButtons() {

    document
        .getElementById("loginButton")
        ?.addEventListener(
            "click",
            login
        );


    document
        .getElementById("registerButton")
        ?.addEventListener(
            "click",
            register
        );


    document
        .getElementById("guestButton")
        ?.addEventListener(
            "click",
            playGuest
        );


    document
        .getElementById("playButton")
        ?.addEventListener(
            "click",
            startGame
        );


    document
        .getElementById("quickMatchButton")
        ?.addEventListener(
            "click",
            startQuickMatch
        );


    document
        .getElementById("quickMatchButton2")
        ?.addEventListener(
            "click",
            startQuickMatch
        );


    document
        .getElementById("multiplayerButton")
        ?.addEventListener(
            "click",
            () =>
                openScreen(
                    "multiplayerScreen"
                )
        );


    document
        .getElementById("garageButton")
        ?.addEventListener(
            "click",
            () => {

                updateGarageUI();

                openScreen(
                    "garageScreen"
                );

            }
        );


    document
        .getElementById("shopButton")
        ?.addEventListener(
            "click",
            () => {

                updateShopUI();

                openScreen(
                    "shopScreen"
                );

            }
        );


    document
        .getElementById("friendsButton")
        ?.addEventListener(
            "click",
            () => {

                updateFriendsUI();

                openScreen(
                    "friendsScreen"
                );

            }
        );


    document
        .getElementById("settingsButton")
        ?.addEventListener(
            "click",
            () =>
                openScreen(
                    "settingsScreen"
                )
        );


    document
        .getElementById("createRoomButton")
        ?.addEventListener(
            "click",
            createPublicRoom
        );


    document
        .getElementById("createPrivateRoomButton")
        ?.addEventListener(
            "click",
            () =>
                openScreen(
                    "privateRoomScreen"
                )
        );


    document
        .getElementById("confirmPrivateRoomButton")
        ?.addEventListener(
            "click",
            createPrivateRoom
        );


    document
        .getElementById("joinRoomButton")
        ?.addEventListener(
            "click",
            joinRoom
        );


    document
        .getElementById("startRoomButton")
        ?.addEventListener(
            "click",
            startGame
        );


    document
        .getElementById("leaveRoomButton")
        ?.addEventListener(
            "click",
            leaveRoom
        );


    document
        .getElementById("sendFriendRequestButton")
        ?.addEventListener(
            "click",
            sendFriendRequest
        );


    document
        .getElementById("changeUsernameButton")
        ?.addEventListener(
            "click",
            () =>
                openScreen(
                    "usernameScreen"
                )
        );


    document
        .getElementById("confirmUsernameButton")
        ?.addEventListener(
            "click",
            changeUsername
        );


    document
        .getElementById("logoutButton")
        ?.addEventListener(
            "click",
            logout
        );


    document
        .getElementById("soundToggle")
        ?.addEventListener(
            "change",
            updateSettings
        );


    document
        .getElementById("musicToggle")
        ?.addEventListener(
            "change",
            updateSettings
        );


    document
        .getElementById("enterVehicleButton")
        ?.addEventListener(
            "click",
            enterVehicle
        );


    document
        .getElementById("exitVehicleButton")
        ?.addEventListener(
            "click",
            exitVehicle
        );


    document
        .getElementById("spawnVehicleButton")
        ?.addEventListener(
            "click",
            useSelectedVehicle
        );


    document
        .getElementById("mapButton")
        ?.addEventListener(
            "click",
            openMap
        );


    document
        .getElementById("closeMapButton")
        ?.addEventListener(
            "click",
            () =>
                closeScreen(
                    "mapScreen"
                )
        );


    document
        .getElementById("menuGameButton")
        ?.addEventListener(
            "click",
            pauseGame
        );


    document
        .getElementById("resumeButton")
        ?.addEventListener(
            "click",
            resumeGame
        );


    document
        .getElementById("exitGameButton")
        ?.addEventListener(
            "click",
            exitGame
        );


    document
        .querySelectorAll(
            "[data-close]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        closeScreen(
                            button.dataset.close
                        );

                    }
                );

            }
        );

}


/* =========================================================
   AMIS
   ========================================================= */

function sendFriendRequest() {

    const input =
        document.getElementById(
            "friendUsernameInput"
        );


    const username =
        input?.value.trim();


    if (!username) {
        return;
    }


    send({

        type:
            "friend_request",

        username

    });


    if (input) {
        input.value = "";
    }

}


/* =========================================================
   PSEUDO
   ========================================================= */

function changeUsername() {

    const input =
        document.getElementById(
            "newUsernameInput"
        );


    const username =
        input?.value.trim();


    if (!username) {

        setMessage(
            "usernameMessage",
            "Entre un pseudo."
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
   PARAMÈTRES
   ========================================================= */

function updateSettings() {

    send({

        type:
            "settings_update",

        sound:
            document.getElementById(
                "soundToggle"
            )?.checked ?? true,

        music:
            document.getElementById(
                "musicToggle"
            )?.checked ?? true

    });

}


/* =========================================================
   LOGOUT
   ========================================================= */

function logout() {

    currentUser = null;
    currentRoom = null;
    currentPlayerId = null;

    isPlaying = false;


    showAuthScreen();

}


/* =========================================================
   QUITTER SALLE
   ========================================================= */

function leaveRoom() {

    send({
        type: "leave_room"
    });


    currentRoom = null;
    currentPlayerId = null;


    removeAllRemotePlayers();


    showMainMenu();

}


/* =========================================================
   PAUSE
   ========================================================= */

function pauseGame() {

    if (!isPlaying) {
        return;
    }


    isPaused = true;


    openScreen(
        "pauseScreen"
    );

}


function resumeGame() {

    isPaused = false;


    closeScreen(
        "pauseScreen"
    );

}


/* =========================================================
   CARTE
   ========================================================= */

function openMap() {

    openScreen(
        "mapScreen"
    );


    drawMap();

}


function drawMap() {

    const canvas =
        document.getElementById(
            "mapCanvas"
        );


    if (!canvas) {
        return;
    }


    const ctx =
        canvas.getContext(
            "2d"
        );


    canvas.width =
        window.innerWidth;


    canvas.height =
        window.innerHeight;


    ctx.fillStyle =
        "#d6d6d6";


    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    const gridSize = 80;


    ctx.strokeStyle =
        "#999";


    ctx.lineWidth = 2;


    for (
        let x = 0;
        x < canvas.width;
        x += gridSize
    ) {

        ctx.beginPath();

        ctx.moveTo(x, 0);

        ctx.lineTo(
            x,
            canvas.height
        );

        ctx.stroke();

    }


    for (
        let y = 0;
        y < canvas.height;
        y += gridSize
    ) {

        ctx.beginPath();

        ctx.moveTo(0, y);

        ctx.lineTo(
            canvas.width,
            y
        );

        ctx.stroke();

    }


    ctx.fillStyle =
        "#1677ff";


    ctx.beginPath();


    ctx.arc(
        canvas.width / 2,
        canvas.height / 2,
        10,
        0,
        Math.PI * 2
    );


    ctx.fill();


    ctx.fillStyle =
        "#111";


    ctx.font =
        "bold 15px Arial";


    ctx.textAlign =
        "center";


    ctx.fillText(
        "Vous",
        canvas.width / 2,
        canvas.height / 2 - 18
    );

}


/* =========================================================
   CLAVIER
   ========================================================= */

function setupKeyboard() {

    window.addEventListener(
        "keydown",
        event => {

            switch (
                event.key.toLowerCase()
            ) {

                case "z":
                case "arrowup":
                    controls.forward = true;
                    break;


                case "s":
                case "arrowdown":
                    controls.backward = true;
                    break;


                case "q":
                case "arrowleft":
                    controls.left = true;
                    break;


                case "d":
                case "arrowright":
                    controls.right = true;
                    break;


                case "e":

                    if (inVehicle) {
                        exitVehicle();
                    } else {
                        enterVehicle();
                    }

                    break;

            }

        }
    );


    window.addEventListener(
        "keyup",
        event => {

            switch (
                event.key.toLowerCase()
            ) {

                case "z":
                case "arrowup":
                    controls.forward = false;
                    break;


                case "s":
                case "arrowdown":
                    controls.backward = false;
                    break;


                case "q":
                case "arrowleft":
                    controls.left = false;
                    break;


                case "d":
                case "arrowright":
                    controls.right = false;
                    break;

            }

        }
    );

}


/* =========================================================
   JOYSTICK
   ========================================================= */

function setupTouchControls() {

    const joystick =
        document.getElementById(
            "joystick"
        );


    const stick =
        document.getElementById(
            "joystickStick"
        );


    if (!joystick || !stick) {
        return;
    }


    joystick.addEventListener(
        "touchstart",
        event => {

            event.preventDefault();


            const touch =
                event.changedTouches[0];


            joystickActive = true;


            joystickTouchId =
                touch.identifier;


            updateJoystick(
                touch
            );

        },
        {
            passive: false
        }
    );


    joystick.addEventListener(
        "touchmove",
        event => {

            event.preventDefault();


            for (
                const touch
                of event.changedTouches
            ) {

                if (
                    touch.identifier ===
                    joystickTouchId
                ) {

                    updateJoystick(
                        touch
                    );

                }

            }

        },
        {
            passive: false
        }
    );


    joystick.addEventListener(
        "touchend",
        event => {

            event.preventDefault();


            for (
                const touch
                of event.changedTouches
            ) {

                if (
                    touch.identifier ===
                    joystickTouchId
                ) {

                    joystickActive = false;

                    joystickTouchId = null;

                    joystickX = 0;
                    joystickY = 0;


                    stick.style.transform =
                        "translate(0px, 0px)";

                }

            }

        },
        {
            passive: false
        }
    );

}


function updateJoystick(touch) {

    const joystick =
        document.getElementById(
            "joystick"
        );


    const stick =
        document.getElementById(
            "joystickStick"
        );


    if (!joystick || !stick) {
        return;
    }


    const rect =
        joystick.getBoundingClientRect();


    const centerX =
        rect.left +
        rect.width / 2;


    const centerY =
        rect.top +
        rect.height / 2;


    let dx =
        touch.clientX -
        centerX;


    let dy =
        touch.clientY -
        centerY;


    const max =
        rect.width / 2 -
        30;


    const distance =
        Math.hypot(
            dx,
            dy
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
        `translate(${dx}px, ${dy}px)`;

}


/* =========================================================
   BOUTONS CONDUITE
   ========================================================= */

function setupDrivingButtons() {

    holdButton(
        "accelerateButton",
        "forward"
    );


    holdButton(
        "brakeButton",
        "backward"
    );


    holdButton(
        "leftButton",
        "left"
    );


    holdButton(
        "rightButton",
        "right"
    );

}


function holdButton(
    id,
    property
) {

    const button =
        document.getElementById(id);


    if (!button) {
        return;
    }


    const start =
        event => {

            event.preventDefault();

            controls[property] =
                true;

        };


    const end =
        event => {

            event.preventDefault();

            controls[property] =
                false;

        };


    button.addEventListener(
        "touchstart",
        start,
        {
            passive: false
        }
    );


    button.addEventListener(
        "touchend",
        end,
        {
            passive: false
        }
    );


    button.addEventListener(
        "touchcancel",
        end,
        {
            passive: false
        }
    );


    button.addEventListener(
        "mousedown",
        start
    );


    button.addEventListener(
        "mouseup",
        end
    );


    button.addEventListener(
        "mouseleave",
        end
    );

}


/* =========================================================
   REDIMENSIONNEMENT
   ========================================================= */

window.addEventListener(
    "resize",
    () => {

        if (
            camera &&
            renderer
        ) {

            camera.aspect =
                window.innerWidth /
                window.innerHeight;


            camera.updateProjectionMatrix();


            renderer.setSize(
                window.innerWidth,
                window.innerHeight
            );

        }

    }
);
