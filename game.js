// ============================================================
// ROADGAME - GAME.JS
// Carte satellite + monde 3D + bâtiments réalistes
// Collisions + photos + joystick + caméra + mini-map
// Multijoueur + zoom tactile
// ============================================================

const NOMINATIM =
    "https://nominatim.openstreetmap.org/search";

const OVERPASS =
    "https://overpass-api.de/api/interpreter";

const WIKIMEDIA_API =
    "https://commons.wikimedia.org/w/api.php";

const SATELLITE_URL =
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";


// ============================================================
// THREE.JS
// ============================================================

let scene;
let camera;
let renderer;
let player;


// ============================================================
// POSITION
// ============================================================

let centerLat = 0;
let centerLon = 0;

let worldData = [];

let gameStarted = false;

let cameraAngle = 0;

let speed = 0.55;

let moveX = 0;
let moveY = 0;

let joystickActive = false;

let lastTouchX = null;

let multiplayerSocket = null;


// ============================================================
// COLLISIONS
// ============================================================

let collisionBuildings = [];

const PLAYER_RADIUS = 1.45;


// ============================================================
// CARTE
// ============================================================

let mapZoom = 0.055;

let mapOffsetX = 0;
let mapOffsetY = 0;

let mapDragging = false;

let mapPinching = false;

let mapLastX = 0;
let mapLastY = 0;

let mapStartDistance = 0;

let mapStartZoom = 0;


// ============================================================
// PHOTO DE BÂTIMENT
// ============================================================

let nearbyBuilding = null;

let photoSearchTimer = null;

let photoRequestRunning = false;


// ============================================================
// ELEMENTS HTML
// ============================================================

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

const locationName =
    document.getElementById("locationName");

const joystick =
    document.getElementById("joystick");

const stick =
    document.getElementById("stick");

const miniMap =
    document.getElementById("miniMap");

const miniCanvas =
    document.getElementById("miniMapCanvas");

const fullMap =
    document.getElementById("fullscreenMap");

const fullCanvas =
    document.getElementById("fullMapCanvas");

const multi =
    document.getElementById("multiplayer");


// ============================================================
// LANCER LA PARTIE
// ============================================================

play.addEventListener(
    "click",
    startGame
);


locationInput.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {
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


    try {

        loadingText.textContent =
            "📍 Recherche de " + query;


        const place =
            await geocode(query);


        if (!place) {

            throw new Error(
                "Ville ou adresse introuvable."
            );
        }


        centerLat =
            Number(place.lat);

        centerLon =
            Number(place.lon);


        loadingText.textContent =
            "🛰️ Préparation de la carte satellite...";


        const data =
            await getOSMData(
                centerLat,
                centerLon
            );


        worldData =
            data;


        loadingText.textContent =
            "🏙️ Construction de la ville 3D...";


        initThree();


        buildWorld(
            data
        );


        createPlayer();


        menu.style.display =
            "none";


        hud.style.display =
            "block";


        joystick.style.display =
            "block";


        const cameraButtons =
            document.getElementById(
                "cameraButtons"
            );

        if (cameraButtons) {

            cameraButtons.style.display =
                "block";
        }


        const vehiclePanel =
            document.getElementById(
                "vehiclePanel"
            );

        if (vehiclePanel) {

            vehiclePanel.style.display =
                "block";
        }


        locationName.textContent =
            "📍 " +
            (
                place.display_name ||
                query
            );


        gameStarted =
            true;


        mapZoom =
            0.055;

        mapOffsetX =
            0;

        mapOffsetY =
            0;


        resizeMaps();

        drawMiniMap();

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
// GEOCODAGE
// ============================================================

async function geocode(query) {

    const url =
        NOMINATIM +
        "?format=jsonv2" +
        "&limit=1" +
        "&q=" +
        encodeURIComponent(query);


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
            "Le service de localisation ne répond pas."
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
// OPENSTREETMAP
// ============================================================

async function getOSMData(
    lat,
    lon
) {

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
[out:json][timeout:50];
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

                headers: {
                    "Content-Type":
                        "text/plain"
                },

                body: query
            }
        );


    if (!response.ok) {

        throw new Error(
            "Impossible de récupérer la carte."
        );
    }


    const data =
        await response.json();


    return data.elements || [];
}


// ============================================================
// INITIALISER THREE.JS
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
            0x87c9f5
        );


    scene.fog =
        new THREE.Fog(
            0x87c9f5,
            300,
            1800
        );


    camera =
        new THREE.PerspectiveCamera(
            65,
            innerWidth /
            innerHeight,
            0.1,
            2500
        );


    renderer =
        new THREE.WebGLRenderer({
            antialias: true
        });


    renderer.setPixelRatio(
        Math.min(
            devicePixelRatio,
            2
        )
    );


    renderer.setSize(
        innerWidth,
        innerHeight
    );


    renderer.shadowMap.enabled =
        true;


    renderer.shadowMap.type =
        THREE.PCFSoftShadowMap;


    game.innerHTML = "";


    game.appendChild(
        renderer.domElement
    );


    const ambient =
        new THREE.HemisphereLight(
            0xffffff,
            0x557755,
            2.7
        );


    scene.add(
        ambient
    );


    const sun =
        new THREE.DirectionalLight(
            0xffffff,
            3.2
        );


    sun.position.set(
        300,
        500,
        200
    );


    sun.castShadow =
        true;


    sun.shadow.mapSize.width =
        2048;

    sun.shadow.mapSize.height =
        2048;


    scene.add(
        sun
    );
}


// ============================================================
// GPS -> MONDE 3D
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


    return {

        x:
            (lon - centerLon) *
            metersLon,

        z:
            -(lat - centerLat) *
            metersLat

    };
}


// ============================================================
// MONDE
// ============================================================

function buildWorld(
    elements
) {

    collisionBuildings = [];


    const ground =
        new THREE.Mesh(

            new THREE.PlaneGeometry(
                2500,
                2500
            ),

            new THREE.MeshStandardMaterial({
                color: 0x5b9b52,
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


    // Routes d'abord
    for (
        const element of elements
    ) {

        if (
            element.type !== "way" ||
            !element.geometry
        ) {

            continue;
        }


        if (
            element.tags &&
            element.tags.highway
        ) {

            createRoad(
                element
            );
        }
    }


    // Bâtiments ensuite
    for (
        const element of elements
    ) {

        if (
            element.type !== "way" ||
            !element.geometry
        ) {

            continue;
        }


        if (
            element.tags &&
            element.tags.building
        ) {

            createBuilding(
                element
            );
        }
    }
}


// ============================================================
// ROUTES
// ============================================================

function createRoad(
    way
) {

    const validRoads = [

        "motorway",
        "trunk",
        "primary",
        "secondary",
        "tertiary",
        "residential",
        "living_street",
        "unclassified",
        "service"

    ];


    if (
        !validRoads.includes(
            way.tags.highway
        )
    ) {

        return;
    }


    let width =
        5;


    switch (
        way.tags.highway
    ) {

        case "motorway":
        case "trunk":

            width = 12;

            break;


        case "primary":

            width = 9;

            break;


        case "secondary":

            width = 8;

            break;


        case "tertiary":

            width = 7;

            break;

    }


    const points =
        way.geometry.map(
            point =>
                gpsToWorld(
                    point.lat,
                    point.lon
                )
        );


    for (
        let i = 0;
        i < points.length - 1;
        i++
    ) {

        createRoadSegment(
            points[i],
            points[i + 1],
            width
        );
    }
}


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
        length < 0.5
    ) {

        return;
    }


    const road =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                width,
                0.12,
                length
            ),

            new THREE.MeshStandardMaterial({
                color: 0x3b3b3b,
                roughness: 0.9
            })

        );


    road.position.set(

        (a.x + b.x) / 2,

        0.06,

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


    if (
        width >= 8
    ) {

        const line =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    0.12,
                    0.02,
                    length
                ),

                new THREE.MeshBasicMaterial({
                    color: 0xffffff
                })

            );


        line.position.copy(
            road.position
        );


        line.position.y =
            0.13;


        line.rotation.y =
            road.rotation.y;


        scene.add(
            line
        );
    }
}


// ============================================================
// BÂTIMENT RÉALISTE
// ============================================================

function createBuilding(
    way
) {

    if (
        way.geometry.length < 3
    ) {

        return;
    }


    const points =
        way.geometry.map(
            point =>
                gpsToWorld(
                    point.lat,
                    point.lon
                )
        );


    const shape =
        new THREE.Shape();


    points.forEach(
        (point, index) => {

            if (index === 0) {

                shape.moveTo(
                    point.x,
                    -point.z
                );

            } else {

                shape.lineTo(
                    point.x,
                    -point.z
                );
            }
        }
    );


    shape.closePath();


    let height =
        6;


    if (
        way.tags.height
    ) {

        const h =
            parseFloat(
                way.tags.height
            );


        if (
            Number.isFinite(h)
        ) {

            height =
                Math.min(
                    Math.max(
                        h,
                        3
                    ),
                    80
                );
        }
    }


    if (
        way.tags["building:levels"]
    ) {

        const levels =
            parseInt(
                way.tags["building:levels"]
            );


        if (
            Number.isFinite(levels)
        ) {

            height =
                Math.min(
                    Math.max(
                        levels * 3,
                        3
                    ),
                    80
                );
        }
    }


    const geometry =
        new THREE.ExtrudeGeometry(
            shape,
            {
                depth: height,

                bevelEnabled: false,

                steps: 1
            }
        );


    geometry.rotateX(
        -Math.PI / 2
    );


    const material =
        new THREE.MeshStandardMaterial({

            color:
                buildingColor(
                    way.tags.building
                ),

            roughness: 0.78
        });


    const building =
        new THREE.Mesh(
            geometry,
            material
        );


    building.position.y =
        0;


    building.castShadow =
        true;


    building.receiveShadow =
        true;


    scene.add(
        building
    );


    // --------------------------------------------------------
    // COLLISION
    // --------------------------------------------------------

    const collision =
        getBuildingBounds(
            points,
            height
        );


    collisionBuildings.push({

        minX: collision.minX,

        maxX: collision.maxX,

        minZ: collision.minZ,

        maxZ: collision.maxZ,

        element: way,

        mesh: building

    });


    // --------------------------------------------------------
    // INFOS
    // --------------------------------------------------------

    building.userData.osm =
        way;


    building.userData.photo =
        null;


    building.userData.photoLoading =
        false;
}


// ============================================================
// BOUNDS BÂTIMENT
// ============================================================

function getBuildingBounds(
    points,
    height
) {

    let minX =
        Infinity;

    let maxX =
        -Infinity;

    let minZ =
        Infinity;

    let maxZ =
        -Infinity;


    points.forEach(
        point => {

            minX =
                Math.min(
                    minX,
                    point.x
                );


            maxX =
                Math.max(
                    maxX,
                    point.x
                );


            minZ =
                Math.min(
                    minZ,
                    point.z
                );


            maxZ =
                Math.max(
                    maxZ,
                    point.z
                );
        }
    );


    return {

        minX,
        maxX,
        minZ,
        maxZ,
        height

    };
}


// ============================================================
// COULEUR BÂTIMENT
// ============================================================

function buildingColor(
    type
) {

    if (
        type === "industrial"
    ) {

        return 0x9da3a8;
    }


    if (
        type === "commercial"
    ) {

        return 0xc6c6c6;
    }


    if (
        type === "school"
    ) {

        return 0xe2c18f;
    }


    if (
        type === "church"
    ) {

        return 0xd8d0c0;
    }


    if (
        type === "house"
    ) {

        return 0xd7c7b5;
    }


    if (
        type === "apartments"
    ) {

        return 0xbfc8cc;
    }


    const colors = [

        0xd7d1c5,
        0xc9c9c9,
        0xe1c7aa,
        0xbfc8cc,
        0xd6b9a0

    ];


    return colors[
        Math.floor(
            Math.random() *
            colors.length
        )
    ];
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
                roughness: 0.5
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
                0.7,
                2.3
            ),

            new THREE.MeshStandardMaterial({
                color: 0x20252a
            })

        );


    roof.position.set(
        0,
        1.75,
        -0.2
    );


    player.add(
        roof
    );


    const wheelGeometry =
        new THREE.CylinderGeometry(
            0.5,
            0.5,
            0.38,
            16
        );


    const wheelMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x111111
        });


    const wheels = [

        [-1.45, 0.5, -1.55],
        [1.45, 0.5, -1.55],
        [-1.45, 0.5, 1.55],
        [1.45, 0.5, 1.55]

    ];


    wheels.forEach(
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
// COLLISION JOUEUR / BÂTIMENT
// ============================================================

function isColliding(
    x,
    z
) {

    for (
        const building of collisionBuildings
    ) {

        if (
            x + PLAYER_RADIUS >
            building.minX &&

            x - PLAYER_RADIUS <
            building.maxX &&

            z + PLAYER_RADIUS >
            building.minZ &&

            z - PLAYER_RADIUS <
            building.maxZ
        ) {

            return true;
        }
    }


    return false;
}


// ============================================================
// CAMÉRA
// ============================================================

function updateCamera() {

    if (!player)
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


const cameraLeft =
    document.getElementById(
        "cameraLeft"
    );


if (cameraLeft) {

    cameraLeft.addEventListener(
        "click",
        () => {

            cameraAngle -=
                0.35;

            updateCamera();

        }
    );
}


const cameraRight =
    document.getElementById(
        "cameraRight"
    );


if (cameraRight) {

    cameraRight.addEventListener(
        "click",
        () => {

            cameraAngle +=
                0.35;

            updateCamera();

        }
    );
}


// ============================================================
// JOYSTICK
// ============================================================

joystick.addEventListener(
    "touchstart",
    event => {

        event.preventDefault();

        joystickActive =
            true;


        updateJoystick(
            event.touches[0]
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


        if (
            joystickActive
        ) {

            updateJoystick(
                event.touches[0]
            );
        }

    },
    {
        passive: false
    }
);


joystick.addEventListener(
    "touchend",
    resetJoystick
);


joystick.addEventListener(
    "touchcancel",
    resetJoystick
);


function updateJoystick(
    touch
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
        touch.clientX -
        centerX;


    let dy =
        touch.clientY -
        centerY;


    const max =
        rect.width / 2 -
        32;


    const length =
        Math.sqrt(
            dx * dx +
            dy * dy
        );


    if (
        length > max
    ) {

        dx =
            dx / length *
            max;


        dy =
            dy / length *
            max;
    }


    stick.style.transform =
        `translate(${dx}px, ${dy}px)`;


    moveX =
        dx / max;


    moveY =
        dy / max;
}


function resetJoystick() {

    joystickActive =
        false;


    moveX = 0;

    moveY = 0;


    stick.style.transform =
        "translate(0,0)";
}


// ============================================================
// CAMÉRA AU DOIGT
// ============================================================

document.addEventListener(
    "touchstart",
    event => {

        if (
            event.target.closest(
                "#joystick"
            ) ||
            event.target.closest(
                "#miniMap"
            ) ||
            event.target.closest(
                "#fullscreenMap"
            )
        ) {

            return;
        }


        if (
            event.touches.length === 1
        ) {

            lastTouchX =
                event.touches[0].clientX;
        }

    },
    {
        passive: true
    }
);


document.addEventListener(
    "touchmove",
    event => {

        if (
            event.target.closest(
                "#joystick"
            ) ||
            event.target.closest(
                "#fullscreenMap"
            )
        ) {

            return;
        }


        if (
            event.touches.length !== 1 ||
            lastTouchX === null
        ) {

            return;
        }


        const x =
            event.touches[0].clientX;


        const delta =
            x - lastTouchX;


        cameraAngle -=
            delta * 0.008;


        lastTouchX =
            x;


        updateCamera();

    },
    {
        passive: true
    }
);


document.addEventListener(
    "touchend",
    () => {

        lastTouchX =
            null;

    }
);


// ============================================================
// DÉPLACEMENT
// ============================================================

function updatePlayer() {

    if (!player)
        return;


    if (
        Math.abs(moveX) < 0.05 &&
        Math.abs(moveY) < 0.05
    ) {

        checkNearbyBuildings();

        return;
    }


    let dx =
        moveX;


    let dz =
        moveY;


    const length =
        Math.sqrt(
            dx * dx +
            dz * dz
        );


    if (
        length > 1
    ) {

        dx /=
            length;

        dz /=
            length;
    }


    const forwardX =
        -Math.sin(
            cameraAngle
        );


    const forwardZ =
        -Math.cos(
            cameraAngle
        );


    const rightX =
        Math.cos(
            cameraAngle
        );


    const rightZ =
        -Math.sin(
            cameraAngle
        );


    const worldX =
        rightX * dx +
        forwardX * (-dz);


    const worldZ =
        rightZ * dx +
        forwardZ * (-dz);


    const nextX =
        player.position.x +
        worldX * speed;


    const nextZ =
        player.position.z +
        worldZ * speed;


    // ========================================================
    // COLLISION
    // On teste séparément X et Z pour permettre de longer
    // les murs au lieu de rester complètement bloqué.
    // ========================================================

    if (
        !isColliding(
            nextX,
            player.position.z
        )
    ) {

        player.position.x =
            nextX;
    }


    if (
        !isColliding(
            player.position.x,
            nextZ
        )
    ) {

        player.position.z =
            nextZ;
    }


    if (
        Math.abs(worldX) > 0.01 ||
        Math.abs(worldZ) > 0.01
    ) {

        player.rotation.y =
            Math.atan2(
                worldX,
                worldZ
            );
    }


    updateCamera();

    drawMiniMap();

    checkNearbyBuildings();

    sendMultiplayerPosition();
}


// ============================================================
// BÂTIMENT PROCHE
// ============================================================

function checkNearbyBuildings() {

    if (!player)
        return;


    let closest =
        null;


    let closestDistance =
        Infinity;


    for (
        const building of collisionBuildings
    ) {

        const centerX =
            (
                building.minX +
                building.maxX
            ) / 2;


        const centerZ =
            (
                building.minZ +
                building.maxZ
            ) / 2;


        const dx =
            player.position.x -
            centerX;


        const dz =
            player.position.z -
            centerZ;


        const distance =
            Math.sqrt(
                dx * dx +
                dz * dz
            );


        if (
            distance < closestDistance
        ) {

            closestDistance =
                distance;

            closest =
                building;
        }
    }


    if (
        closest &&
        closestDistance < 35
    ) {

        if (
            nearbyBuilding !==
            closest
        ) {

            nearbyBuilding =
                closest;

            showBuildingInfo(
                closest
            );

            searchBuildingPhoto(
                closest
            );
        }

    } else {

        nearbyBuilding =
            null;

        hideBuildingInfo();
    }
}


// ============================================================
// INFOS PHOTO
// ============================================================

function getBuildingName(
    building
) {

    const tags =
        building.element.tags ||
        {};


    return (
        tags.name ||
        tags["official_name"] ||
        tags["addr:housenumber"] ||
        "Bâtiment"
    );
}


function showBuildingInfo(
    building
) {

    let panel =
        document.getElementById(
            "buildingPhotoPanel"
        );


    if (!panel) {

        panel =
            document.createElement(
                "div"
            );


        panel.id =
            "buildingPhotoPanel";


        panel.style.position =
            "fixed";

        panel.style.left =
            "50%";

        panel.style.bottom =
            "25px";

        panel.style.transform =
            "translateX(-50%)";

        panel.style.width =
            "min(90vw, 340px)";

        panel.style.background =
            "rgba(0,0,0,.88)";

        panel.style.color =
            "white";

        panel.style.padding =
            "12px";

        panel.style.borderRadius =
            "16px";

        panel.style.zIndex =
            "9999";

        panel.style.display =
            "none";

        panel.style.fontFamily =
            "Arial, sans-serif";


        document.body.appendChild(
            panel
        );
    }


    panel.style.display =
        "block";


    panel.innerHTML = `

        <div style="
            font-size:17px;
            font-weight:bold;
            margin-bottom:8px;
        ">
            🏢 ${escapeHTML(
                getBuildingName(
                    building
                )
            )}
        </div>

        <div id="buildingPhotoContent">

            <div style="
                opacity:.8;
                font-size:14px;
            ">
                🔎 Recherche d'une photo...
            </div>

        </div>

    `;
}


function hideBuildingInfo() {

    const panel =
        document.getElementById(
            "buildingPhotoPanel"
        );


    if (panel) {

        panel.style.display =
            "none";
    }
}


// ============================================================
// RECHERCHE PHOTO WIKIMEDIA
// ============================================================

async function searchBuildingPhoto(
    building
) {

    if (
        photoRequestRunning
    ) {

        return;
    }


    const tags =
        building.element.tags ||
        {};


    const name =
        tags.name ||
        tags["official_name"] ||
        "";


    if (!name) {

        setPhotoMessage(
            "📍 Ce bâtiment n'a pas encore de photo publique trouvée."
        );

        return;
    }


    photoRequestRunning =
        true;


    try {

        const query =
            encodeURIComponent(
                name
            );


        const url =
            WIKIMEDIA_API +
            "?action=query" +
            "&generator=search" +
            "&gsrsearch=" +
            query +
            "&gsrnamespace=6" +
            "&gsrlimit=5" +
            "&prop=imageinfo" +
            "&iiprop=url" +
            "&iiurlwidth=500" +
            "&format=json" +
            "&origin=*";


        const response =
            await fetch(
                url
            );


        if (!response.ok) {

            throw new Error(
                "Recherche photo impossible"
            );
        }


        const data =
            await response.json();


        const pages =
            data.query &&
            data.query.pages;


        if (!pages) {

            setPhotoMessage(
                "📷 Aucune photo publique trouvée."
            );

            return;
        }


        const first =
            Object.values(
                pages
            )[0];


        if (
            !first ||
            !first.imageinfo ||
            !first.imageinfo[0]
        ) {

            setPhotoMessage(
                "📷 Aucune photo publique trouvée."
            );

            return;
        }


        const image =
            first.imageinfo[0];


        const imageUrl =
            image.thumburl ||
            image.url;


        building.photo =
            imageUrl;


        setPhotoImage(
            imageUrl
        );


    } catch (error) {

        console.warn(
            "Photo:",
            error
        );


        setPhotoMessage(
            "📷 Aucune photo publique trouvée."
        );

    } finally {

        photoRequestRunning =
            false;
    }
}


function setPhotoMessage(
    text
) {

    const content =
        document.getElementById(
            "buildingPhotoContent"
        );


    if (!content)
        return;


    content.innerHTML = `

        <div style="
            font-size:14px;
            opacity:.85;
        ">
            ${escapeHTML(text)}
        </div>

    `;
}


function setPhotoImage(
    imageUrl
) {

    const content =
        document.getElementById(
            "buildingPhotoContent"
        );


    if (!content)
        return;


    content.innerHTML = `

        <img
            src="${escapeAttribute(
                imageUrl
            )}"
            style="
                width:100%;
                max-height:220px;
                object-fit:cover;
                border-radius:12px;
                display:block;
            "
            loading="lazy"
            onerror="
                this.style.display='none';
                this.nextElementSibling.style.display='block';
            "
        >

        <div style="
            display:none;
            padding:10px 0;
            font-size:14px;
        ">
            📷 Photo indisponible.
        </div>

        <div style="
            margin-top:7px;
            font-size:11px;
            opacity:.65;
        ">
            Photo provenant de Wikimedia Commons.
        </div>

    `;
}


// ============================================================
// SÉCURITÉ HTML
// ============================================================

function escapeHTML(
    text
) {

    return String(text)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}


function escapeAttribute(
    text
) {

    return String(text)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        );
}


// ============================================================
// MINI-CARTE
// ============================================================

miniMap.addEventListener(
    "click",
    openFullMap
);


function resizeMaps() {

    const dpr =
        Math.min(
            devicePixelRatio,
            2
        );


    miniCanvas.width =
        miniCanvas.clientWidth *
        dpr;


    miniCanvas.height =
        miniCanvas.clientHeight *
        dpr;


    fullCanvas.width =
        fullCanvas.clientWidth *
        dpr;


    fullCanvas.height =
        fullCanvas.clientHeight *
        dpr;
}


function drawMiniMap() {

    if (!gameStarted)
        return;


    drawMap(
        miniCanvas
    );
}


function drawFullMap() {

    drawMap(
        fullCanvas
    );
}


// ============================================================
// TUILE SATELLITE
// ============================================================

function latLonToTile(
    lat,
    lon,
    zoom
) {

    const latRad =
        lat *
        Math.PI /
        180;


    const n =
        Math.pow(
            2,
            zoom
        );


    const x =
        (
            lon + 180
        ) /
        360 *
        n;


    const y =
        (
            1 -
            Math.asinh(
                Math.tan(
                    latRad
                )
            ) /
            Math.PI
        ) /
        2 *
        n;


    return {
        x,
        y
    };
}


function drawSatelliteBackground(
    ctx,
    width,
    height,
    scale
) {

    if (
        canvasIsMiniMap(
            ctx
        )
    ) {

        return;
    }


    const zoom =
        getSatelliteZoom(
            scale
        );


    const center =
        latLonToTile(
            centerLat,
            centerLon,
            zoom
        );


    const tileSize =
        256;


    const centerPixelX =
        center.x *
        tileSize;


    const centerPixelY =
        center.y *
        tileSize;


    const startX =
        centerPixelX -
        width / 2 -
        512;


    const startY =
        centerPixelY -
        height / 2 -
        512;


    const endX =
        centerPixelX +
        width / 2 +
        512;


    const endY =
        centerPixelY +
        height / 2 +
        512;


    const firstTileX =
        Math.floor(
            startX /
            tileSize
        );


    const firstTileY =
        Math.floor(
            startY /
            tileSize
        );


    const lastTileX =
        Math.floor(
            endX /
            tileSize
        );


    const lastTileY =
        Math.floor(
            endY /
            tileSize
        );


    const maxTile =
        Math.pow(
            2,
            zoom
        );


    for (
        let tx = firstTileX;
        tx <= lastTileX;
        tx++
    ) {

        for (
            let ty = firstTileY;
            ty <= lastTileY;
            ty++
        ) {

            const wrappedX =
                (
                    tx %
                    maxTile +
                    maxTile
                ) %
                maxTile;


            if (
                ty < 0 ||
                ty >= maxTile
            ) {

                continue;
            }


            const image =
                new Image();


            image.crossOrigin =
                "anonymous";


            image.src =
                SATELLITE_URL +
                "/" +
                zoom +
                "/" +
                ty +
                "/" +
                wrappedX;


            const drawX =
                tx *
                tileSize -
                centerPixelX +
                width / 2;


            const drawY =
                ty *
                tileSize -
                centerPixelY +
                height / 2;


            image.onload =
                () => {

                    if (
                        !gameStarted
                    )
                        return;


                    ctx.drawImage(
                        image,
                        drawX,
                        drawY,
                        tileSize,
                        tileSize
                    );


                    drawMapOverlays(
                        ctx
                    );
                };
        }
    }
}


function getSatelliteZoom(
    scale
) {

    if (
        scale < 0.015
    ) {

        return 15;
    }


    if (
        scale < 0.035
    ) {

        return 16;
    }


    if (
        scale < 0.07
    ) {

        return 17;
    }


    if (
        scale < 0.15
    ) {

        return 18;
    }


    return 19;
}


function canvasIsMiniMap(
    ctx
) {

    return (
        ctx.canvas ===
        miniCanvas
    );
}


// ============================================================
// CARTE
// ============================================================

function drawMap(
    canvas
) {

    const ctx =
        canvas.getContext(
            "2d"
        );


    const width =
        canvas.width;


    const height =
        canvas.height;


    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    let centerX =
        width / 2;


    let centerY =
        height / 2;


    let scale;


    if (
        canvas === miniCanvas
    ) {

        scale =
            0.20;


        ctx.fillStyle =
            "#d8d3c8";


        ctx.fillRect(
            0,
            0,
            width,
            height
        );


        drawMapOverlays(
            ctx,
            scale,
            centerX,
            centerY
        );


    } else {

        scale =
            mapZoom;


        centerX +=
            mapOffsetX;


        centerY +=
            mapOffsetY;


        drawSatelliteBackground(
            ctx,
            width,
            height,
            scale
        );


        drawMapOverlays(
            ctx,
            scale,
            centerX,
            centerY
        );
    }
}


// ============================================================
// OVERLAYS CARTE
// ============================================================

function drawMapOverlays(
    ctx,
    forcedScale,
    forcedCenterX,
    forcedCenterY
) {

    const canvas =
        ctx.canvas;


    let centerX =
        forcedCenterX ??
        canvas.width / 2;


    let centerY =
        forcedCenterY ??
        canvas.height / 2;


    let scale =
        forcedScale;


    if (
        scale === undefined
    ) {

        scale =
            canvas === miniCanvas
                ? 0.20
                : mapZoom;
    }


    // --------------------------------------------------------
    // BÂTIMENTS
    // --------------------------------------------------------

    for (
        const element of worldData
    ) {

        if (
            !element.geometry
        ) {

            continue;
        }


        const isBuilding =
            element.tags &&
            element.tags.building;


        if (!isBuilding)
            continue;


        const points =
            element.geometry.map(
                point =>
                    gpsToWorld(
                        point.lat,
                        point.lon
                    )
            );


        if (
            points.length < 3
        ) {

            continue;
        }


        ctx.beginPath();


        points.forEach(
            (point, index) => {

                const x =
                    centerX +
                    point.x *
                    scale;


                const y =
                    centerY +
                    point.z *
                    scale;


                if (
                    index === 0
                ) {

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


        if (
            canvas === miniCanvas
        ) {

            ctx.fillStyle =
                "rgba(190,190,190,.65)";

            ctx.strokeStyle =
                "rgba(80,80,80,.8)";

        } else {

            ctx.fillStyle =
                "rgba(255,255,255,.18)";

            ctx.strokeStyle =
                "rgba(255,255,255,.55)";
        }


        ctx.lineWidth =
            canvas === miniCanvas
                ? 1
                : 1.5;


        ctx.fill();

        ctx.stroke();
    }


    // --------------------------------------------------------
    // ROUTES PAR-DESSUS
    // --------------------------------------------------------

    for (
        const element of worldData
    ) {

        if (
            !element.geometry
        ) {

            continue;
        }


        const isRoad =
            element.tags &&
            element.tags.highway;


        if (!isRoad)
            continue;


        const points =
            element.geometry.map(
                point =>
                    gpsToWorld(
                        point.lat,
                        point.lon
                    )
            );


        if (
            points.length < 2
        ) {

            continue;
        }


        let roadWidth =
            2;


        if (
            element.tags.highway ===
            "primary"
        ) {

            roadWidth =
                5;

        } else if (
            element.tags.highway ===
            "secondary"
        ) {

            roadWidth =
                4;

        } else if (
            element.tags.highway ===
            "tertiary"
        ) {

            roadWidth =
                3;

        }


        ctx.beginPath();


        points.forEach(
            (point, index) => {

                const x =
                    centerX +
                    point.x *
                    scale;


                const y =
                    centerY +
                    point.z *
                    scale;


                if (
                    index === 0
                ) {

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


        ctx.strokeStyle =
            canvas === miniCanvas
                ? "#555"
                : "rgba(255,255,255,.92)";


        ctx.lineWidth =
            Math.max(
                roadWidth,
                canvas === miniCanvas
                    ? 2
                    : 3
            );


        ctx.lineCap =
            "round";


        ctx.lineJoin =
            "round";


        ctx.stroke();
    }


    // --------------------------------------------------------
    // JOUEUR
    // --------------------------------------------------------

    if (player) {

        const x =
            centerX +
            player.position.x *
            scale;


        const y =
            centerY +
            player.position.z *
            scale;


        const radius =
            canvas === miniCanvas
                ? 6
                : 10;


        ctx.beginPath();


        ctx.arc(
            x,
            y,
            radius,
            0,
            Math.PI * 2
        );


        ctx.fillStyle =
            "#e51c23";


        ctx.fill();


        ctx.beginPath();


        ctx.moveTo(
            x,
            y
        );


        ctx.lineTo(

            x +
            Math.sin(
                player.rotation.y
            ) *
            18,

            y +
            Math.cos(
                player.rotation.y
            ) *
            18

        );


        ctx.strokeStyle =
            "#e51c23";


        ctx.lineWidth =
            3;


        ctx.stroke();
    }
}


// ============================================================
// OUVRIR CARTE
// ============================================================

function openFullMap() {

    if (!gameStarted)
        return;


    fullMap.style.display =
        "block";


    resizeMaps();


    drawFullMap();
}


const closeMap =
    document.getElementById(
        "closeMap"
    );


if (closeMap) {

    closeMap.addEventListener(
        "click",
        () => {

            fullMap.style.display =
                "none";

        }
    );
}


// ============================================================
// PINCH ZOOM
// ============================================================

function getTouchDistance(
    touch1,
    touch2
) {

    const dx =
        touch2.clientX -
        touch1.clientX;


    const dy =
        touch2.clientY -
        touch1.clientY;


    return Math.sqrt(
        dx * dx +
        dy * dy
    );
}


fullCanvas.addEventListener(
    "touchstart",
    event => {

        event.preventDefault();


        if (
            event.touches.length === 1
        ) {

            mapDragging =
                true;


            mapLastX =
                event.touches[0].clientX;


            mapLastY =
                event.touches[0].clientY;
        }


        if (
            event.touches.length === 2
        ) {

            mapDragging =
                false;


            mapPinching =
                true;


            mapStartDistance =
                getTouchDistance(
                    event.touches[0],
                    event.touches[1]
                );


            mapStartZoom =
                mapZoom;
        }

    },
    {
        passive: false
    }
);


// ============================================================
// MOUVEMENT CARTE
// ============================================================

fullCanvas.addEventListener(
    "touchmove",
    event => {

        event.preventDefault();


        if (
            event.touches.length === 1 &&
            mapDragging
        ) {

            const x =
                event.touches[0].clientX;


            const y =
                event.touches[0].clientY;


            mapOffsetX +=
                x - mapLastX;


            mapOffsetY +=
                y - mapLastY;


            mapLastX =
                x;


            mapLastY =
                y;


            drawFullMap();
        }


        if (
            event.touches.length === 2 &&
            mapPinching
        ) {

            const distance =
                getTouchDistance(
                    event.touches[0],
                    event.touches[1]
                );


            const ratio =
                distance /
                mapStartDistance;


            mapZoom =
                mapStartZoom *
                ratio;


            mapZoom =
                Math.max(
                    0.005,
                    Math.min(
                        mapZoom,
                        0.5
                    )
                );


            drawFullMap();
        }

    },
    {
        passive: false
    }
);


// ============================================================
// FIN TOUCH CARTE
// ============================================================

fullCanvas.addEventListener(
    "touchend",
    event => {

        if (
            event.touches.length === 0
        ) {

            mapDragging =
                false;

            mapPinching =
                false;
        }


        if (
            event.touches.length === 1
        ) {

            mapPinching =
                false;


            mapDragging =
                true;


            mapLastX =
                event.touches[0].clientX;


            mapLastY =
                event.touches[0].clientY;
        }

    },
    {
        passive: false
    }
);


// ============================================================
// MULTIJOUEUR
// ============================================================

const multiMenu =
    document.getElementById(
        "multiMenu"
    );


if (multiMenu) {

    multiMenu.addEventListener(
        "click",
        () => {

            multi.style.display =
                "flex";

        }
    );
}


const closeMulti =
    document.getElementById(
        "closeMulti"
    );


if (closeMulti) {

    closeMulti.addEventListener(
        "click",
        () => {

            multi.style.display =
                "none";

        }
    );
}


const createRoom =
    document.getElementById(
        "createRoom"
    );


if (createRoom) {

    createRoom.addEventListener(
        "click",
        () => {

            const name =
                document.getElementById(
                    "playerName"
                ).value.trim();


            const code =
                Math.random()
                .toString(36)
                .substring(
                    2,
                    8
                )
                .toUpperCase();


            document.getElementById(
                "roomCode"
            ).value =
                code;


            document.getElementById(
                "multiStatus"
            ).textContent =
                "🎮 Partie créée : " +
                code;


            connectMultiplayer(
                name || "Joueur",
                code
            );
        }
    );
}


const joinRoom =
    document.getElementById(
        "joinRoom"
    );


if (joinRoom) {

    joinRoom.addEventListener(
        "click",
        () => {

            const name =
                document.getElementById(
                    "playerName"
                ).value.trim();


            const code =
                document.getElementById(
                    "roomCode"
                ).value.trim();


            if (!code) {

                document.getElementById(
                    "multiStatus"
                ).textContent =
                    "❌ Entre un code.";

                return;
            }


            connectMultiplayer(
                name || "Joueur",
                code
            );
        }
    );
}


// ============================================================
// CONNEXION MULTI
// ============================================================

function connectMultiplayer(
    name,
    room
) {

    try {

        const protocol =
            location.protocol === "https:"
                ? "wss:"
                : "ws:";


        multiplayerSocket =
            new WebSocket(
                protocol +
                "//" +
                location.host
            );


        multiplayerSocket.onopen =
            () => {

                multiplayerSocket.send(
                    JSON.stringify({

                        type: "join",

                        name,

                        room

                    })
                );


                document.getElementById(
                    "multiStatus"
                ).textContent =
                    "🟢 Connecté à la partie " +
                    room;
            };


        multiplayerSocket.onmessage =
            event => {

                try {

                    const data =
                        JSON.parse(
                            event.data
                        );


                    handleMultiplayerMessage(
                        data
                    );

                } catch (error) {

                    console.warn(
                        "Message multi invalide",
                        error
                    );
                }
            };


        multiplayerSocket.onerror =
            () => {

                document.getElementById(
                    "multiStatus"
                ).textContent =
                    "⚠️ Le serveur multijoueur n'est pas configuré.";
            };


        multiplayerSocket.onclose =
            () => {

                document.getElementById(
                    "multiStatus"
                ).textContent =
                    "🔴 Déconnecté.";
            };


    } catch (error) {

        console.error(
            error
        );


        document.getElementById(
            "multiStatus"
        ).textContent =
            "⚠️ Multijoueur indisponible.";
    }
}


// ============================================================
// POSITION MULTI
// ============================================================

function sendMultiplayerPosition() {

    if (
        !multiplayerSocket ||
        multiplayerSocket.readyState !==
        WebSocket.OPEN ||
        !player
    ) {

        return;
    }


    multiplayerSocket.send(
        JSON.stringify({

            type: "position",

            x:
                player.position.x,

            z:
                player.position.z,

            rotation:
                player.rotation.y

        })
    );
}


function handleMultiplayerMessage(
    data
) {

    // Cette partie est volontairement compatible
    // avec différents serveurs WebSocket.

    if (
        data.type === "players"
    ) {

        updateOtherPlayers(
            data.players || []
        );

        return;
    }


    if (
        data.type === "player"
    ) {

        updateOtherPlayers(
            [data]
        );
    }
}


// ============================================================
// JOUEURS DISTANTS
// ============================================================

const otherPlayers =
    new Map();


function updateOtherPlayers(
    players
) {

    players.forEach(
        remote => {

            if (
                !remote.id
            ) {

                return;
            }


            let remotePlayer =
                otherPlayers.get(
                    remote.id
                );


            if (!remotePlayer) {

                remotePlayer =
                    createRemotePlayer(
                        remote.name
                    );


                otherPlayers.set(
                    remote.id,
                    remotePlayer
                );
            }


            if (
                Number.isFinite(
                    remote.x
                )
            ) {

                remotePlayer.position.x =
                    remote.x;
            }


            if (
                Number.isFinite(
                    remote.z
                )
            ) {

                remotePlayer.position.z =
                    remote.z;
            }


            if (
                Number.isFinite(
                    remote.rotation
                )
            ) {

                remotePlayer.rotation.y =
                    remote.rotation;
            }
        }
    );
}


function createRemotePlayer(
    name
) {

    const group =
        new THREE.Group();


    const body =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                2.8,
                1,
                4.8
            ),

            new THREE.MeshStandardMaterial({
                color: 0xff3030
            })

        );


    body.position.y =
        1;


    group.add(
        body
    );


    group.userData.name =
        name;


    scene.add(
        group
    );


    return group;
}


// ============================================================
// ANIMATION
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
// REDIMENSIONNEMENT
// ============================================================

window.addEventListener(
    "resize",
    () => {

        if (
            camera &&
            renderer
        ) {

            camera.aspect =
                innerWidth /
                innerHeight;


            camera.updateProjectionMatrix();


            renderer.setSize(
                innerWidth,
                innerHeight
            );
        }


        resizeMaps();


        drawMiniMap();


        if (
            fullMap.style.display ===
            "block"
        ) {

            drawFullMap();
        }
    }
);


// ============================================================
// FIN
// ============================================================
