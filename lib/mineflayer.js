const { preNettyVersionsByProtocolVersion } = require('minecraft-data')
const { Vec3 } = require('vec3')
const { spiral, ViewRect, chunkPos } = require('./utils')

module.exports = (bot, { viewDistance = 6, firstPerson = false, port = 3000 }) => {
  const express = require('express')

  const app = express()
  const http = require('http').createServer(app)

  const io = require('socket.io')(http)

  const { setupRoutes } = require('./common')
  setupRoutes(app, bot.version)

  const sockets = []
  const primitives = {}

  bot.viewer = {}

  bot.viewer.erase = (id) => {
    delete primitives[id]
    for (const socket of sockets) {
      socket.emit('primitive', { id })
    }
  }

  bot.viewer.drawLine = (id, points, color = 0xff0000) => {
    primitives[id] = { type: 'line', id, points, color }
    for (const socket of sockets) {
      socket.emit('primitive', primitives[id])
    }
  }
  io.on('connection', (socket) => {
    socket.emit('version', bot.version)
    sockets.push(socket)

    const loadedChunks = {}
    var state;
    var movement;
    socket.on('move', (msg) => {
      console.log(msg)
      state = msg.split("_")[0]
      movement = msg.split("_")[1]
      console.log(msg.split("_"))
      console.log(movement)
      if (movement == "jump") {
        bot.setControlState('jump', true);
        bot.setControlState('jump', false);
      }
      else if (state == "down") {
        bot.setControlState(movement, true);
      }
      else {
        bot.setControlState(movement, false);
      }
      console.log(msg)
    });

    const [botX, botZ] = chunkPos(bot.entity.position)
    spiral(viewDistance * 2, viewDistance * 2, (x, z) => {
      loadChunk(new Vec3((botX + x) * 16, 0, (botZ + z) * 16))
    })

    for (const e in bot.entities) {
      if (bot.entities[e] !== bot.entity) {
        createEntity(bot.entities[e])
      }
    }

    for (const id in primitives) {
      socket.emit('primitive', primitives[id])
    }

    function loadChunk(pos) {
      const [botX, botZ] = chunkPos(bot.entity.position)
      const dx = Math.abs(botX - Math.floor(pos.x / 16))
      const dz = Math.abs(botZ - Math.floor(pos.z / 16))
      if (dx < viewDistance && dz < viewDistance) {
        const column = bot.world.getColumnAt(pos)
        if (column) {
          const chunk = column.toJson()
          const coords = pos.x + ',' + pos.z
          socket.emit('chunk', { coords, chunk })
          loadedChunks[coords] = true
        }
      }
    }

    function unloadChunk(pos) {
      socket.emit('unloadChunk', { x: pos.x, z: pos.z })
      delete loadedChunks[`${pos.x},${pos.z}`]
    }

    const lastPos = new Vec3(0, 0, 0).update(bot.entity.position)
    function botPosition() {
      const packet = { pos: bot.entity.position, addMesh: true }
      if (firstPerson) {
        packet.yaw = bot.entity.yaw
        packet.pitch = bot.entity.pitch
      }
      socket.emit('position', packet)
      const [lastX, lastZ] = chunkPos(lastPos)
      const [botX, botZ] = chunkPos(bot.entity.position)
      if (lastX !== botX || lastZ !== botZ) {
        const newView = new ViewRect(botX, botZ, viewDistance)
        for (const coords of Object.keys(loadedChunks)) {
          const x = parseInt(coords.split(',')[0])
          const z = parseInt(coords.split(',')[1])
          const p = new Vec3(x, 0, z)
          if (!newView.contains(Math.floor(x / 16), Math.floor(z / 16))) {
            unloadChunk(p)
          }
        }
        spiral(viewDistance * 2, viewDistance * 2, (x, z) => {
          const p = new Vec3((botX + x) * 16, 0, (botZ + z) * 16)
          if (!loadedChunks[`${p.x},${p.z}`]) {
            loadChunk(p)
          }
        })
      }
      lastPos.update(bot.entity.position)
    }

    function createEntity(e) {
      socket.emit('entity', { id: e.id, type: e.type, pos: e.position })
    }

    function updateEntity(e) {
      socket.emit('entity', { id: e.id, pos: e.position })
    }

    function removeEntity(e) {
      socket.emit('entity', { id: e.id, delete: true })
    }

    function blockUpdate(oldBlock, newBlock) {
      const stateId = newBlock.stateId ? newBlock.stateId : ((newBlock.type << 4) | newBlock.metadata)
      socket.emit('blockUpdate', { pos: oldBlock.position, stateId })
    }

    bot.on('move', botPosition)
    bot.on('entitySpawn', createEntity)
    bot.on('entityMoved', updateEntity)
    bot.on('entityGone', removeEntity)
    bot.on('chunkColumnLoad', loadChunk)
    bot.on('blockUpdate', blockUpdate)

    socket.on('disconnect', () => {
      bot.removeListener('move', botPosition)
      bot.removeListener('entitySpawn', createEntity)
      bot.removeListener('entityMoved', updateEntity)
      bot.removeListener('entityGone', removeEntity)
      bot.removeListener('chunkColumnLoad', loadChunk)
      bot.removeListener('blockUpdate', blockUpdate)
      sockets.splice(sockets.indexOf(socket), 1)
    })
  })

  http.listen(port, () => {
    console.log(`Prismarine viewer web server running on *:${port}`)
  })
}
