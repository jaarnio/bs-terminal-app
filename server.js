// server.js
const express = require("express");
const WebSocket = require("ws");
const net = require("net");
const { type } = require("os");
const fs = require("fs");
const app = express();
const wss = new WebSocket.Server({ noServer: true });
const url = require("url");

let connections = [];
let autobootStopEnabled;

app.use(express.static("public"));

app.get("/connections", (req, res) => {
  fs.readFile("connections.json", "utf8", (err, data) => {
    if (err) {
      console.error(err);
      res.status(500).send("Error reading connections");
    } else {
      res.send(JSON.parse(data));
    }
  });
});

app.post("/autobootStop", express.json(), (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== "boolean") {
    return res.status(400).send("Invalid value. Please send a boolean value.");
  }
  autobootStopEnabled = enabled;
  res.send(`Autoboot stop has been ${enabled ? "enabled" : "disabled"}.`);
});

wss.on("connection", (ws, req) => {
  //console.log(req);
  const urlParams = new URLSearchParams(url.parse(req.url).query);
  const port = urlParams.get("port");
  const ip = urlParams.get("ip");
  console.log(`Connection to ${ip}:${port}`);
  let connection = net.connect(port, ip);
  connections.push(connection);

  connection.on("data", (data) => {
    let str = data.toString();
    ws.send(str);

    //ws.send(JSON.stringify({ type: "terminal", content: str }));
    if (
      autobootStopEnabled &&
      (str.includes("Hit key to stop autoboot") ||
        str.includes("Automatic startup in 3 seconds"))
    ) {
      connection.write("\x03"); // send CTRL-C
    }
  });

  ws.on("message", (message) => {
    connection.write(message);
  });

  ws.on("close", () => {
    connection.end();
  });
});

const server = app.listen(3000, () => {
  console.log("Server started on port 3000");
});

server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});
