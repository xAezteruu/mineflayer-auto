import mc from "mineflayer";
import { Vec3 } from "vec3";
import pt from "mineflayer-pathfinder";
import { loader } from "mineflayer-auto-eat";
import Armor from "mineflayer-armor-manager";
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import readline from "readline";
import prc from "prismarine-chat";
import { simplify } from "prismarine-nbt";
import { readdirSync } from "fs";
import {
  autoSell,
  refreshInputLine,
  spawners,
  totalxp,
  updateinv,
} from "./src/func.js";
import chokidar from "chokidar";

const pc = prc("1.21.1");
global.info = { chat: "" };
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}
const app = express();

app.use(express.static(process.cwd() + "/src/build"));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
global.data = { inventory: [], invtitle: "" };
let latestchat = [];
let latestlog = [];
let mcbot,
  commands = new Map();
global.setAv = ["state", "spawnerEnabled", "fishmode", "autoSell"];
global.state = "idle";
global.spawnerEnabled = true;
global.fishmode = false;
global.autoSell = false;
let sbd = [];

server.listen(process.env.SERVER_PORT || 3000);

const {
  pathfinder,
  Movements,
  goals: { GoalBlock, GoalGetToBlock, GoalXZ, GoalY },
} = pt;

process.stdin.on("keypress", (str, key) => {
  if (
    (key.name === "return" || key.name === "enter") &&
    global.info.chat.length > 0
  ) {
    if (mcbot?.entity) mcbot.chat(global.info.chat);
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    global.info.chat = "";
    refreshInputLine();
  } else if (key.name === "backspace") {
    global.info.chat = global.info.chat.slice(0, -1);
    refreshInputLine();
  } else if (key.name === "escape" || (key.ctrl && key.name === "c")) {
    console.log("\nKeluar...");
    process.exit();
  } else if (
    str &&
    key.name !== "shift" &&
    key.name !== "alt" &&
    key.name !== "control"
  ) {
    global.info.chat += str;
    refreshInputLine();
  }
});

global.load = {
  cmd: async function () {
    for (const file of readdirSync(process.cwd() + "/src/cmd").filter((f) =>
      f.endsWith(".js"),
    )) {
      try {
        const filePath = process.cwd() + "/src/cmd" + "/" + file;
        const modulePath = "file://" + filePath + "?t=" + Date.now();

        const module = await import(modulePath);
        const command = module.default || module;

        if (command.name && command.run) {
          commands.set(command.name, command);

          if (command.aliases) {
            command.aliases.forEach((alias) => {
              commands.set(alias, command);
            });
          }
        }
      } catch (e) {
        console.error("Failed:", file, e.message);
      }
    }
  },
};

async function main() {
  const bot = mc.createBot({
    username: process.argv[2],
    host: "voltraz.xyz",
    version: "1.21.1",
    physicsEnabled: true,
    keepAlive: true,
    plugins: [pathfinder, loader, Armor],
  });
  bot._client.on("teams", (pkt) => {
    if (!pkt.prefix) return;
    if (!pkt.team.includes("TAB-Sidebar")) return;

    const line = Number(pkt.team.split("-")[2]);

    const msg = new pc(simplify(pkt.prefix));
    sbd[line] = msg.toHTML();
  });

  bot.once("login", () => {
    console.log(bot.username);
    bot.chat("/login aezteru");
    // bot.setQuickBarSlot(4);
    // bot.activateItem();
  });

  bot.on("windowOpen", (w) => {
    updateinv(w);
  });

  bot.on("windowClose", () => {
    updateinv(bot.inventory);
  });

  bot.on("health", () => {
    if (bot.food >= 20) bot.autoEat.disableAuto();
    // Disable the plugin if the bot is at 20 food points
    else bot.autoEat.enableAuto(); // Else enable the plugin again
  });

  bot.on("respawn", () => {
    bot.chat("/home");
  });

  bot.once("spawn", async () => {
    await bot.waitForTicks(10);
    mcbot = bot;

    bot.chat("/queue survival");
    setInterval(() => {
      bot.chat("/queue survival");
    }, 120000);

    autoSell(bot);

    setInterval(async () => {
      await spawners(bot);
    }, 600000);
  });

  bot._client.on("packet", async (d, m, b) => {
    if (m.name === "open_sign_entity") {
      await bot.updateSign(
        bot.blockAt(new Vec3(d.location.x, d.location.y, d.location.z)),
        [
          totalxp(bot.experience),
          "-----------",
          "Write the new value",
          "in the first line",
        ].join("\n"),
      );
      await bot.waitForTicks(10);
      if (bot.currentWindow) bot.clickWindow(0, 0, 0);
    }
    if (m.name.includes("inv")) console.log(d, m);
  });

  bot.once("spawn", () => {
    global.load.cmd();
    refreshInputLine();
    updateinv(bot.inventory);
    bot.inventory.on("updateSlot", (_, o, n) => {
      if (!o && n && !bot.currentWindow) updateinv(bot.inventory);
    });

    bot.on("playerCollect", async (e, c) => {
      if (
        bot.inventory.slots
          .filter((d, i) => i > 8 && i !== 45)
          .filter((d) => d === null).length < 2 &&
        global.fishmode
      )
        bot.chat("/emf sellall");
    });
    bot.autoEat.options = {
      priority: "foodPoints",
      startAt: 14,
      bannedFood: [],
    };
    bot.on("message", async (m) => {
      if (m.toString().includes("ʙʀᴏᴀᴅᴄᴀsᴛ •"))
        bot.chat(`/kupon reedem ${m.toString().split(" ").pop()}`);
      let pos = { start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 0, z: 0 } };

      const defaultMove = new Movements(bot);
      if (
        m.toString().includes("SᴍᴀʀᴛSᴘᴀᴡɴᴇʀ") &&
        m.toString().includes("ᴇxᴘ ᴄᴏʟʟᴇᴄᴛᴇᴅ")
      ) {
        if (latestlog.length > 50) latestlog.shift();
        latestlog.push(m.toHTML());
      }
      if (!m.toString().includes("Mana")) {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        console.log(m.toAnsi());
        if (latestchat.length > 50) latestchat.shift();
        latestchat.push(m.toHTML());
        refreshInputLine();
      }
      if (m.toString().includes("/trade accept")) {
        if (
          !["XDaffa_teru", "xAezteru_"].includes(
            m.toString().replace("/trade accept ", ""),
          )
        )
          return;
        bot.chat(`/trade ${m.toString().replace("/trade accept ", "")}`);
        await bot.waitForTicks(10);
        await bot.clickWindow(3, 0, 0);
      }
      if (
        m.toString().match(/✉⬇ ᴍᴇꜱꜱᴀɢᴇ \((xAezteru_|XDaffa_teru) → (.*?)\) /)
      ) {
        const msg = m
          .toString()
          .replace(/✉⬇ ᴍᴇꜱꜱᴀɢᴇ \((xAezteru_|XDaffa_teru) → (.*?)\) /, "");
        const args = msg.split(" ");
        const command = args.shift();
        let d = { m, bot, args, command, pos, defaultMove };
        if (commands.has(command)) {
          const exe = commands.get(command);
          return await exe.run(d);
        }
        // await cmd(bot, msg, "game");
      }
    });
  });

  bot.on("kicked", (r) => {
    console.log(new pc(simplify(r)).toAnsi());
  });
  bot.on("error", (e) => {
    console.log(e, 1);
  });
  bot.on("end", () =>
    setTimeout(() => {
      main();
    }, 3000),
  );
}

main();

wss.on("connection", (ws, req) => {
  ws.send(JSON.stringify({ type: "info", data }));
  ws.send(JSON.stringify({ type: "chat", data: latestchat }));
  ws.send(JSON.stringify({ type: "logs", data: latestlog }));
  ws.send(JSON.stringify({ type: "scoreboard", data: sbd }));
  mcbot?.on("message", (m) => {
    if (!m.toString().includes("Mana"))
      ws.send(JSON.stringify({ type: "chat", data: m.toHTML() }));
    if (
      m.toString().includes("SᴍᴀʀᴛSᴘᴀᴡɴᴇʀ") &&
      m.toString().includes("ᴇxᴘ ᴄᴏʟʟᴇᴄᴛᴇᴅ")
    )
      ws.send(JSON.stringify({ type: "logs", data: m.toHTML() }));
  });
  let latest = {};

  const isEqual = (obj1, obj2) => {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  };

  const interval = setInterval(() => {
    if (!isEqual(latest, data)) {
      ws.send(JSON.stringify({ type: "info", data }));
      latest = JSON.parse(JSON.stringify(data));
    }
  }, 100);

  mcbot?._client?.on("teams", (pkt) => {
    if (!pkt.prefix) return;
    if (!pkt.team.includes("TAB-Sidebar")) return;

    const line = Number(pkt.team.split("-")[2]);

    const msg = new pc(simplify(pkt.prefix));
    sbd[line] = msg.toHTML();
    ws.send(JSON.stringify({ type: "scoreboard", data: sbd }));
  });

  ws.onmessage = async function (e) {
    const msg = JSON.parse(e.data);
    if (msg.type === "invclick") {
      if (mcbot?.entity)
        mcbot.clickWindow(msg.data.slot, msg.data.type, msg.data.mode);
      updateinv(mcbot.currentWindow ? mcbot.currentWindow : mcbot.inventory);
      ws.send(JSON.stringify({ type: "info", data }));
    } else if (msg.type === "message") {
      if (!msg.data.startsWith(",")) mcbot.chat(msg.data);
      else if (msg.data.startsWith(",")) {
        const prefix = msg.data.replace(",", "");
        const args = prefix.split(" ");
        const command = args.shift();
        if (commands.has(command)) {
          const exe = commands.get(command);
          await exe.run({
            m: null,
            bot: mcbot,
            args,
            command,
            pos: global.pos,
            defaultMove: new Movements(mcbot),
            ws,
          });
        }
      }
    }
  };

  ws.onclose = () => clearInterval(interval);
});

chokidar
  .watch(process.cwd() + "/src/cmd", {
    ignoreInitial: true,
    usePolling: true,
    interval: 300,
    awaitWriteFinish: {
      stabilityThreshold: 200,
      pollInterval: 100,
    },
    depth: 2,
  })
  .on("all", async (e, f) => {
    if (f.endsWith(".js")) global.load.cmd();
  });

process.on("uncaughtException", console.log);
process.on("unhandledRejection", console.log);
