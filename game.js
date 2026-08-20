// ============================================================
// ROADGAME - VRAIE CARTE 3D
// Utilise Nominatim + OpenStreetMap + Overpass
// ============================================================

const NOMINATIM =
    "https://nominatim.openstreetmap.org/search";

const OVERPASS =
    "https://overpass-api.de/api/interpreter";

let scene;
let camera;
let renderer;
let player;

let gameStarted = false;

let centerLat = 0;
let centerLon = 0;

let playerX = 0;
let playerZ = 0;

let cameraAngle = 0;

let speed = 0.55;

let roadObjects = [];

let keys = {
    forward: false,
    back: false,
    left: false,
    right: false
};

const game =
    document.getElementById("game");

const menu =
    document.getElementById("menu");

const locationInput =
    document.getElementById("location");

const play =
    document.getElementById("play");

const message =
    document.getElementById("message");

const loading =
    document.getElementById("loading");

const loadingText =
    document.getElementById("loadingText");

const hud =
    document.getElementById("hud");

const info =
    document.getElementById("info");

const controls =
    document.getElementById("controls");

const cameraUI =
    document.getElementById("camera");

const vehiclePanel =
    document.getElementById("vehiclePanel");


// ============================================================
// LANCER
// ============================================================

play.addEventListener(
    "click",
    startGame
);

locationInput.addEventListener(
    "keydown",
    e => {

        if (e.key === "Enter") {
            startGame();
        }

    }
);


async function startGame() {

    const query =
        locationInput.value.trim();

    if (!query) {

        message.textContent =
            "❌ Écris une ville ou une adresse.";

        return;
    }

    loading.style.display =
        "flex";

    message.textContent = "";

    try {

        loadingText.textContent =
            "📍 Recherche de " + query + "...";

        const place =
            await geocode(query);

        if (!place) {

            throw new Error(
                "Lieu introuvable."
            );
        }

        centerLat =
            Number(place.lat);

        centerLon =
            Number(place.lon);

        loadingText.textContent =
            "🛣️ Récupération des routes et bâtiments...";

        const osm =
            await getOSMData(
                centerLat,
                centerLon
            );

        loadingText.textContent =
            "🏙️ Construction de la ville 3D...";

        initThree();

        buildWorld(
            osm
        );

        createPlayer();

        menu.style.display =
            "none";

        hud.style.display =
            "block";

        controls.style.display =
            "block";

        cameraUI.style.display =
            "block";

        vehiclePanel.style.display =
            "block";

        info.textContent =
            "📍 " +
            (
                place.display_name ||
                query
            );

        gameStarted =
            true;

        updateCamera();

        animate();

    } catch (error) {

        console.error(error);

        message.textContent =
            "❌ " +
            error.message;

        alert(
            "Impossible de générer cette map.\n\n" +
            error.message
        );

    } finally {

        loading.style.display =
            "none";
    }
}


// ============================================================
// GÉOCODAGE
// ============================================================

async function geocode(
    query
) {

    const url =
        NOMINATIM +
        "?format=jsonv2" +
        "&limit=1" +
        "&q=" +
        encodeURIComponent(
            query
        );

    const response =
        await fetch(url);

    if (!response.ok) {

        throw new Error(
            "Le service de recherche est indisponible."
        );
    }

    const results =
        await response.json();

    if (
        !results ||
        results.length === 0
    ) {

        return null;
    }

    return results[0];
}


// ============================================================
// OBTENIR LES DONNÉES OSM
// ============================================================

async function getOSMData(
    lat,
    lon
) {

    // Environ 1 km autour
    // du point demandé.

    const delta =
        0.009;

    const south =
        lat - delta;

    const north =
        lat + delta;

    const west =
        lon - delta;

    const east =
        lon + delta;


    const query = `
[out:json][timeout:30];

(
  way["highway"](${south},${west},${north},${east});
  way["building"](${south},${west},${north},${east});
);

out body geom;
`;


    const response =
        await fetch(
            OVERPASS,
            {
                method: "POST",
                body: query,
                headers: {
                    "Content-Type":
                        "text/plain"
                }
            }
        );


    if (!response.ok) {

        throw new Error(
            "Overpass ne répond pas."
        );
    }


    const data =
        await response.json();


    if (
        !data.elements ||
        data.elements.length === 0
    ) {

        throw new Error(
            "Aucune donnée cartographique trouvée autour de cet endroit."
        );
    }


    return data.elements;
}


// ============================================================
// THREE.JS
// ============================================================

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
            250,
            1300
        );


    camera =
        new THREE.PerspectiveCamera(
            65,
            window.innerWidth /
            window.innerHeight,
            0.1,
            2000
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


    game.innerHTML = "";

    game.appendChild(
        renderer.domElement
    );


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
        300,
        500,
        200
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


// ============================================================
// CONSTRUIRE LE MONDE OSM
// ============================================================

function buildWorld(
    elements
) {

    roadObjects = [];


    // SOL

    const ground =
        new THREE.Mesh(
            new THREE.PlaneGeometry(
                2500,
                2500
            ),
            new THREE.MeshStandardMaterial({
                color: 0x57964f,
                roughness: 1
            })
        );


    ground.rotation.x =
        -Math.PI / 2;

    ground.receiveShadow =
        true;

    scene.add(
        ground
    );


    for (
        const element of elements
    ) {

        if (
            element.type !==
            "way" ||
            !element.geometry
        ) {

            continue;
        }


        if (
            element.tags &&
            element.tags.building
        ) {

            createBuildingFromOSM(
                element
            );

            continue;
        }


        if (
            element.tags &&
            element.tags.highway
        ) {

            createRoadFromOSM(
                element
            );
        }
    }
}


// ============================================================
// CONVERSION GPS -> MONDE 3D
// ============================================================

function gpsToWorld(
    lat,
    lon
) {

    const metersLat =
        111320;

    const metersLon =
        111320 *
        Math.cos(
            centerLat *
            Math.PI /
            180
        );


    const x =
        (
            lon -
            centerLon
        ) *
        metersLon;


    const z =
        -(
            lat -
            centerLat
        ) *
        metersLat;


    return {
        x,
        z
    };
}


// ============================================================
// ROUTE OSM
// ============================================================

function createRoadFromOSM(
    way
) {

    const highway =
        way.tags.highway;


    const allowed = [
        "motorway",
        "trunk",
        "primary",
        "secondary",
        "tertiary",
        "unclassified",
        "residential",
        "living_street",
        "service"
    ];


    if (
        !allowed.includes(
            highway
        )
    ) {

        return;
    }


    let width =
        5;


    if (
        highway === "motorway" ||
        highway === "trunk"
    ) {

        width = 12;

    } else if (
        highway === "primary"
    ) {

        width = 9;

    } else if (
        highway === "secondary"
    ) {

        width = 8;

    } else if (
        highway === "tertiary"
    ) {

        width = 7;
    }


    const points =
        way.geometry.map(
            p =>
                gpsToWorld(
                    p.lat,
                    p.lon
                )
        );


    for (
        let i = 0;
        i < points.length - 1;
        i++
    ) {

        const a =
            points[i];

        const b =
            points[i + 1];


        createRoadSegment(
            a,
            b,
            width
        );
    }
}


// ============================================================
// SEGMENT ROUTE
// ============================================================

function createRoadSegment(
    a,
    b,
    width
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


    if (
        length < 1
    )
        return;


    const geometry =
        new THREE.BoxGeometry(
            width,
            0.12,
            length
        );


    const material =
        new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 1
        });


    const road =
        new THREE.Mesh(
            geometry,
            material
        );


    road.position.set(
        (a.x + b.x) / 2,
        0.04,
        (a.z + b.z) / 2
    );


    road.rotation.y =
        Math.atan2(
            dx,
            dz
        );


    road.receiveShadow =
        true;


    scene.add(
        road
    );


    roadObjects.push(
        road
    );
}


// ============================================================
// BÂTIMENT OSM
// ============================================================

function createBuildingFromOSM(
    way
) {

    if (
        way.geometry.length <
        3
    )
        return;


    const points =
        way.geometry.map(
            p =>
                gpsToWorld(
                    p.lat,
                    p.lon
                )
        );


    let minX =
        Infinity;

    let maxX =
        -Infinity;

    let minZ =
        Infinity;

    let maxZ =
        -Infinity;


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
                    p.z
                );

            maxZ =
                Math.max(
                    maxZ,
                    p.z
                );
        }
    );


    const width =
        maxX - minX;

    const depth =
        maxZ - minZ;


    if (
        width < 2 ||
        depth < 2
    )
        return;


    // hauteur OSM si disponible

    let height =
        7;


    if (
        way.tags &&
        way.tags.height
    ) {

        const parsed =
            parseFloat(
                way.tags.height
            );

        if (
            Number.isFinite(
                parsed
            )
        ) {

            height =
                Math.max(
                    3,
                    Math.min(
                        parsed,
                        80
                    )
                );
        }
    }


    const levels =
        parseInt(
            way.tags &&
            way.tags["building:levels"]
        );


    if (
        Number.isFinite(
            levels
        )
    ) {

        height =
            Math.max(
                3,
                Math.min(
                    levels * 3,
                    80
                )
            );
    }


    const material =
        new THREE.MeshStandardMaterial({
            color:
                randomBuildingColor(),
            roughness:
                .85
        });


    const building =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                Math.min(
                    width,
                    80
                ),
                height,
                Math.min(
                    depth,
                    80
                )
            ),
            material
        );


    building.position.set(
        (minX + maxX) / 2,
        height / 2,
        (minZ + maxZ) / 2
    );


    building.castShadow =
        true;

    building.receiveShadow =
        true;


    scene.add(
        building
    );
}


// ============================================================
// VOITURE
// ============================================================

function createPlayer() {

    player =
        new THREE.Group();


    const body =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                2.8,
                1,
                4.8
            ),
            new THREE.MeshStandardMaterial({
                color: 0x1264ff,
                roughness: .6
            })
        );


    body.position.y =
        1;


    body.castShadow =
        true;


    player.add(
        body
    );


    const roof =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                2.1,
                .75,
                2.3
            ),
            new THREE.MeshStandardMaterial({
                color: 0x20252b
            })
        );


    roof.position.set(
        0,
        1.75,
        -.2
    );


    roof.castShadow =
        true;


    player.add(
        roof
    );


    const wheelGeo =
        new THREE.CylinderGeometry(
            .5,
            .5,
            .38,
            16
        );


    const wheelMat =
        new THREE.MeshStandardMaterial({
            color: 0x111111
        });


    [
        [-1.45,.5,-1.55],
        [1.45,.5,-1.55],
        [-1.45,.5,1.55],
        [1.45,.5,1.55]
    ].forEach(
        p => {

            const wheel =
                new THREE.Mesh(
                    wheelGeo,
                    wheelMat
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


    player.position.set(
        0,
        0,
        0
    );
}


// ============================================================
// CAMÉRA
// ============================================================

function updateCamera() {

    if (
        !camera ||
        !player
    )
        return;


    const distance =
        13;

    const height =
        7;


    camera.position.x =
        player.position.x +
        Math.sin(
            cameraAngle
        ) *
        distance;


    camera.position.y =
        height;


    camera.position.z =
        player.position.z +
        Math.cos(
            cameraAngle
        ) *
        distance;


    camera.lookAt(
        player.position.x,
        1,
        player.position.z
    );
}


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


// ============================================================
// DÉPLACEMENT
// ============================================================

function updatePlayer() {

    if (
        !player
    )
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


    player.position.x +=
        dx * speed;


    player.position.z +=
        dz * speed;


    player.rotation.y =
        Math.atan2(
            dx,
            dz
        );


    updateCamera();
}


// ============================================================
// CONTRÔLES IPHONE
// ============================================================

document
    .querySelectorAll(
        "[data-control]"
    )
    .forEach(
        button => {

            const control =
                button.dataset.control;


            button.addEventListener(
                "touchstart",
                e => {

                    e.preventDefault();

                    keys[control] =
                        true;
                },
                {
                    passive: false
                }
            );


            button.addEventListener(
                "touchend",
                e => {

                    e.preventDefault();

                    keys[control] =
                        false;
                },
                {
                    passive: false
                }
            );


            button.addEventListener(
                "touchcancel",
                () => {

                    keys[control] =
                        false;
                }
            );
        }
    );


// ============================================================
// CLAVIER
// ============================================================

document.addEventListener(
    "keydown",
    e => {

        if (
            e.key === "ArrowUp" ||
            e.key.toLowerCase() === "w"
        )
            keys.forward = true;


        if (
            e.key === "ArrowDown" ||
            e.key.toLowerCase() === "s"
        )
            keys.back = true;


        if (
            e.key === "ArrowLeft" ||
            e.key.toLowerCase() === "a"
        )
            keys.left = true;


        if (
            e.key === "ArrowRight" ||
            e.key.toLowerCase() === "d"
        )
            keys.right = true;
    }
);


document.addEventListener(
    "keyup",
    e => {

        if (
            e.key === "ArrowUp" ||
            e.key.toLowerCase() === "w"
        )
            keys.forward = false;


        if (
            e.key === "ArrowDown" ||
            e.key.toLowerCase() === "s"
        )
            keys.back = false;


        if (
            e.key === "ArrowLeft" ||
            e.key.toLowerCase() === "a"
        )
            keys.left = false;


        if (
            e.key === "ArrowRight" ||
            e.key.toLowerCase() === "d"
        )
            keys.right = false;
    }
);


// ============================================================
// VÉHICULES
// ============================================================

document
    .querySelectorAll(
        "[data-vehicle]"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    if (!player)
                        return;


                    const vehicle =
                        button.dataset.vehicle;


                    if (
                        vehicle ===
                        "car"
                    ) {

                        speed =
                            .55;

                    } else if (
                        vehicle ===
                        "truck"
                    ) {

                        speed =
                            .35;

                    } else {

                        speed =
                            .42;
                    }
                }
            );
        }
    );


// ============================================================
// BOUCLE
// ============================================================

function animate() {

    if (!gameStarted)
        return;


    requestAnimationFrame(
        animate
    );


    updatePlayer();


    renderer.render(
        scene,
        camera
    );
}


// ============================================================
// RESIZE
// ============================================================

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


// ============================================================
// COULEURS BÂTIMENTS
// ============================================================

function randomBuildingColor() {

    const colors = [
        0xd8d8d8,
        0xc7d0d8,
        0xe5c6a7,
        0xbfc9d2,
        0xf0d6bd,
        0xc9bca9
    ];


    return colors[
        Math.floor(
            Math.random() *
            colors.length
        )
    ];
}
