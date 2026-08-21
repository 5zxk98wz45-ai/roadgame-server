const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/plain"
    });

    res.end("RoadGame Multiplayer Server OK");
});

const wss = new WebSocket.Server({
    server: server
});

const rooms = new Map();

function send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

function broadcast(room, data, except = null) {
    for (const player of room.players.values()) {
        if (player.ws !== except) {
            send(player.ws, data);
        }
    }
}

function makeRoomCode() {
    return Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();
}

function makePlayer(data, ws) {
    return {
        id: Math.random()
            .toString(36)
            .substring(2, 10),

        name: data.name || "Joueur",

        vehicle: data.vehicle || "walk",

        latitude: Number(data.latitude) || 48.8566,

        longitude: Number(data.longitude) || 2.3522,

        rotation: Number(data.rotation) || 0,

        ws: ws
    };
}

function playerInfo(player) {
    return {
        id: player.id,
        name: player.name,
        vehicle: player.vehicle,
        latitude: player.latitude,
        longitude: player.longitude,
        rotation: player.rotation
    };
}

wss.on("connection", (ws) => {

    console.log("Nouveau joueur connecté");

    ws.player = null;
    ws.room = null;

    send(ws, {
        type: "connected"
    });

    ws.on("message", (message) => {

        let data;

        try {
            data = JSON.parse(message.toString());
        } catch {
            send(ws, {
                type: "error",
                message: "Message invalide"
            });
            return;
        }

        // =========================
        // CRÉER UNE PARTIE
        // =========================

        if (data.type === "create_room") {

            if (ws.room) return;

            const code = makeRoomCode();

            const player =
                makePlayer(data, ws);

            const room = {
                code: code,
                players: new Map()
            };

            room.players.set(
                player.id,
                player
            );

            rooms.set(code, room);

            ws.player = player;
            ws.room = room;

            send(ws, {
                type: "room_created",
                room: code,
                playerId: player.id,
                players: [
                    playerInfo(player)
                ]
            });

            console.log(
                "Partie créée : " + code
            );

            return;
        }

        // =========================
        // REJOINDRE UNE PARTIE
        // =========================

        if (data.type === "join_room") {

            if (ws.room) return;

            const code =
                String(data.room || "")
                    .trim()
                    .toUpperCase();

            const room =
                rooms.get(code);

            if (!room) {

                send(ws, {
                    type: "error",
                    message: "Partie introuvable"
                });

                return;
            }

            const player =
                makePlayer(data, ws);

            const oldPlayers =
                [...room.players.values()]
                    .map(playerInfo);

            room.players.set(
                player.id,
                player
            );

            ws.player = player;
            ws.room = room;

            send(ws, {
                type: "room_joined",
                room: code,
                playerId: player.id,
                players: [
                    ...oldPlayers,
                    playerInfo(player)
                ]
            });

            broadcast(
                room,
                {
                    type: "player_joined",
                    player: playerInfo(player)
                },
                ws
            );

            return;
        }

        // =========================
        // POSITION
        // =========================

        if (data.type === "player_update") {

            if (!ws.player || !ws.room) {
                return;
            }

            if (typeof data.latitude === "number") {
                ws.player.latitude =
                    data.latitude;
            }

            if (typeof data.longitude === "number") {
                ws.player.longitude =
                    data.longitude;
            }

            if (typeof data.rotation === "number") {
                ws.player.rotation =
                    data.rotation;
            }

            broadcast(
                ws.room,
                {
                    type: "player_update",
                    player: playerInfo(ws.player)
                },
                ws
            );

            return;
        }

        // =========================
        // CHANGEMENT DE VÉHICULE
        // =========================

        if (data.type === "vehicle_update") {

            if (!ws.player || !ws.room) {
                return;
            }

            ws.player.vehicle =
                data.vehicle || "walk";

            broadcast(
                ws.room,
                {
                    type: "vehicle_update",
                    playerId: ws.player.id,
                    vehicle: ws.player.vehicle
                },
                ws
            );

            return;
        }

    });

    // =========================
    // DÉCONNEXION
    // =========================

    ws.on("close", () => {

        if (!ws.player || !ws.room) {
            return;
        }

        const room = ws.room;
        const player = ws.player;

        room.players.delete(
            player.id
        );

        broadcast(
            room,
            {
                type: "player_left",
                playerId: player.id
            }
        );

        if (room.players.size === 0) {
            rooms.delete(room.code);
        }

        console.log(
            player.name +
            " a quitté " +
            room.code
        );
    });

});

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "RoadGame server lancé sur le port " +
            PORT
        );

    }
);
