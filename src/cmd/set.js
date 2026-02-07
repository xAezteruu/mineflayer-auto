export default {
  name: "set",
  run: function ({ ws, bot, args }) {
    if (!global.setAv.includes(args[0])) {
      if (ws)
        return ws.send({
          type: "logs",
          data: `SET: available set is ${global.setAv.join(", ")}`,
        });
      else bot.chat(`/r SET: available set is ${global.setAv.join(", ")}`);
    }
    let key = args[0];
    let value = args.shift();
    global[key] = value.join(" ");
  },
};
