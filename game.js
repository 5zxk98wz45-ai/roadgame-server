// =====================================================
// ROADGAME - GAME.JS COMPLET
// Monde 3D + véhicules + graphismes + contrôles
// =====================================================

const SERVER_URL = "wss://roadgame-server.onrender.com";

let scene;
let camera;
let renderer;
let clock;

let gameStarted = false;

let player;
let playerVehicle = "car";

let roadObjects = [];
let buildings = [];
let trees = [];

let graphicsQuality =
    localStorage.getItem("roadgame-quality") || "medium";

let keys = {};

let speed = 0;
let playerRotation = 0;


// =====================================================
// INITIALISATION THREE.JS
// =====================================================

function initThree() {

    const game = document.getElementById("game");

    if (!game) {
        console.error("❌ #game introuvable");
        return;
    }

    scene = new THREE.Scene();

    scene.background =
        new THREE.Color(0x87ceeb);


    // -------------------------------------------------
    // CAMERA
    // -------------------------------------------------

    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        2000
    );

    camera.position.set(
        0,
        8,
        12
    );


    // -------------------------------------------------
    // RENDERER
    // -------------------------------------------------

    renderer = new THREE.WebGLRenderer({
        antialias: graphicsQuality !== "low"
    });

    renderer.setPixelRatio(
        getPixelRatio()
    );

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.shadowMap.enabled =
        graphicsQuality === "high" ||
        graphicsQuality === "ultra";

    game.innerHTML = "";

    game.appendChild(
        renderer.domElement
    );


    // -------------------------------------------------
    // CLOCK
    // -------------------------------------------------

    clock = new THREE.Clock();


    // -------------------------------------------------
    // LUMIÈRES
    // -------------------------------------------------

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
            3
        );

    sun.position.set(
        100,
        150,
        50
    );

    sun.castShadow =
        renderer.shadowMap.enabled;

    scene.add(sun);


    // -------------------------------------------------
    // MONDE
    // -------------------------------------------------

    createGround();

    createRoadNetwork();

    createBuildings();

    createTrees();

    createStreetLights();


    // -------------------------------------------------
    // JOUEUR
    // -------------------------------------------------

    player =
        createVehicle(
            "car"
        );

    player.position.set(
        0,
        0.6,
        0
    );

    scene.add(player);


    // -------------------------------------------------
    // CONTROLES
    // -------------------------------------------------

    setupKeyboard();

    setupMobileControls();


    // -------------------------------------------------
    // RESIZE
    // -------------------------------------------------

    window.addEventListener(
        "resize",
        resizeGame
    );


    animate();

    console.log(
        "🌍 RoadGame 3D chargé !"
    );
}


// =====================================================
// PIXEL RATIO
// =====================================================

function getPixelRatio() {

    if (graphicsQuality === "low") {
        return 0.7;
    }

    if (graphicsQuality === "medium") {
        return Math.min(
            window.devicePixelRatio,
            1.5
        );
    }

    if (graphicsQuality === "high") {
        return Math.min(
            window.devicePixelRatio,
            2
        );
    }

    return Math.min(
        window.devicePixelRatio,
        3
    );
}


// =====================================================
// TERRAIN
// =====================================================

function createGround() {

    const size =
        graphicsQuality === "low"
            ? 500
            : 1000;

    const geometry =
        new THREE.PlaneGeometry(
            size,
            size
        );

    const material =
        new THREE.MeshStandardMaterial({
            color: 0x4d8f45
        });

    const ground =
        new THREE.Mesh(
            geometry,
            material
        );

    ground.rotation.x =
        -Math.PI / 2;

    ground.receiveShadow = true;

    scene.add(ground);
}


// =====================================================
// ROUTES
// =====================================================

function createRoadNetwork() {

    const roadMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x303030
        });

    const lineMaterial =
        new THREE.MeshBasicMaterial({
            color: 0xffffff
        });


    // Route horizontale

    createRoad(
        0,
        0,
        600,
        22,
        roadMaterial
    );


    // Route verticale

    createRoad(
        0,
        0,
        22,
        600,
        roadMaterial
    );


    // Routes secondaires

    createRoad(
        0,
        -100,
        450,
        14,
        roadMaterial
    );

    createRoad(
        0,
        100,
        450,
        14,
        roadMaterial
    );

    createRoad(
        -100,
        0,
        14,
        450,
        roadMaterial
    );

    createRoad(
        100,
        0,
        14,
        450,
        roadMaterial
    );


    // Lignes centrales

    for (
        let x = -280;
        x <= 280;
        x += 20
    ) {

        createRoadLine(
            x,
            0,
            8,
            0.35,
            lineMaterial
        );
    }


    for (
        let z = -280;
        z <= 280;
        z += 20
    ) {

        createRoadLine(
            0,
            z,
            0.35,
            8,
            lineMaterial
        );
    }
}


function createRoad(
    x,
    z,
    width,
    depth,
    material
) {

    const geometry =
        new THREE.BoxGeometry(
            width,
            0.08,
            depth
        );

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

    roadObjects.push(
        road
    );
}


function createRoadLine(
    x,
    z,
    width,
    depth,
    material
) {

    const geometry =
        new THREE.BoxGeometry(
            width,
            0.02,
            depth
        );

    const line =
        new THREE.Mesh(
            geometry,
            material
        );

    line.position.set(
        x,
        0.09,
        z
    );

    scene.add(line);
}


// =====================================================
// BÂTIMENTS
// =====================================================

function createBuildings() {

    const amount =
        graphicsQuality === "low"
            ? 25
            : graphicsQuality === "medium"
                ? 45
                : graphicsQuality === "high"
                    ? 70
                    : 100;


    for (
        let i = 0;
        i < amount;
        i++
    ) {

        let x;
        let z;

        do {

            x =
                Math.random() * 500 -
                250;

            z =
                Math.random() * 500 -
                250;

        }
        while (
            Math.abs(x) < 35 ||
            Math.abs(z) < 35
        );


        createBuilding(
            x,
            z
        );
    }
}


function createBuilding(
    x,
    z
) {

    const width =
        8 +
        Math.random() * 12;

    const depth =
        8 +
        Math.random() * 12;

    const height =
        8 +
        Math.random() * 35;


    const geometry =
        new THREE.BoxGeometry(
            width,
            height,
            depth
        );


    const colors = [
        0xb7b7b7,
        0xd1c4a8,
        0x8fa8b8,
        0xc8c8c8,
        0x9d9d9d
    ];


    const material =
        new THREE.MeshStandardMaterial({
            color:
                colors[
                    Math.floor(
                        Math.random() *
                        colors.length
                    )
                ]
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


    building.castShadow =
        renderer.shadowMap.enabled;

    building.receiveShadow = true;


    scene.add(
        building
    );

    buildings.push(
        building
    );
}


// =====================================================
// ARBRES
// =====================================================

function createTrees() {

    const amount =
        graphicsQuality === "low"
            ? 20
            : graphicsQuality === "medium"
                ? 40
                : graphicsQuality === "high"
                    ? 65
                    : 90;


    for (
        let i = 0;
        i < amount;
        i++
    ) {

        let x;
        let z;

        do {

            x =
                Math.random() * 500 -
                250;

            z =
                Math.random() * 500 -
                250;

        }
        while (
            Math.abs(x) < 30 ||
            Math.abs(z) < 30
        );


        createTree(
            x,
            z
        );
    }
}


function createTree(
    x,
    z
) {

    const group =
        new THREE.Group();


    // Tronc

    const trunk =
        new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.35,
                0.45,
                3,
                8
            ),
            new THREE.MeshStandardMaterial({
                color: 0x754c24
            })
        );

    trunk.position.y =
        1.5;


    // Feuillage

    const leaves =
        new THREE.Mesh(
            new THREE.SphereGeometry(
                2.2,
                graphicsQuality === "low"
                    ? 6
                    : 10,
                graphicsQuality === "low"
                    ? 6
                    : 10
            ),
            new THREE.MeshStandardMaterial({
                color: 0x247a35
            })
        );

    leaves.position.y =
        4;


    group.add(
        trunk
    );

    group.add(
        leaves
    );


    group.position.set(
        x,
        0,
        z
    );


    group.scale.setScalar(
        0.8 +
        Math.random() * 0.7
    );


    scene.add(
        group
    );

    trees.push(
        group
    );
}


// =====================================================
// LAMPADAIRES
// =====================================================

function createStreetLights() {

    for (
        let x = -240;
        x <= 240;
        x += 40
    ) {

        createLamp(
            x,
            13
        );

        createLamp(
            x,
            -13
        );
    }
}


function createLamp(
    x,
    z
) {

    const group =
        new THREE.Group();


    const pole =
        new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.12,
                0.12,
                5,
                8
            ),
            new THREE.MeshStandardMaterial({
                color: 0x333333
            })
        );

    pole.position.y =
        2.5;


    const light =
        new THREE.Mesh(
            new THREE.SphereGeometry(
                0.35,
                8,
                8
            ),
            new THREE.MeshBasicMaterial({
                color: 0xffffcc
            })
        );

    light.position.y =
        5;


    group.add(
        pole
    );

    group.add(
        light
    );


    group.position.set(
        x,
        0,
        z
    );


    scene.add(
        group
    );
}


// =====================================================
// VÉHICULE
// =====================================================

function createVehicle(
    type
) {

    const group =
        new THREE.Group();


    if (type === "walk") {

        const body =
            new THREE.Mesh(
                new THREE.CapsuleGeometry(
                    0.35,
                    1,
                    4,
                    8
                ),
                new THREE.MeshStandardMaterial({
                    color: 0x2878ff
                })
            );

        body.position.y =
            1;

        group.add(
            body
        );

        return group;
    }


    let bodyColor =
        0x2878ff;


    if (type === "truck") {
        bodyColor = 0xd33b32;
    }

    if (type === "bus") {
        bodyColor = 0xffc928;
    }

    if (type === "plane") {
        bodyColor = 0xffffff;
    }

    if (type === "boat") {
        bodyColor = 0x1e65d6;
    }


    // Corps

    const body =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                2.2,
                0.65,
                4
            ),
            new THREE.MeshStandardMaterial({
                color: bodyColor
            })
        );

    body.position.y =
        0.75;

    body.castShadow = true;

    group.add(
        body
    );


    // Habitacle

    if (
        type === "car" ||
        type === "truck" ||
        type === "bus"
    ) {

        const cabin =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    1.7,
                    0.65,
                    1.7
                ),
                new THREE.MeshStandardMaterial({
                    color: 0x222b35
                })
            );

        cabin.position.set(
            0,
            1.25,
            -0.2
        );

        cabin.castShadow = true;

        group.add(
            cabin
        );
    }


    // Roues

    if (
        type === "car" ||
        type === "truck" ||
        type === "bus"
    ) {

        const wheelGeometry =
            new THREE.CylinderGeometry(
                0.38,
                0.38,
                0.25,
                12
            );

        const wheelMaterial =
            new THREE.MeshStandardMaterial({
                color: 0x151515
            });


        const wheelPositions = [
            [-1.05, 0.4, -1.3],
            [1.05, 0.4, -1.3],
            [-1.05, 0.4, 1.3],
            [1.05, 0.4, 1.3]
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

                group.add(
                    wheel
                );

            }
        );
    }


    // Avion

    if (type === "plane") {

        const wing =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    7,
                    0.15,
                    0.7
                ),
                new THREE.MeshStandardMaterial({
                    color: 0xffffff
                })
            );

        wing.position.y =
            0.9;

        group.add(
            wing
        );
    }


    // Bateau

    if (type === "boat") {

        const top =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    1.5,
                    0.4,
                    2
                ),
                new THREE.MeshStandardMaterial({
                    color: 0xffffff
                })
            );

        top.position.y =
            1.2;

        group.add(
            top
        );
    }


    return group;
}


// =====================================================
// CHANGER DE VÉHICULE
// =====================================================

window.changeVehicle =
function(type) {

    if (!player) {
        return;
    }


    playerVehicle =
        type;


    const oldPosition =
        player.position.clone();


    const oldRotation =
        player.rotation.y;


    scene.remove(
        player
    );


    player =
        createVehicle(
            type
        );


    player.position.copy(
        oldPosition
    );

    player.rotation.y =
        oldRotation;


    scene.add(
        player
    );


    console.log(
        "🚗 Véhicule :",
        type
    );
};


// =====================================================
// DÉMARRER LE JEU
// =====================================================

window.startGame =
function(location) {

    if (!renderer) {

        initThree();
    }


    gameStarted = true;


    console.log(
        "📍 Destination :",
        location
    );


    // On place le joueur au centre

    if (player) {

        player.position.set(
            0,
            0.6,
            0
        );
    }


    animate();
};


// =====================================================
// GRAPHISMES
// =====================================================

window.setGraphicsQuality =
function(quality) {

    graphicsQuality =
        quality;


    localStorage.setItem(
        "roadgame-quality",
        quality
    );


    if (!renderer) {
        return;
    }


    renderer.setPixelRatio(
        getPixelRatio()
    );


    renderer.shadowMap.enabled =
        quality === "high" ||
        quality === "ultra";


    console.log(
        "🎮 Graphismes :",
        quality
    );
};


// =====================================================
// CLAVIER
// =====================================================

function setupKeyboard() {

    window.addEventListener(
        "keydown",
        function(event) {

            keys[
                event.key.toLowerCase()
            ] = true;

        }
    );


    window.addEventListener(
        "keyup",
        function(event) {

            keys[
                event.key.toLowerCase()
            ] = false;

        }
    );
}


// =====================================================
// CONTRÔLES TACTILES
// =====================================================

function setupMobileControls() {

    const buttons =
        document.querySelectorAll(
            "#mobileControls button"
        );


    buttons.forEach(
        button => {

            const direction =
                button.dataset.direction;


            button.addEventListener(
                "touchstart",
                function(event) {

                    event.preventDefault();

                    movePlayer(
                        direction
                    );

                },
                {
                    passive: false
                }
            );


            button.addEventListener(
                "click",
                function() {

                    movePlayer(
                        direction
                    );

                }
            );

        }
    );
}


// =====================================================
// DÉPLACEMENT
// =====================================================

function movePlayer(
    direction
) {

    if (!player) {
        return;
    }


    let movement =
        1.5;


    if (playerVehicle === "car") {
        movement = 2.2;
    }

    if (playerVehicle === "truck") {
        movement = 1.7;
    }

    if (playerVehicle === "bus") {
        movement = 1.8;
    }

    if (playerVehicle === "plane") {
        movement = 4;
    }

    if (playerVehicle === "boat") {
        movement = 1.5;
    }


    if (direction === "up") {

        player.position.z -=
            movement;

        playerRotation =
            0;
    }


    if (direction === "down") {

        player.position.z +=
            movement;

        playerRotation =
            Math.PI;
    }


    if (direction === "left") {

        player.position.x -=
            movement;

        playerRotation =
            -Math.PI / 2;
    }


    if (direction === "right") {

        player.position.x +=
            movement;

        playerRotation =
            Math.PI / 2;
    }


    player.rotation.y =
        playerRotation;
}


// =====================================================
// ANIMATION
// =====================================================

function animate() {

    if (!renderer) {
        return;
    }


    requestAnimationFrame(
        animate
    );


    const delta =
        clock.getDelta();


    updateKeyboardMovement(
        delta
    );


    updateCamera(
        delta
    );


    renderer.render(
        scene,
        camera
    );
}


// =====================================================
// MOUVEMENT CLAVIER
// =====================================================

function updateKeyboardMovement(
    delta
) {

    if (!player) {
        return;
    }


    let movement =
        12 * delta;


    if (playerVehicle === "car") {
        movement = 18 * delta;
    }


    if (keys["w"] || keys["arrowup"]) {

        player.position.z -=
            movement;

        player.rotation.y =
            0;
    }


    if (keys["s"] || keys["arrowdown"]) {

        player.position.z +=
            movement;

        player.rotation.y =
            Math.PI;
    }


    if (keys["a"] || keys["arrowleft"]) {

        player.position.x -=
            movement;

        player.rotation.y =
            -Math.PI / 2;
    }


    if (keys["d"] || keys["arrowright"]) {

        player.position.x +=
            movement;

        player.rotation.y =
            Math.PI / 2;
    }
}


// =====================================================
// CAMERA
// =====================================================

function updateCamera() {

    if (!player) {
        return;
    }


    const distance =
        playerVehicle === "plane"
            ? 18
            : 11;


    const target =
        new THREE.Vector3(
            player.position.x,
            player.position.y + 1,
            player.position.z
        );


    const cameraPosition =
        new THREE.Vector3(
            player.position.x,
            player.position.y + 7,
            player.position.z + distance
        );


    camera.position.lerp(
        cameraPosition,
        0.08
    );


    camera.lookAt(
        target
    );
}


// =====================================================
// RESIZE
// =====================================================

function resizeGame() {

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


// =====================================================
// INITIALISATION AUTOMATIQUE
// =====================================================

window.addEventListener(
    "DOMContentLoaded",
    function() {

        console.log(
            "🚗 RoadGame démarrage..."
        );

        initThree();

    }
);
