console.log("Loading bot.")
const mineflayer = require('mineflayer')
const mineflayerViewer = require('prismarine-viewer').mineflayer

console.log("Loaded mineflayer and prismarine-viewer; connecting to server...");
const bot = mineflayer.createBot({
  username: 'MineWebTest',
  host: 'localhost',
  port: 25577,
})

console.log("Connected to remote server! Spawning user.")
bot.once('spawn', () => {
  mineflayerViewer(bot, { firstPerson: true, port: 3000 })
  console.log("Opening web server.")

  const path = [bot.entity.position.clone()]
  bot.on('move', () => {
    if (path[path.length - 1].distanceTo(bot.entity.position) > 1) {
      path.push(bot.entity.position.clone())
      bot.viewer.drawLine('path', path)
    }
  })
  const mcData = require('minecraft-data')(bot.version);
})
