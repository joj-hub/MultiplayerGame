const express = require('express')
const app = express()

// socket.io setup
const http = require("http")
const server = http.createServer(app)
const { Server } = require("socket.io")
const io = new Server(server, { pingInterval: 2000, pingTimeout: 5000 })

const port = 3000

app.use(express.static('public'))

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html')
})

const backEndPlayers = {}
const backEndProjectiles = {}

const SPEED = 5
const RADIUS = 10
const PROJECTILE_RADIUS = 5
let projectileId = 0

io.on('connection', (socket) => {
  console.log('a user connected');

  io.emit("updatePlayers", backEndPlayers)

  socket.on("shoot", ({x, y, angle}) => {
    if (backEndPlayers[socket.id].cooldownTimer > 0) return 

    backEndPlayers[socket.id].cooldownTimer = 10

    projectileId++;

    const velocity = {
      x: Math.cos(angle) * 5,
      y: Math.sin(angle) * 5
    }

    backEndProjectiles[projectileId] = {
      x, 
      y, 
      velocity,
      playerId: socket.id,
    }
  })

  socket.on("initGame", ({ username, width, height}) => {
    backEndPlayers[socket.id] = {
      x: 1024 * Math.random(),
      y: 576 * Math.random(),
      color: `hsl(${360 * Math.random()}, 100%, 50%)`,
      sequenceNumber: 0,
      score: 0,
      username,
      cooldownTimer: 0,
    }

    backEndPlayers[socket.id].canvas = {
      width,
      height
    }

    backEndPlayers[socket.id].radius = RADIUS
  })

  socket.on("disconnect", (reason) => {
    console.log(reason)
    delete backEndPlayers[socket.id]
    io.emit("updatePlayers", backEndPlayers)
  })

  socket.on("keydown", ({ keycode, sequenceNumber }) => {
    const backEndPlayer = backEndPlayers[socket.id]

    if (!backEndPlayers[socket.id]) return
    
    backEndPlayers[socket.id].sequenceNumber = sequenceNumber

    const playerSides = {
      left: backEndPlayer.x - backEndPlayer.radius,
      right: backEndPlayer.x + backEndPlayer.radius,
      top: backEndPlayer.y - backEndPlayer.radius,
      bottom: backEndPlayer.y + backEndPlayer.radius,
    }

    switch(keycode) {
      case "KeyW":
        if (playerSides.top - SPEED < 0) {
          backEndPlayers[socket.id].y = backEndPlayer.radius
        } else backEndPlayers[socket.id].y -= SPEED
        break
  
      case "KeyA":
        if (playerSides.left - SPEED < 0) {
          backEndPlayers[socket.id].x = backEndPlayer.radius
        } else backEndPlayers[socket.id].x -= SPEED
        break
      
      case "KeyS":
        if (playerSides.bottom + SPEED > 576) {
          backEndPlayers[socket.id].y = 576 - backEndPlayer.radius
        } else backEndPlayers[socket.id].y += SPEED
        break
  
      case "KeyD":
        if (playerSides.right + SPEED > 1024) {
          backEndPlayers[socket.id].x = 1024 - backEndPlayer.radius
        } else backEndPlayers[socket.id].x += SPEED
        break
    }

    
    //if (playerSides.left < 0) backEndPlayers[socket.id].x = backEndPlayer.radius
    //if (playerSides.right > 1024) backEndPlayers[socket.id].x = 1024 - backEndPlayer.radius

    //if (playerSides.top < 0) backEndPlayers[socket.id].y = backEndPlayer.radius
    //if (playerSides.bottom > 576) backEndPlayers[socket.id].y = 576 - backEndPlayer.radius


  })

  console.log(backEndPlayers)
})

setInterval(() => {

  for (const id in backEndProjectiles) {
    backEndProjectiles[id].x += backEndProjectiles[id].velocity.x
    backEndProjectiles[id].y += backEndProjectiles[id].velocity.y

    if (backEndProjectiles[id].x - PROJECTILE_RADIUS >= backEndPlayers[backEndProjectiles[id].playerId]?.canvas?.width ||
      backEndProjectiles[id].x + PROJECTILE_RADIUS <= 0 ||
      backEndProjectiles[id].y - PROJECTILE_RADIUS >= backEndPlayers[backEndProjectiles[id].playerId]?.canvas?.height ||
      backEndProjectiles[id].y + PROJECTILE_RADIUS <= 0) {
      delete backEndProjectiles[id] 
      continue;
    }

    for (const playerId in backEndPlayers) {
      const backEndPlayer = backEndPlayers[playerId]

      const DISTANCE = Math.hypot(backEndProjectiles[id].x - backEndPlayer.x, backEndProjectiles[id].y - backEndPlayer.y)

      if (DISTANCE < PROJECTILE_RADIUS + backEndPlayer.radius && backEndProjectiles[id].playerId !== playerId) {
        if (backEndPlayers[backEndProjectiles[id].playerId]) backEndPlayers[backEndProjectiles[id].playerId].score++;
        io.emit("particleExplosion", {x: backEndPlayer.x, y: backEndPlayer.y, size: 50, color: backEndPlayer.color})
        delete backEndProjectiles[id]
        delete backEndPlayers[playerId]
        break
      }
    }
  }

  for (const playerId in backEndPlayers) {
    if (backEndPlayers[playerId]) backEndPlayers[playerId].cooldownTimer--
  }

  io.emit("updateProjectiles", backEndProjectiles)
  io.emit("updatePlayers", backEndPlayers)
}, 15)

server.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

