/* global XMLHttpRequest THREE */

global.THREE = require('three')
require('three/examples/js/controls/OrbitControls')

const { WorldRenderer } = require('./worldrenderer')
const { Entities } = require('./entities')
const { Primitives } = require('./primitives')
const Vec3 = require('vec3').Vec3

const io = require('socket.io-client')
const socket = io()

function getJSON(url, callback) {
  const xhr = new XMLHttpRequest()
  xhr.open('GET', url, true)
  xhr.responseType = 'json'
  xhr.onload = function () {
    const status = xhr.status
    if (status === 200) {
      callback(null, xhr.response)
    } else {
      callback(status, xhr.response)
    }
  }
  xhr.send()
}

const scene = new THREE.Scene()
scene.background = new THREE.Color('lightblue')

const ambientLight = new THREE.AmbientLight(0xcccccc)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)
directionalLight.position.set(1, 1, 0.5).normalize()
scene.add(directionalLight)

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.z = 5
let firstPositionUpdate = true

const worldTexture = new THREE.TextureLoader().load('texture.png')
const world = new WorldRenderer(scene, worldTexture)
const entities = new Entities(scene)
const primitives = new Primitives(scene)

getJSON('blocksStates.json', (err, json) => {
  if (err) return
  world.setBlocksStates(json)
})

const renderer = new THREE.WebGLRenderer()
renderer.setPixelRatio(window.devicePixelRatio || 1)
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

let controls = new THREE.OrbitControls(camera, renderer.domElement)

function animate() {
  window.requestAnimationFrame(animate)
  if (controls) controls.update()
  renderer.render(scene, camera)
}
animate()

socket.on('version', (version) => {
  console.log('Using version: ' + version)
  world.setVersion(version)
  entities.clear()
  primitives.clear()
  firstPositionUpdate = true
  document.addEventListener("keydown", keyDownTextField, false);
  document.addEventListener("keyup", keyUpTextField, false);

  function keyDownTextField(e) {
    var keyCode = e.keyCode;
    console.log(keyCode)
    if (keyCode == 38 || keyCode == 87) {
      // forward
      socket.emit('move', "down_forward");
    } else if (keyCode == 40 || keyCode == 83) {
      // back
      socket.emit('move', "down_back");
    }
    else if (keyCode == 37 || keyCode == 65) {
      // right
      socket.emit('move', "down_right");
    }
    else if (keyCode == 39 || keyCode == 68) {
      // left
      socket.emit('move', "down_left");
    }
    else if (keyCode == 32) {
      // jump
      socket.emit('move', "down_jump");
    }
  }

  function keyUpTextField(e) {
    var keyCode = e.keyCode;
    console.log(keyCode)
    if (keyCode == 38 || keyCode == 87) {
      // forward
      socket.emit('move', "up_forward");
    } else if (keyCode == 40 || keyCode == 83) {
      // back
      socket.emit('move', "up_back");
    }
    else if (keyCode == 37 || keyCode == 65) {
      // right
      socket.emit('move', "up_right");
    }
    else if (keyCode == 39 || keyCode == 68) {
      // left
      socket.emit('move', "up_left");
    }
  }

  let botMesh
  socket.on('position', ({ pos, addMesh, yaw, pitch }) => {
    if (yaw !== undefined && pitch !== undefined) {
      if (controls) {
        controls.dispose()
        controls = null
      }
      camera.position.set(pos.x, pos.y + 1.6, pos.z)
      camera.rotation.set(pitch, yaw, 0, 'ZYX')
      return
    }
    if (pos.y > 0 && firstPositionUpdate) {
      controls.target.set(pos.x, pos.y, pos.z)
      camera.position.set(pos.x, pos.y + 20, pos.z + 20)
      controls.update()
      firstPositionUpdate = false
    }
    if (addMesh) {
      if (!botMesh) {
        const geometry = new THREE.BoxGeometry(0.6, 1.8, 0.6)
        geometry.translate(0, 0.9, 0)
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 })
        botMesh = new THREE.Mesh(geometry, material)
        scene.add(botMesh)
      }
      botMesh.position.set(pos.x, pos.y, pos.z)
    }
  })

  socket.on('chat', (msg) => {
      console.log("Chat: " + JSON.stringify(msg))
      var messageElem = document.createElement("p")
      messageElem.appendChild(document.createTextNode(msg.text))
      document.getElementById("chat").appendChild(messageElem)
  });

  socket.on('entity', (e) => {
    entities.update(e)
  })

  socket.on('primitive', (p) => {
    primitives.update(p)
  })

  socket.on('chunk', (data) => {
    const [x, z] = data.coords.split(',')
    world.addColumn(parseInt(x, 10), parseInt(z, 10), data.chunk)
  })

  socket.on('unloadChunk', ({ x, z }) => {
    world.removeColumn(x, z)
  })

  socket.on('blockUpdate', ({ pos, stateId }) => {
    world.setBlockStateId(new Vec3(pos.x, pos.y, pos.z), stateId)
  })
})
