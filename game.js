// =====================================================
// ROADGAME
// MAP 3D + MULTIJOUEUR
// =====================================================


// =====================================================
// SERVEUR MULTIJOUEUR
// =====================================================

const SERVER_URL =
    "wss://roadgame-server.onrender.com";


// =====================================================
// THREE.JS
// =====================================================

let scene;
let camera;
let renderer;

let player;
let playerBody;

let clock;

let gameStarted = false;

let playerX = 0;
let playerZ = 0;

let cameraAngle = 0;

let speed = 0.45;

let currentVehicle = "car";

let keys = {
    forward: false,
    back: false,
    left: false,
    right: false
};


// =====================================================
// MULTIJOUEUR
// =====================================================

let socket = null;

let connected = false;

let roomCode = null;

let playerId = null;

let playerName = "Joueur";

const otherPlayers = new Map();


// =====================================================
// DOM
// =====================================================

const game =
    document.getElementById("game");

const menu =
    document.getElementById("menu");

const locationInput =
    document.getElementById("location");

const playButton =
    document.getElementById("play");

const message =
    document.getElementById("message");

const loading =
    document.getElementById("loading");

const hud =
    document.getElementById("hud");

const info =
    document.getElementById("info");

const controls =
    document.getElementById("controls");

const vehiclePanel =
    document.getElementById("vehiclePanel");

const cameraControls =
    document.getElementById("cameraControls");

const multiplayerUI =
    document.getElementById("multiplayerUI");


// =====================================================
// JOUER
// =====================================================

playButton.addEventListener(
    "click",
    startGame
);


async function startGame() {

    const location =
        locationInput.value.trim();


    if (!location) {

        message.textContent =
            "❌ Entre une ville ou une adresse.";

        return;
    }


    loading.style.display =
        "flex";


    try {

        initThree();

        await sleep(300);

        generateCity(location);

        menu.style.display =
            "none";

        hud.style.display =
            "block";

        controls.style.display =
            "block";

        vehiclePanel.style.display =
            "block";

        cameraControls.style.display =
            "block";

        document.getElementById(
            "openMP"
        ).style.display =
            "block";

        gameStarted = true;

        info.textContent =
            "📍 " + location;

        animate();

    } catch (error) {

        console.error(error);

        alert(
            "Erreur pendant la création de la map : " +
            error.message
        );
    }


    loading.style.display =
        "none";
}


// =====================================================
// THREE
// =====================================================

function initThree() {

    if (
        typeof THREE ===
        "undefined"
    ) {

        throw new Error(
            "Three.js ne s'est pas chargé."
        );
    }


    scene =
        new THREE.Scene();


    scene.background =
        new THREE.Color(
            0x76bff2
        );


    scene.fog =
        new THREE.Fog(
            0x76bff2,
            100,
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


    renderer.shadowMap.enabled =
        true;


    renderer.shadowMap.type =
        THREE.PCFSoftShadowMap;


    game.appendChild(
        renderer.domElement
    );


    clock =
        new THREE.Clock();


    // Lumière très forte pour éviter
    // que la map soit noire.

    const skyLight =
        new THREE.HemisphereLight(
            0xffffff,
            0x557755,
            2.5
        );


    scene.add(
        skyLight
    );


    const sun =
        new THREE.DirectionalLight(
            0xffffff,
            3
        );


    sun.position.set(
        100,
        180,
        100
    );


    sun.castShadow =
        true;


    scene.add(
        sun
    );


    window.addEventListener(
        "resize",
        resize
    );
}


// =====================================================
// GÉNÉRER LA VILLE
// =====================================================

function generateCity(
    location
) {

    // SOL

    const ground =
        new THREE.Mesh(
            new THREE.PlaneGeometry(
                700,
                700
            ),
            new THREE.MeshStandardMaterial({
                color: 0x4f9b4f,
                roughness: 1
            })
        );


    ground.rotation.x =
        -Math.PI / 2;


    ground.position.y =
        -0.05;


    ground.receiveShadow =
        true;


    scene.add(
        ground
    );


    // ROUTES PRINCIPALES

    createRoad(
        0,
        0,
        700,
        20,
        true
    );


    createRoad(
        0,
        0,
        700,
        20,
        false
    );


    // ROUTES SECONDAIRES

    for (
        let i = -300;
        i <= 300;
        i += 60
    ) {

        if (i === 0)
            continue;


        createRoad(
            i,
            0,
            700,
            12,
            true
        );


        createRoad(
            0,
            i,
            700,
            12,
            false
        );
    }


    // BÂTIMENTS

    for (
        let x = -300;
        x <= 300;
        x += 30
    ) {

        for (
            let z = -300;
            z <= 300;
            z += 30
        ) {

            // espaces pour les routes

            if (
                Math.abs(x % 60) < 12 ||
                Math.abs(z % 60) < 12
            ) {
                continue;
            }


            if (
                Math.random() <
                0.78
            ) {

                createBuilding(
                    x + random(-6,6),
                    z + random(-6,6)
                );
            }
        }
    }


    // ARBRES

    for (
        let i = 0;
        i < 120;
        i++
    ) {

        const x =
            random(-320,320);

        const z =
            random(-320,320);


        if (
            Math.abs(x) < 15 ||
            Math.abs(z) < 15
        ) {
            continue;
        }


        createTree(
            x,
            z
        );
    }


    // VOITURE

    createPlayer();


    playerX = 0;
    playerZ = 0;


    player.position.set(
        0,
        0,
        0
    );


    updateCamera();
}


// =====================================================
// ROUTE
// =====================================================

function createRoad(
    x,
    z,
    length,
    width,
    horizontal
) {

    const geometry =
        new THREE.BoxGeometry(
            horizontal
                ? length
                : width,
            0.12,
            horizontal
                ? width
                : length
        );


    const material =
        new THREE.MeshStandardMaterial({
            color: 0x303030,
            roughness: 1
        });


    const road =
        new THREE.Mesh(
            geometry,
            material
        );


    road.position.set(
        x,
        0.02,
        z
    );


    road.receiveShadow =
        true;


    scene.add(
        road
    );


    // LIGNES BLANCHES

    const lineGeometry =
        new THREE.BoxGeometry(
            horizontal
                ? length
                : 0.35,
            0.04,
            horizontal
                ? 0.35
                : length
        );


    const line =
        new THREE.Mesh(
            lineGeometry,
            new THREE.MeshBasicMaterial({
                color: 0xffffff
            })
        );


    line.position.set(
        x,
        0.1,
        z
    );


    scene.add(
        line
    );
}


// =====================================================
// BÂTIMENT
// =====================================================

function createBuilding(
    x,
    z
) {

    const width =
        random(10,22);

    const depth =
        random(10,22);

    const height =
        random(7,35);


    const colors = [
        0xd9d9d9,
        0xc7d0d8,
        0xe2c5a5,
        0xbcc5ce,
        0xf0d6bd
    ];


    const building =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                width,
                height,
                depth
            ),
            new THREE.MeshStandardMaterial({
                color:
                    colors[
                        Math.floor(
                            Math.random() *
                            colors.length
                        )
                    ],
                roughness: 0.8
            })
        );


    building.position.set(
        x,
        height / 2,
        z
    );


    building.castShadow =
        true;


    building.receiveShadow =
        true;


    scene.add(
        building
    );


    // toit

    const roof =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                width + .4,
                .5,
                depth + .4
            ),
            new THREE.MeshStandardMaterial({
                color: 0x444444
            })
        );


    roof.position.set(
        x,
        height + .25,
        z
    );


    roof.castShadow =
        true;


    scene.add(
        roof
    );
}


// =====================================================
// ARBRE
// =====================================================

function createTree(
    x,
    z
) {

    const trunk =
        new THREE.Mesh(
            new THREE.CylinderGeometry(
                .45,
                .65,
                3,
                8
            ),
            new THREE.MeshStandardMaterial({
                color: 0x70451f
            })
        );


    trunk.position.set(
        x,
        1.5,
        z
    );


    scene.add(
        trunk
    );


    const leaves =
        new THREE.Mesh(
            new THREE.SphereGeometry(
                2.5,
                10,
                10
            ),
            new THREE.MeshStandardMaterial({
                color: 0x238b23
            })
        );


    leaves.position.set(
        x,
        4,
        z
    );


    scene.add(
        leaves
    );
}


// =====================================================
// VOITURE
// =====================================================

function createPlayer() {

    player =
        new THREE.Group();


    playerBody =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                3,
                1,
                5
            ),
            new THREE.MeshStandardMaterial({
                color: 0x1264ff,
                roughness: .6
            })
        );


    playerBody.position.y =
        1;


    playerBody.castShadow =
        true;


    player.add(
        playerBody
    );


    const roof =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                2.2,
                .8,
                2.3
            ),
            new THREE.MeshStandardMaterial({
                color: 0x20252b
            })
        );


    roof.position.set(
        0,
        1.8,
        -.2
    );


    roof.castShadow =
        true;


    player.add(
        roof
    );


    const wheelGeometry =
        new THREE.CylinderGeometry(
            .55,
            .55,
            .4,
            16
        );


    const wheelMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x111111
        });


    const positions = [
        [-1.55,.55,-1.6],
        [1.55,.55,-1.6],
        [-1.55,.55,1.6],
        [1.55,.55,1.6]
    ];


    positions.forEach(
        p => {

            const wheel =
                new THREE.Mesh(
                    wheelGeometry,
                    wheelMaterial
                );


            wheel.rotation.z =
                Math.PI / 2;


            wheel.position.set(
                p[0],
                p[1],
                p[2]
            );


            player.add(
                wheel
            );
        }
    );


    scene.add(
        player
    );
}


// =====================================================
// DÉPLACEMENT
// =====================================================

function updatePlayer() {

    if (!player)
        return;


    let dx = 0;
    let dz = 0;


    if (keys.forward)
        dz -= 1;


    if (keys.back)
        dz += 1;


    if (keys.left)
        dx -= 1;


    if (keys.right)
        dx += 1;


    if (
        dx === 0 &&
        dz === 0
    )
        return;


    const length =
        Math.sqrt(
            dx * dx +
            dz * dz
        );


    dx /= length;
    dz /= length;


    playerX +=
        dx * speed;


    playerZ +=
        dz * speed;


    player.position.x =
        playerX;


    player.position.z =
        playerZ;


    player.rotation.y =
        Math.atan2(
            dx,
            dz
        );


    sendPosition();

    updateCamera();
}


// =====================================================
// CAMÉRA
// =====================================================

function updateCamera() {

    if (
        !camera ||
        !player
    )
        return;


    const distance = 14;
    const height = 8;


    const x =
        player.position.x +
        Math.sin(cameraAngle) *
        distance;


    const z =
        player.position.z +
        Math.cos(cameraAngle) *
        distance;


    camera.position.set(
        x,
        height,
        z
    );


    camera.lookAt(
        player.position.x,
        1,
        player.position.z
    );
}


// =====================================================
// CAMÉRA BOUTONS
// =====================================================

document
    .getElementById("camLeft")
    .addEventListener(
        "click",
        () => {

            cameraAngle -=
                0.3;

            updateCamera();
        }
    );


document
    .getElementById("camRight")
    .addEventListener(
        "click",
        () => {

            cameraAngle +=
                0.3;

            updateCamera();
        }
    );


// =====================================================
// CONTRÔLES TACTILES
// =====================================================

document
    .querySelectorAll(
        "[data-control]"
    )
    .forEach(button => {

        const control =
            button.dataset.control;


        button.addEventListener(
            "touchstart",
            e => {

                e.preventDefault();

                keys[control] =
                    true;
            },
            {passive:false}
        );


        button.addEventListener(
            "touchend",
            e => {

                e.preventDefault();

                keys[control] =
                    false;
            },
            {passive:false}
        );


        button.addEventListener(
            "mousedown",
            () => {

                keys[control] =
                    true;
            }
        );


        button.addEventListener(
            "mouseup",
            () => {

                keys[control] =
                    false;
            }
        );
    });


// =====================================================
// CLAVIER
// =====================================================

document.addEventListener(
    "keydown",
    e => {

        if (
            e.key === "ArrowUp" ||
            e.key === "w"
        )
            keys.forward = true;


        if (
            e.key === "ArrowDown" ||
            e.key === "s"
        )
            keys.back = true;


        if (
            e.key === "ArrowLeft" ||
            e.key === "a"
        )
            keys.left = true;


        if (
            e.key === "ArrowRight" ||
            e.key === "d"
        )
            keys.right = true;
    }
);


document.addEventListener(
    "keyup",
    e => {

        if (
            e.key === "ArrowUp" ||
            e.key === "w"
        )
            keys.forward = false;


        if (
            e.key === "ArrowDown" ||
            e.key === "s"
        )
            keys.back = false;


        if (
            e.key === "ArrowLeft" ||
            e.key === "a"
        )
            keys.left = false;


        if (
            e.key === "ArrowRight" ||
            e.key === "d"
        )
            keys.right = false;
    }
);


// =====================================================
// VÉHICULES
// =====================================================

document
    .querySelectorAll(
        "[data-vehicle]"
    )
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                currentVehicle =
                    button.dataset.vehicle;


                if (
                    currentVehicle === "car"
                ) {

                    speed = .45;

                    playerBody
                        .material
                        .color
                        .set(0x1264ff);
                }


                if (
                    currentVehicle === "truck"
                ) {

                    speed = .3;

                    playerBody
                        .material
                        .color
                        .set(0xff7b00);
                }


                if (
                    currentVehicle === "bus"
                ) {

                    speed = .35;

                    playerBody
                        .material
                        .color
                        .set(0xffcc00);
                }


                sendVehicle(
                    currentVehicle
                );
            }
        );
    });


// =====================================================
// MULTIJOUEUR - CONNEXION
// =====================================================

function connect() {

    if (
        socket &&
        socket.readyState ===
        WebSocket.OPEN
    ) {
        return;
    }


    socket =
        new WebSocket(
            SERVER_URL
        );


    socket.onopen =
        () => {

            connected = true;

            setMPStatus(
                "🟢 Connecté au serveur"
            );
        };


    socket.onmessage =
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


            handleServerMessage(
                data
            );
        };


    socket.onerror =
        () => {

            setMPStatus(
                "❌ Erreur serveur"
            );
        };


    socket.onclose =
        () => {

            connected = false;

            setMPStatus(
                "🔴 Déconnecté"
            );
        };
}


// =====================================================
// MULTI - SEND
// =====================================================

function send(data) {

    if (
        !socket ||
        socket.readyState !==
        WebSocket.OPEN
    )
        return;


    socket.send(
        JSON.stringify(data)
    );
}


// =====================================================
// CRÉER PARTIE
// =====================================================

document
    .getElementById("mpCreate")
    .addEventListener(
        "click",
        () => {

            playerName =
                prompt(
                    "Ton pseudo :",
                    "Joueur"
                ) || "Joueur";


            connect();


            waitConnection(
                () => {

                    send({
                        type:
                            "create_room",

                        name:
                            playerName,

                        vehicle:
                            currentVehicle,

                        latitude:
                            playerX,

                        longitude:
                            playerZ,

                        rotation:
                            player
                                ? player.rotation.y
                                : 0
                    });
                }
            );
        }
    );


// =====================================================
// REJOINDRE
// =====================================================

document
    .getElementById("mpJoin")
    .addEventListener(
        "click",
        () => {

            const code =
                prompt(
                    "Code de la partie :"
                );


            if (!code)
                return;


            playerName =
                prompt(
                    "Ton pseudo :",
                    "Joueur"
                ) || "Joueur";


            connect();


            waitConnection(
                () => {

                    send({
                        type:
                            "join_room",

                        room:
                            code
                                .trim()
                                .toUpperCase(),

                        name:
                            playerName,

                        vehicle:
                            currentVehicle,

                        latitude:
                            playerX,

                        longitude:
                            playerZ,

                        rotation:
                            player
                                ? player.rotation.y
                                : 0
                    });
                }
            );
        }
    );


// =====================================================
// ATTENDRE CONNEXION
// =====================================================

function waitConnection(
    callback
) {

    let attempts = 0;


    const timer =
        setInterval(
            () => {

                attempts++;


                if (
                    socket &&
                    socket.readyState ===
                    WebSocket.OPEN
                ) {

                    clearInterval(
                        timer
                    );

                    callback();

                    return;
                }


                if (
                    attempts > 50
                ) {

                    clearInterval(
                        timer
                    );

                    alert(
                        "❌ Le serveur ne répond pas."
                    );
                }

            },
            100
        );
}


// =====================================================
// MESSAGES SERVEUR
// =====================================================

function handleServerMessage(
    data
) {

    console.log(
        "Serveur :",
        data
    );


    if (
        data.type ===
        "room_created"
    ) {

        roomCode =
            data.room;

        playerId =
            data.playerId;


        showRoom();


        loadPlayers(
            data.players
        );

        return;
    }


    if (
        data.type ===
        "room_joined"
    ) {

        roomCode =
            data.room;

        playerId =
            data.playerId;


        showRoom();


        loadPlayers(
            data.players
        );

        return;
    }


    if (
        data.type ===
        "player_joined"
    ) {

        addOtherPlayer(
            data.player
        );

        return;
    }


    if (
        data.type ===
        "player_update"
    ) {

        updateOtherPlayer(
            data.player
        );

        return;
    }


    if (
        data.type ===
        "vehicle_update"
    ) {

        const p =
            otherPlayers.get(
                data.playerId
            );


        if (p) {

            p.vehicle =
                data.vehicle;

            renderOtherPlayer(
                p
            );
        }

        return;
    }


    if (
        data.type ===
        "player_left"
    ) {

        removeOtherPlayer(
            data.playerId
        );

        return;
    }


    if (
        data.type ===
        "error"
    ) {

        alert(
            "❌ " +
            data.message
        );
    }
}


// =====================================================
// ROOM
// =====================================================

function showRoom() {

    multiplayerUI.style.display =
        "block";


    document.getElementById(
        "mpRoom"
    ).style.display =
        "block";


    document.getElementById(
        "mpRoomCode"
    ).textContent =
        roomCode;


    setMPStatus(
        "🟢 Partie " +
        roomCode
    );
}


// =====================================================
// PLAYERS
// =====================================================

function loadPlayers(
    players
) {

    if (
        !Array.isArray(players)
    )
        return;


    players.forEach(
        p => {

            if (
                p.id !==
                playerId
            ) {

                addOtherPlayer(p);
            }
        }
    );


    updatePlayerCount();
}


// =====================================================
// AJOUT AUTRE JOUEUR
// =====================================================

function addOtherPlayer(
    data
) {

    if (
        !data ||
        data.id === playerId
    )
        return;


    otherPlayers.set(
        data.id,
        {
            id:
                data.id,

            name:
                data.name || "Joueur",

            vehicle:
                data.vehicle || "car",

            latitude:
                Number(
                    data.latitude || 0
                ),

            longitude:
                Number(
                    data.longitude || 0
                ),

            rotation:
                Number(
                    data.rotation || 0
                ),

            object:
                null
        }
    );


    renderOtherPlayer(
        otherPlayers.get(
            data.id
        )
    );


    updatePlayerCount();
}


// =====================================================
// UPDATE AUTRE JOUEUR
// =====================================================

function updateOtherPlayer(
    data
) {

    if (
        !data ||
        data.id === playerId
    )
        return;


    const p =
        otherPlayers.get(
            data.id
        );


    if (!p) {

        addOtherPlayer(
            data
        );

        return;
    }


    p.latitude =
        Number(
            data.latitude || 0
        );


    p.longitude =
        Number(
            data.longitude || 0
        );


    p.rotation =
        Number(
            data.rotation || 0
        );


    renderOtherPlayer(p);
}


// =====================================================
// RENDU AUTRE JOUEUR
// =====================================================

function renderOtherPlayer(
    p
) {

    if (!scene)
        return;


    if (!p.object) {

        const object =
            new THREE.Group();


        const body =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    2.7,
                    1,
                    4.5
                ),
                new THREE.MeshStandardMaterial({
                    color: 0xff3333
                })
            );


        body.position.y =
            1;


        object.add(body);


        const roof =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    2,
                    .7,
                    2
                ),
                new THREE.MeshStandardMaterial({
                    color: 0x222222
                })
            );


        roof.position.y =
            1.7;


        object.add(roof);


        object.castShadow =
            true;


        scene.add(
            object
        );


        p.object =
            object;
    }


    p.object.position.set(
        p.latitude,
        0,
        p.longitude
    );


    p.object.rotation.y =
        p.rotation;
}


// =====================================================
// SUPPRIMER JOUEUR
// =====================================================

function removeOtherPlayer(
    id
) {

    const p =
        otherPlayers.get(id);


    if (
        p &&
        p.object
    ) {

        scene.remove(
            p.object
        );
    }


    otherPlayers.delete(
        id
    );


    updatePlayerCount();
}


// =====================================================
// ENVOYER POSITION
// =====================================================

let lastSend =
    0;


function sendPosition() {

    if (
        !connected ||
        !roomCode
    )
        return;


    const now =
        Date.now();


    if (
        now - lastSend <
        100
    )
        return;


    lastSend =
        now;


    send({
        type:
            "player_update",

        latitude:
            playerX,

        longitude:
            playerZ,

        rotation:
            player
                ? player.rotation.y
                : 0
    });
}


// =====================================================
// ENVOYER VÉHICULE
// =====================================================

function sendVehicle(
    vehicle
) {

    if (!connected)
        return;


    send({
        type:
            "vehicle_update",

        vehicle:
            vehicle
    });
}


// =====================================================
// UI MULTI
// =====================================================

document
    .getElementById("openMultiplayer")
    .addEventListener(
        "click",
        () => {

            multiplayerUI.style.display =
                "block";
        }
    );


document
    .getElementById("openMP")
    .addEventListener(
        "click",
        () => {

            multiplayerUI.style.display =
                "block";
        }
    );


document
    .getElementById("mpClose")
    .addEventListener(
        "click",
        () => {

            multiplayerUI.style.display =
                "none";
        }
    );


function setMPStatus(
    text
) {

    document.getElementById(
        "mpStatus"
    ).textContent =
        text;
}


function updatePlayerCount() {

    document.getElementById(
        "mpPlayers"
    ).textContent =
        "👥 Joueurs : " +
        (
            otherPlayers.size +
            1
        );
}


// =====================================================
// BOUCLE DE JEU
// =====================================================

function animate() {

    if (!gameStarted)
        return;


    requestAnimationFrame(
        animate
    );


    updatePlayer();


    // garder les autres joueurs
    // à leur position

    otherPlayers.forEach(
        p => {

            if (p.object) {

                p.object.position.set(
                    p.latitude,
                    0,
                    p.longitude
                );
            }
        }
    );


    renderer.render(
        scene,
        camera
    );
}


// =====================================================
// RESIZE
// =====================================================

function resize() {

    if (
        !camera ||
        !renderer
    )
        return;


    camera.aspect =
        window.innerWidth /
        window.innerHeight;


    camera.updateProjectionMatrix();


    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );
}


// =====================================================
// OUTILS
// =====================================================

function random(
    min,
    max
) {

    return Math.random() *
        (max - min) +
        min;
}


function sleep(
    ms
) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );
}
