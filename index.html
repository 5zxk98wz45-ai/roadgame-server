// =====================================================
// ROADGAME 3D
// Générateur de ville
// =====================================================

let scene;
let camera;
let renderer;

let player;
let carBody;

let roads = [];
let buildings = [];

let running = false;

let playerX = 0;
let playerZ = 0;

let cameraAngle = 0;

let speed = 0;
let vehicleSpeed = 0.45;

let keys = {
    forward: false,
    back: false,
    left: false,
    right: false
};

const locationInput = document.getElementById("location");
const playButton = document.getElementById("play");
const menu = document.getElementById("menu");
const message = document.getElementById("message");
const loading = document.getElementById("loading");


// =====================================================
// DÉMARRAGE
// =====================================================

playButton.addEventListener("click", async function () {

    const location = locationInput.value.trim();

    if (!location) {
        message.textContent =
            "❌ Entre une ville ou une adresse.";
        return;
    }

    loading.style.display = "flex";

    try {

        await generateMap(location);

        menu.style.display = "none";

        document.getElementById("hud").style.display = "block";
        document.getElementById("controls").style.display = "block";
        document.getElementById("vehicle").style.display = "block";
        document.getElementById("cameraButtons").style.display = "block";

        running = true;

        message.textContent = "";

        animate();

    } catch (error) {

        console.error(error);

        // Même si la recherche échoue,
        // on génère quand même une ville.
        generateProceduralCity(location);

        menu.style.display = "none";

        document.getElementById("hud").style.display = "block";
        document.getElementById("controls").style.display = "block";
        document.getElementById("vehicle").style.display = "block";
        document.getElementById("cameraButtons").style.display = "block";

        running = true;

        animate();
    }

    loading.style.display = "none";
});


// =====================================================
// INITIALISATION THREE.JS
// =====================================================

function initThree() {

    if (typeof THREE === "undefined") {

        alert(
            "❌ Three.js ne s'est pas chargé.\n\n" +
            "Vérifie ta connexion Internet."
        );

        throw new Error("Three.js absent");
    }

    scene = new THREE.Scene();

    scene.background =
        new THREE.Color(0x87ceeb);

    scene.fog =
        new THREE.Fog(
            0x87ceeb,
            80,
            400
        );


    camera =
        new THREE.PerspectiveCamera(
            65,
            window.innerWidth / window.innerHeight,
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

    renderer.shadowMap.enabled = true;

    document
        .getElementById("game")
        .appendChild(renderer.domElement);


    // Lumière
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

    scene.add(sun);


    window.addEventListener(
        "resize",
        resize
    );
}


// =====================================================
// GÉNÉRATION MAP
// =====================================================

async function generateMap(location) {

    initThree();

    // Petite pause pour afficher le chargement
    await sleep(150);

    /*
       On essaie de trouver l'adresse.
       Si le service ne répond pas,
       la map procédurale est quand même créée.
    */

    let found = false;

    try {

        const url =
            "https://nominatim.openstreetmap.org/search" +
            "?format=json&limit=1&q=" +
            encodeURIComponent(location);

        const response =
            await fetch(url);

        if (response.ok) {

            const data =
                await response.json();

            if (data.length > 0) {
                found = true;
            }
        }

    } catch (error) {

        console.log(
            "Recherche adresse indisponible."
        );

    }


    generateProceduralCity(
        found ? location : "Ville générée"
    );
}


// =====================================================
// VILLE 3D
// =====================================================

function generateProceduralCity(locationName) {

    clearWorld();


    // Sol
    const groundGeometry =
        new THREE.PlaneGeometry(
            500,
            500
        );

    const groundMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x4c9a4c
        });

    const ground =
        new THREE.Mesh(
            groundGeometry,
            groundMaterial
        );

    ground.rotation.x =
        -Math.PI / 2;

    ground.receiveShadow = true;

    scene.add(ground);


    // Routes principales
    createRoad(
        0,
        0,
        500,
        18,
        false
    );

    createRoad(
        0,
        0,
        500,
        18,
        true
    );


    // Routes secondaires
    for (
        let i = -200;
        i <= 200;
        i += 50
    ) {

        if (i !== 0) {

            createRoad(
                i,
                0,
                500,
                10,
                false
            );

            createRoad(
                0,
                i,
                500,
                10,
                true
            );
        }
    }


    // Bâtiments
    for (
        let x = -220;
        x <= 220;
        x += 25
    ) {

        for (
            let z = -220;
            z <= 220;
            z += 25
        ) {

            // Laisser les routes libres
            if (
                Math.abs(x) < 10 ||
                Math.abs(z) < 10 ||
                x % 50 === 0 ||
                z % 50 === 0
            ) {
                continue;
            }


            if (
                Math.random() < 0.75
            ) {

                createBuilding(
                    x,
                    z
                );
            }
        }
    }


    // Quelques arbres
    for (
        let i = 0;
        i < 100;
        i++
    ) {

        const x =
            random(-230, 230);

        const z =
            random(-230, 230);

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


    // Joueur
    createPlayer();

    playerX = 0;
    playerZ = 0;

    cameraAngle = 0;

    updateCamera();


    document.getElementById(
        "info"
    ).textContent =
        "📍 " +
        locationName;
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
            horizontal ? length : width,
            0.15,
            horizontal ? width : length
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
        0.08,
        z
    );

    road.receiveShadow = true;

    scene.add(road);

    roads.push(road);


    // Ligne centrale
    const lineGeometry =
        new THREE.BoxGeometry(
            horizontal ? length : 0.35,
            0.03,
            horizontal ? 0.35 : length
        );

    const lineMaterial =
        new THREE.MeshBasicMaterial({
            color: 0xffffff
        });

    const line =
        new THREE.Mesh(
            lineGeometry,
            lineMaterial
        );

    line.position.set(
        x,
        0.18,
        z
    );

    scene.add(line);
}


// =====================================================
// BÂTIMENT
// =====================================================

function createBuilding(
    x,
    z
) {

    const width =
        random(8, 18);

    const depth =
        random(8, 18);

    const height =
        random(5, 30);


    const geometry =
        new THREE.BoxGeometry(
            width,
            height,
            depth
        );


    const colors = [
        0xd8d8d8,
        0xbfc7d1,
        0xe0c9a6,
        0xc7c7c7,
        0xaeb8c4,
        0xd6b89c
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


    building.castShadow = true;
    building.receiveShadow = true;

    scene.add(building);

    buildings.push(building);


    // Toit
    const roofGeometry =
        new THREE.BoxGeometry(
            width + 0.3,
            0.5,
            depth + 0.3
        );

    const roofMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x444444
        });

    const roof =
        new THREE.Mesh(
            roofGeometry,
            roofMaterial
        );

    roof.position.set(
        x,
        height + 0.25,
        z
    );

    scene.add(roof);
}


// =====================================================
// ARBRE
// =====================================================

function createTree(x, z) {

    const trunkGeometry =
        new THREE.CylinderGeometry(
            0.5,
            0.7,
            3,
            8
        );

    const trunkMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x754c24
        });

    const trunk =
        new THREE.Mesh(
            trunkGeometry,
            trunkMaterial
        );

    trunk.position.set(
        x,
        1.5,
        z
    );

    scene.add(trunk);


    const leavesGeometry =
        new THREE.SphereGeometry(
            2.5,
            8,
            8
        );

    const leavesMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x238823
        });

    const leaves =
        new THREE.Mesh(
            leavesGeometry,
            leavesMaterial
        );

    leaves.position.set(
        x,
        4,
        z
    );

    scene.add(leaves);
}


// =====================================================
// VOITURE DU JOUEUR
// =====================================================

function createPlayer() {

    player =
        new THREE.Group();


    carBody =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                3,
                1,
                5
            ),
            new THREE.MeshStandardMaterial({
                color: 0x1565ff
            })
        );


    carBody.position.y = 1;

    carBody.castShadow = true;

    player.add(carBody);


    const roof =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                2.2,
                0.8,
                2.3
            ),
            new THREE.MeshStandardMaterial({
                color: 0x222222
            })
        );


    roof.position.set(
        0,
        1.8,
        -0.2
    );

    roof.castShadow = true;

    player.add(roof);


    const wheelGeometry =
        new THREE.CylinderGeometry(
            0.55,
            0.55,
            0.35,
            16
        );


    const wheelMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x111111
        });


    const wheelPositions = [
        [-1.55, 0.55, -1.6],
        [1.55, 0.55, -1.6],
        [-1.55, 0.55, 1.6],
        [1.55, 0.55, 1.6]
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

            player.add(wheel);
        }
    );


    player.position.set(
        0,
        0,
        0
    );


    scene.add(player);
}


// =====================================================
// CONTRÔLES
// =====================================================

document
    .querySelectorAll("[data-move]")
    .forEach(button => {

        const direction =
            button.dataset.move;


        button.addEventListener(
            "touchstart",
            function(e) {

                e.preventDefault();

                keys[direction] = true;

            },
            { passive: false }
        );


        button.addEventListener(
            "touchend",
            function(e) {

                e.preventDefault();

                keys[direction] = false;

            },
            { passive: false }
        );


        button.addEventListener(
            "mousedown",
            function() {

                keys[direction] = true;

            }
        );


        button.addEventListener(
            "mouseup",
            function() {

                keys[direction] = false;

            }
        );
    });


// =====================================================
// CLAVIER
// =====================================================

document.addEventListener(
    "keydown",
    function(event) {

        if (event.key === "ArrowUp" || event.key === "w") {
            keys.forward = true;
        }

        if (event.key === "ArrowDown" || event.key === "s") {
            keys.back = true;
        }

        if (event.key === "ArrowLeft" || event.key === "a") {
            keys.left = true;
        }

        if (event.key === "ArrowRight" || event.key === "d") {
            keys.right = true;
        }
    }
);


document.addEventListener(
    "keyup",
    function(event) {

        if (event.key === "ArrowUp" || event.key === "w") {
            keys.forward = false;
        }

        if (event.key === "ArrowDown" || event.key === "s") {
            keys.back = false;
        }

        if (event.key === "ArrowLeft" || event.key === "a") {
            keys.left = false;
        }

        if (event.key === "ArrowRight" || event.key === "d") {
            keys.right = false;
        }
    }
);


// =====================================================
// CAMÉRA
// =====================================================

document
    .getElementById("leftCamera")
    .addEventListener(
        "click",
        function() {

            cameraAngle -= 0.25;

            updateCamera();
        }
    );


document
    .getElementById("rightCamera")
    .addEventListener(
        "click",
        function() {

            cameraAngle += 0.25;

            updateCamera();
        }
    );


// =====================================================
// CHANGEMENT DE VÉHICULE
// =====================================================

document
    .querySelectorAll("[data-car]")
    .forEach(button => {

        button.addEventListener(
            "click",
            function() {

                const type =
                    this.dataset.car;


                if (type === "car") {

                    vehicleSpeed = 0.45;

                    carBody.material.color.set(
                        0x1565ff
                    );
                }


                if (type === "truck") {

                    vehicleSpeed = 0.30;

                    carBody.material.color.set(
                        0xff8800
                    );
                }


                if (type === "bus") {

                    vehicleSpeed = 0.35;

                    carBody.material.color.set(
                        0xffcc00
                    );
                }
            }
        );
    });


// =====================================================
// DÉPLACEMENT
// =====================================================

function updatePlayer() {

    if (!player) {
        return;
    }


    let dx = 0;
    let dz = 0;


    if (keys.forward) {
        dz -= 1;
    }

    if (keys.back) {
        dz += 1;
    }

    if (keys.left) {
        dx -= 1;
    }

    if (keys.right) {
        dx += 1;
    }


    if (dx === 0 && dz === 0) {
        return;
    }


    const length =
        Math.sqrt(
            dx * dx +
            dz * dz
        );


    dx /= length;
    dz /= length;


    playerX +=
        dx * vehicleSpeed;

    playerZ +=
        dz * vehicleSpeed;


    player.position.x =
        playerX;

    player.position.z =
        playerZ;


    player.rotation.y =
        Math.atan2(
            dx,
            dz
        );


    updateCamera();
}


// =====================================================
// CAMÉRA SUIVEUSE
// =====================================================

function updateCamera() {

    if (!player || !camera) {
        return;
    }


    const distance = 14;
    const height = 9;


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
        player.position.y + height,
        z
    );


    camera.lookAt(
        player.position.x,
        player.position.y + 1,
        player.position.z
    );
}


// =====================================================
// BOUCLE
// =====================================================

function animate() {

    if (!running) {
        return;
    }


    requestAnimationFrame(
        animate
    );


    updatePlayer();

    renderer.render(
        scene,
        camera
    );
}


// =====================================================
// NETTOYAGE
// =====================================================

function clearWorld() {

    if (!scene) {
        return;
    }


    while (
        scene.children.length > 0
    ) {

        scene.remove(
            scene.children[0]
        );
    }


    roads = [];
    buildings = [];

    player = null;
}


// =====================================================
// RESIZE
// =====================================================

function resize() {

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
// UTILITAIRES
// =====================================================

function random(min, max) {

    return (
        Math.random() *
        (max - min) +
        min
    );
}


function sleep(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );
}
