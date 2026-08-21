// ============================================================
// ROADGAME - GAME.JS
// Carte réelle + monde 3D + joystick + caméra + carte zoomable
// ============================================================

const NOMINATIM =
    "https://nominatim.openstreetmap.org/search";

const OVERPASS =
    "https://overpass-api.de/api/interpreter";

let scene;
let camera;
let renderer;
let player;

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
            "🛣️ Recherche des routes et bâtiments...";


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


        document.getElementById(
            "cameraButtons"
        ).style.display =
            "block";


        document.getElementById(
            "vehiclePanel"
        ).style.display =
            "block";


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
// RECHERCHE DE L'ADRESSE
// ============================================================

async function geocode(query) {

    const url =
        NOMINATIM +
        "?format=jsonv2" +
        "&limit=1" +
        "&q=" +
        encodeURIComponent(query);


    const response =
        await fetch(url);


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
// RÉCUPÉRER LES DONNÉES OPENSTREETMAP
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
[out:json][timeout:40];
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
                method:"POST",

                headers:{
                    "Content-Type":
                        "text/plain"
                },

                body:query
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
            0x75bff0
        );


    scene.fog =
        new THREE.Fog(
            0x75bff0,
            250,
            1400
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
            antialias:true
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


    scene.add(
        sun
    );
}


// ============================================================
// GPS -> COORDONNÉES 3D
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
// CONSTRUIRE LE MONDE
// ============================================================

function buildWorld(
    elements
) {

    const ground =
        new THREE.Mesh(
            new THREE.PlaneGeometry(
                2500,
                2500
            ),

            new THREE.MeshStandardMaterial({
                color:0x5b9b52,
                roughness:1
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

            width =
                12;

            break;


        case "primary":

            width =
                9;

            break;


        case "secondary":

            width =
                8;

            break;


        case "tertiary":

            width =
                7;

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
                color:0x3b3b3b,
                roughness:0.9
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
                    color:0xffffff
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
// BÂTIMENTS
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


    const width =
        Math.min(
            maxX - minX,
            80
        );


    const depth =
        Math.min(
            maxZ - minZ,
            80
        );


    if (
        width < 2 ||
        depth < 2
    ) {

        return;
    }


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


    const building =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                width,
                height,
                depth
            ),

            new THREE.MeshStandardMaterial({
                color:
                    buildingColor(
                        way.tags.building
                    ),

                roughness:0.82
            })
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
                color:0x1264ff,
                roughness:0.5
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
                color:0x20252a
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
            color:0x111111
        });


    const wheels = [

        [-1.45,0.5,-1.55],
        [1.45,0.5,-1.55],
        [-1.45,0.5,1.55],
        [1.45,0.5,1.55]

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


document
    .getElementById(
        "cameraLeft"
    )
    .addEventListener(
        "click",
        () => {

            cameraAngle -=
                0.35;


            updateCamera();
        }
    );


document
    .getElementById(
        "cameraRight"
    )
    .addEventListener(
        "click",
        () => {

            cameraAngle +=
                0.35;


            updateCamera();
        }
    );


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
        passive:false
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
        passive:false
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
// CAMERA AU DOIGT
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
        passive:true
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
        passive:true
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


    player.position.x +=
        worldX * speed;


    player.position.z +=
        worldZ * speed;


    player.rotation.y =
        Math.atan2(
            worldX,
            worldZ
        );


    updateCamera();

    drawMiniMap();
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
// DESSIN DE LA CARTE
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


    ctx.fillStyle =
        "#d8d3c8";


    ctx.fillRect(
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

    } else {

        scale =
            mapZoom;


        centerX +=
            mapOffsetX;


        centerY +=
            mapOffsetY;
    }


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


        const isBuilding =
            element.tags &&
            element.tags.building;


        if (
            !isRoad &&
            !isBuilding
        ) {

            continue;
        }


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


        if (isRoad) {

            ctx.strokeStyle =
                "#777";


            ctx.lineWidth =
                canvas === miniCanvas
                    ? 2
                    : Math.max(
                        2,
                        5 / mapZoom
                    );


        } else {

            ctx.strokeStyle =
                "#aaa";


            ctx.fillStyle =
                "#c8c1b5";


            ctx.lineWidth =
                1;
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


        if (isBuilding) {

            ctx.closePath();

            ctx.fill();

            ctx.stroke();

        } else {

            ctx.stroke();
        }
    }


    // ========================================================
    // POSITION DU JOUEUR
    // ========================================================

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


        // Direction du véhicule

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
// OUVRIR LA CARTE
// ============================================================

function openFullMap() {

    if (!gameStarted)
        return;


    fullMap.style.display =
        "block";


    resizeMaps();


    drawFullMap();
}


document
    .getElementById(
        "closeMap"
    )
    .addEventListener(
        "click",
        () => {

            fullMap.style.display =
                "none";
        }
    );


// ============================================================
// ZOOM CARTE - 2 DOIGTS
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


        // --------------------------------
        // 1 DOIGT
        // --------------------------------

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


        // --------------------------------
        // 2 DOIGTS
        // --------------------------------

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
        passive:false
    }
);


// ============================================================
// MOUVEMENT SUR LA CARTE
// ============================================================

fullCanvas.addEventListener(
    "touchmove",
    event => {

        event.preventDefault();


        // --------------------------------
        // DÉPLACEMENT
        // --------------------------------

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


        // --------------------------------
        // PINCH ZOOM
        // --------------------------------

        if (
            event.touches.length === 2 &&
            mapPinching
        ) {

            const distance =
                getTouchDistance(
                    event.touches[0],
                    event.touches[1]
                );


            const difference =
                distance -
                mapStartDistance;


            mapZoom =
                mapStartZoom +
                difference *
                0.00015;


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
        passive:false
    }
);


// ============================================================
// FIN DU TOUCHER
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
        passive:false
    }
);


// ============================================================
// MULTIJOUEUR
// ============================================================

document
    .getElementById(
        "multiMenu"
    )
    .addEventListener(
        "click",
        () => {

            multi.style.display =
                "flex";
        }
    );


document
    .getElementById(
        "closeMulti"
    )
    .addEventListener(
        "click",
        () => {

            multi.style.display =
                "none";
        }
    );


document
    .getElementById(
        "createRoom"
    )
    .addEventListener(
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


document
    .getElementById(
        "joinRoom"
    )
    .addEventListener(
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

                        type:"join",

                        name:name,

                        room:room

                    })
                );


                document.getElementById(
                    "multiStatus"
                ).textContent =
                    "🟢 Connecté à la partie " +
                    room;
            };


        multiplayerSocket.onerror =
            () => {

                document.getElementById(
                    "multiStatus"
                ).textContent =
                    "⚠️ Le serveur multijoueur n'est pas configuré.";
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

        if (camera) {

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
