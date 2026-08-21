// ============================================================
// ROADGAME
// Carte réelle + 3D + joystick + mini-carte + multijoueur UI
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
// ELEMENTS
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
// LANCER
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
                "Adresse ou ville introuvable."
            );
        }

        centerLat =
            Number(place.lat);

        centerLon =
            Number(place.lon);


        loadingText.textContent =
            "🛣️ Téléchargement des routes...";


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
// GÉOCODAGE
// ============================================================

async function geocode(query) {

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
// OSM
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
            "Impossible de récupérer les données de la carte."
        );
    }


    const data =
        await response.json();


    return data.elements || [];
}


// ============================================================
// THREE
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
            innerWidth / innerHeight,
            .1,
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
// GPS -> 3D
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
            (lon - centerLon)
            * metersLon,

        z:
            -(lat - centerLat)
            * metersLat
    };
}


// ============================================================
// MONDE
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

    const valid = [
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
        !valid.includes(
            way.tags.highway
        )
    ) {
        return;
    }


    let width = 5;


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
            p =>
                gpsToWorld(
                    p.lat,
                    p.lon
                )
        );


    for (
        let i=0;
        i<points.length-1;
        i++
    ) {

        createRoadSegment(
            points[i],
            points[i+1],
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
            dx*dx +
            dz*dz
        );


    if (
        length < .5
    ) {
        return;
    }


    const road =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                width,
                .12,
                length
            ),
            new THREE.MeshStandardMaterial({
                color:0x3b3b3b,
                roughness:.9
            })
        );


    road.position.set(
        (a.x+b.x)/2,
        .06,
        (a.z+b.z)/2
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


    // Ligne centrale pour améliorer
    // visuellement les grandes routes.

    if (
        width >= 8
    ) {

        const line =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    .12,
                    .02,
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
            .13;


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
            p =>
                gpsToWorld(
                    p.lat,
                    p.lon
                )
        );


    let minX=Infinity;
    let maxX=-Infinity;
    let minZ=Infinity;
    let maxZ=-Infinity;


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
        Math.min(
            maxX-minX,
            80
        );


    const depth =
        Math.min(
            maxZ-minZ,
            80
        );


    if (
        width < 2 ||
        depth < 2
    ) {
        return;
    }


    let height = 6;


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
                        levels*3,
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
                roughness:.82
            })
        );


    building.position.set(
        (minX+maxX)/2,
        height/2,
        (minZ+maxZ)/2
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
    )
        return 0x9da3a8;

    if (
        type === "commercial"
    )
        return 0xc6c6c6;

    if (
        type === "school"
    )
        return 0xe2c18f;

    if (
        type === "church"
    )
        return 0xd8d0c0;

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
                roughness:.5
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
                .7,
                2.3
            ),
            new THREE.MeshStandardMaterial({
                color:0x20252a
            })
        );


    roof.position.set(
        0,
        1.75,
        -.2
    );


    player.add(
        roof
    );


    const wheelGeometry =
        new THREE.CylinderGeometry(
            .5,
            .5,
            .38,
            16
        );


    const wheelMaterial =
        new THREE.MeshStandardMaterial({
            color:0x111111
        });


    const wheels = [
        [-1.45,.5,-1.55],
        [1.45,.5,-1.55],
        [-1.45,.5,1.55],
        [1.45,.5,1.55]
    ];


    wheels.forEach(
        p => {

            const wheel =
                new THREE.Mesh(
                    wheelGeometry,
                    wheelMaterial
                );


            wheel.rotation.z =
                Math.PI/2;


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

    if (!player)
        return;


    const distance = 13;
    const height = 7;


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
    .getElementById("cameraLeft")
    .addEventListener(
        "click",
        () => {

            cameraAngle -= .35;

            updateCamera();
        }
    );


document
    .getElementById("cameraRight")
    .addEventListener(
        "click",
        () => {

            cameraAngle += .35;

            updateCamera();
        }
    );


// ============================================================
// JOYSTICK
// ============================================================

joystick.addEventListener(
    "touchstart",
    e => {

        e.preventDefault();

        joystickActive =
            true;

        updateJoystick(
            e.touches[0]
        );
    },
    {passive:false}
);


joystick.addEventListener(
    "touchmove",
    e => {

        e.preventDefault();

        if (
            joystickActive
        ) {

            updateJoystick(
                e.touches[0]
            );
        }
    },
    {passive:false}
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
        rect.width/2;


    const centerY =
        rect.top +
        rect.height/2;


    let dx =
        touch.clientX -
        centerX;


    let dy =
        touch.clientY -
        centerY;


    const max =
        rect.width/2 -
        32;


    const length =
        Math.sqrt(
            dx*dx +
            dy*dy
        );


    if (
        length > max
    ) {

        dx =
            dx/length *
            max;

        dy =
            dy/length *
            max;
    }


    stick.style.transform =
        `translate(${dx}px,${dy}px)`;


    moveX =
        dx/max;


    moveY =
        dy/max;
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
// ROTATION AVEC LE DOIGT
// ============================================================

rendererTouchSetup();


function rendererTouchSetup() {

    document.addEventListener(
        "touchstart",
        e => {

            if (
                e.target.closest(
                    "#joystick"
                ) ||
                e.target.closest(
                    "#miniMap"
                )
            ) {
                return;
            }


            if (
                e.touches.length === 1
            ) {

                lastTouchX =
                    e.touches[0].clientX;
            }
        },
        {passive:true}
    );


    document.addEventListener(
        "touchmove",
        e => {

            if (
                e.target.closest(
                    "#joystick"
                )
            ) {
                return;
            }


            if (
                e.touches.length !== 1 ||
                lastTouchX === null
            ) {
                return;
            }


            const x =
                e.touches[0].clientX;


            const delta =
                x-lastTouchX;


            cameraAngle -=
                delta*.008;


            lastTouchX =
                x;


            updateCamera();
        },
        {passive:true}
    );


    document.addEventListener(
        "touchend",
        () => {

            lastTouchX =
                null;
        }
    );
}


// ============================================================
// DÉPLACEMENT
// ============================================================

function updatePlayer() {

    if (
        !player
    )
        return;


    if (
        Math.abs(moveX) < .05 &&
        Math.abs(moveY) < .05
    ) {
        return;
    }


    let dx =
        moveX;

    let dz =
        moveY;


    const length =
        Math.sqrt(
            dx*dx +
            dz*dz
        );


    if (
        length > 1
    ) {

        dx /= length;
        dz /= length;
    }


    // Le joystick est relatif
    // à la caméra.

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
        rightX*dx +
        forwardX*(-dz);


    const worldZ =
        rightZ*dx +
        forwardZ*(-dz);


    player.position.x +=
        worldX*speed;


    player.position.z +=
        worldZ*speed;


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
        miniCanvas.clientWidth*dpr;


    miniCanvas.height =
        miniCanvas.clientHeight*dpr;


    fullCanvas.width =
        innerWidth*dpr;


    fullCanvas.height =
        innerHeight*dpr;
}


function drawMiniMap() {

    if (
        !gameStarted
    )
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


function drawMap(
    canvas
) {

    const ctx =
        canvas.getContext("2d");


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


    const scale =
        canvas === miniCanvas
            ? 0.20
            : 0.055;


    const centerX =
        width/2;


    const centerY =
        height/2;


    for (
        const element of worldData
    ) {

        if (
            !element.geometry
        )
            continue;


        const isRoad =
            element.tags &&
            element.tags.highway;


        const isBuilding =
            element.tags &&
            element.tags.building;


        if (
            !isRoad &&
            !isBuilding
        )
            continue;


        const points =
            element.geometry.map(
                p =>
                    gpsToWorld(
                        p.lat,
                        p.lon
                    )
            );


        if (
            points.length < 2
        )
            continue;


        if (isRoad) {

            ctx.strokeStyle =
                "#777";


            ctx.lineWidth =
                canvas === miniCanvas
                    ? 2
                    : 4;


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
            (p,i) => {

                const x =
                    centerX +
                    p.x*scale;


                const y =
                    centerY +
                    p.z*scale;


                if (i===0)
                    ctx.moveTo(
                        x,
                        y
                    );
                else
                    ctx.lineTo(
                        x,
                        y
                    );
            }
        );


        if (isBuilding) {

            ctx.closePath();

            ctx.fill();

        } else {

            ctx.stroke();
        }
    }


    // Joueur

    if (player) {

        const x =
            centerX +
            player.position.x*
            scale;


        const y =
            centerY +
            player.position.z*
            scale;


        ctx.beginPath();

        ctx.arc(
            x,
            y,
            canvas === miniCanvas
                ? 6
                : 10,
            0,
            Math.PI*2
        );


        ctx.fillStyle =
            "#e51c23";


        ctx.fill();


        // Direction

        ctx.beginPath();

        ctx.moveTo(
            x,
            y
        );


        ctx.lineTo(
            x +
            Math.sin(
                player.rotation.y
            )*
            18,
            y +
            Math.cos(
                player.rotation.y
            )*
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
// CARTE PLEIN ÉCRAN
// ============================================================

function openFullMap() {

    if (
        !gameStarted
    )
        return;


    fullMap.style.display =
        "block";


    resizeMaps();

    drawFullMap();
}


document
    .getElementById("closeMap")
    .addEventListener(
        "click",
        () => {

            fullMap.style.display =
                "none";
        }
    );


// ============================================================
// MULTI
// ============================================================

document
    .getElementById("multiMenu")
    .addEventListener(
        "click",
        () => {

            multi.style.display =
                "flex";
        }
    );


document
    .getElementById("closeMulti")
    .addEventListener(
        "click",
        () => {

            multi.style.display =
                "none";
        }
    );


document
    .getElementById("createRoom")
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
    .getElementById("joinRoom")
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

    /*
     * Cette partie prépare la connexion.
     *
     * Elle fonctionne seulement si
     * ton server.js possède un serveur
     * WebSocket compatible.
     */

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
                    "⚠️ Le serveur multijoueur n'est pas encore configuré.";
            };


        multiplayerSocket.onclose =
            () => {

                console.log(
                    "Connexion multijoueur fermée."
                );
            };


    } catch(error) {

        console.error(error);

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
// RESIZE
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


        if (
            fullMap.style.display ===
            "block"
        ) {

            drawFullMap();
        }


        drawMiniMap();
    }
);
