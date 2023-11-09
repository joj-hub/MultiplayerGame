const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')

const socket = io()

const scoreEl = document.querySelector('#scoreEl')

const devicePixelRatio = window.devicePixelRatio || 1

canvas.width = 1024 * devicePixelRatio
canvas.height = 576 * devicePixelRatio

c.scale(devicePixelRatio, devicePixelRatio)

const frontEndPlayers = {}
const frontEndProjectiles = {}
const particles = []

socket.on("particleExplosion", ({x, y, size, color}) => {

  for (let i = 0; i < size; i++) {
    particles.push(new Particle(x, y, Math.random() * 2, color, {x: (Math.random() - 0.5) * (Math.random() * 8), y: (Math.random() - 0.5) * (Math.random() * 8)}))
  }

})

socket.on("updateProjectiles", (backEndProjectiles) => {
  for (const id in backEndProjectiles) {
    const backEndProjectile = backEndProjectiles[id]

    if (!frontEndProjectiles[id]) {
      frontEndProjectiles[id] = new Projectile({x: backEndProjectile.x, y: backEndProjectile.y, radius: 5, color: frontEndPlayers[backEndProjectile.playerId]?.color, velocity: backEndProjectile.velocity})
    } else {
      frontEndProjectiles[id].x += backEndProjectiles[id].velocity.x
      frontEndProjectiles[id].y += backEndProjectiles[id].velocity.y
    }
  }

  for (const frontEndProjectileId in frontEndProjectiles) {
    if (!backEndProjectiles[frontEndProjectileId]) {
      
      delete frontEndProjectiles[frontEndProjectileId]
    }
  }
})

socket.on("updatePlayers", (backEndPlayers) => {
  for (const id in backEndPlayers) {
    const backEndPlayer = backEndPlayers[id]

    if (!frontEndPlayers[id]) {
      frontEndPlayers[id] = new Player({x: backEndPlayer.x, y:backEndPlayer.y, radius: 10, color: backEndPlayer.color, username: backEndPlayer.username, cooldownTimer: backEndPlayer.cooldownTimer})

      document.querySelector("#playerLabels").innerHTML += `<div data-id="${id}" data-score="${backEndPlayer.score}"> ${backEndPlayer.username}: ${backEndPlayer.score}</div>`

    } else {
      document.querySelector(`div[data-id="${id}"]`).innerHTML = `${backEndPlayer.username}: ${backEndPlayer.score}`
      document.querySelector(`div[data-id="${id}"]`).setAttribute("data-score", backEndPlayer.score)

      const parentDiv = document.querySelector("#playerLabels")
      const childDivs = Array.from(parentDiv.querySelectorAll("div"))

      childDivs.sort((a, b) => {
        const scoreA = Number(a.getAttribute("data-score"))
        const scoreB = Number(b.getAttribute("data-score"))

        return scoreB - scoreA
      })

      childDivs.forEach(div => {
        parentDiv.removeChild(div)
      })

      childDivs.forEach(div => {
        parentDiv.appendChild(div)
      })

      frontEndPlayers[id].target = {
        x: backEndPlayer.x,
        y: backEndPlayer.y
      }

      if (id === socket.id) {
        frontEndPlayers[socket.id].cooldownTimer = backEndPlayer.cooldownTimer
        
        const lastBackendInputIndex = playerInputs.findIndex((input) => {

          return backEndPlayer.sequenceNumber === input.sequenceNumber

        })

        if (lastBackendInputIndex > -1) {
          playerInputs.splice(0, lastBackendInputIndex + 1)
        }
        
        playerInputs.forEach((input) => {
          frontEndPlayers[id].target.x += input.dx
          frontEndPlayers[id].target.y += input.dy
        })

      }
    }
  }

  for (const id in frontEndPlayers) {
    if (!backEndPlayers[id]) {
      const divToDelete = document.querySelector(`div[data-id="${id}"]`)
      divToDelete.parentNode.removeChild(divToDelete)

      if (id == socket.id) {
        document.querySelector("#usernameForm").style.display = "block"
      }

      delete frontEndPlayers[id]
    }
  }


})

let animationId
function animate() {
  animationId = requestAnimationFrame(animate)
  c.clearRect(0, 0, canvas.width, canvas.height)

  for (const id in frontEndPlayers) {
    const frontEndPlayer = frontEndPlayers[id]

    if (frontEndPlayer.target) {
      frontEndPlayers[id].x += (frontEndPlayers[id].target.x - frontEndPlayers[id].x) * 0.5

      frontEndPlayers[id].y += (frontEndPlayers[id].target.y - frontEndPlayers[id].y) * 0.5
    }

    const playerSides = {
      left: frontEndPlayers[id].x - frontEndPlayers[id].radius,
      right: frontEndPlayers[id].x + frontEndPlayers[id].radius,
      top: frontEndPlayers[id].y - frontEndPlayers[id].radius,
      bottom: frontEndPlayers[id].y + frontEndPlayers[id].radius,
    }

    if (playerSides.left < 0) frontEndPlayers[id].x = frontEndPlayers[id].radius
    if (playerSides.right > 1024) frontEndPlayers[id].x = 1024 - frontEndPlayers[id].radius

    if (playerSides.top < 0) frontEndPlayers[id].y = frontEndPlayers[id].radius
    if (playerSides.bottom > 576) frontEndPlayers[id].y = 576 - frontEndPlayers[id].radius

    frontEndPlayer.draw()
  }

  for (const id in frontEndProjectiles) {
    const frontEndProjectile = frontEndProjectiles[id]
    frontEndProjectile.draw()
  }

  for (let index = particles.length - 1; index >= 0; index--) {
    const particle = particles[index]
    if (particle.alpha <= 0) {
        particles.splice(index, 1)
    } else particle.update() 
  }

  //for (let i = frontEndProjectiles.length - 1; i >= 0; i--) {
    //const frontEndProjectile = frontEndProjectiles[i]
    //frontEndProjectile.update()
  //}
}

animate()

const keys = {
  w: {
    pressed: false
  },
  a: {
    pressed: false
  },
  s: {
    pressed: false
  },
  d: {
    pressed: false
  }


}

const SPEED = 5
const playerInputs = []
let sequenceNumber = 0

setInterval(() => {
  if (keys.w.pressed) {
    sequenceNumber++
    playerInputs.push({sequenceNumber, dx: 0, dy: -SPEED})
    frontEndPlayers[socket.id].y -= SPEED
    socket.emit("keydown", {keycode: "KeyW", sequenceNumber})
  }
  if (keys.a.pressed) {
    sequenceNumber++
    playerInputs.push({sequenceNumber, dx: -SPEED, dy: 0})
    frontEndPlayers[socket.id].x -= SPEED
    socket.emit("keydown", {keycode: "KeyA", sequenceNumber})
  }
  if (keys.s.pressed) {
    sequenceNumber++
    playerInputs.push({sequenceNumber, dx: 0, dy: SPEED})
    frontEndPlayers[socket.id].y += SPEED
    socket.emit("keydown", {keycode: "KeyS", sequenceNumber})
  }
  if (keys.d.pressed) {
    sequenceNumber++
    playerInputs.push({sequenceNumber, dx: SPEED, dy: 0})
    frontEndPlayers[socket.id].x += SPEED
    socket.emit("keydown", {keycode: "KeyD", sequenceNumber})
  }
  
  
}, 15);

window.addEventListener("keydown", (event) => {
  if (!frontEndPlayers[socket.id]) return

  switch(event.code) {
    case "KeyW":
      keys.w.pressed = true
      break

    case "KeyA":
      keys.a.pressed = true
      break
    
    case "KeyS":
      keys.s.pressed = true
      break

    case "KeyD":
      keys.d.pressed = true
      break
  }
})

window.addEventListener("keyup", (event) => {
  if (!frontEndPlayers[socket.id]) return

  switch(event.code) {
    case "KeyW":
      keys.w.pressed = false
      break

    case "KeyA":
      keys.a.pressed = false
      break
    
    case "KeyS":
      keys.s.pressed = false
      break

    case "KeyD":
      keys.d.pressed = false
      break
  }
  
})

document.querySelector("#usernameForm").addEventListener("submit", (event) => {
  event.preventDefault()
  document.querySelector("#usernameForm").style.display = "none"
  socket.emit("initGame", {username: document.querySelector("#usernameInput").value, width: canvas.width, height: canvas.height, devicePixelRatio})
})
