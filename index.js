"use strict";

const http = require("http");
const path = require("path");
const fs = require("fs");
const mime = require("mime");
const urlObj = require("url");
const process = require("child_process");
const config = require("./config.json");

const server = http.createServer(function(req, res) {
  let urlData = urlObj.parse(req.url, true);
  res.writeHead(200, { "Content-type": "text/html" });
  let ip = getClientIp(req);

  if (urlData.pathname[urlData.pathname.length - 1] == "/") {
    urlData.pathname += "index.html";
  }
  console.log("urlData.pathname:", urlData.pathname, req.headers);

  // 静态目录
  let staticPath = "public/" + urlData.pathname;
  if (fs.existsSync(staticPath)) {
    let content = fs.readFileSync(staticPath, "utf8");
    let deps = mime.getType(staticPath);
    res.writeHead(200, { "Content-Type": deps });
    res.end(content);
    return 0;
  }

  // IP限制
  if (!checkIP(ip)) {
    console.log("Do not allow, IP:", ip);
    // res.writeHead(403, { "Content-type": "text/html" });
    // res.end("Do not allow, IP:" + ip);
    // return 0;
  }

  // token验证
  if (req.headers["x-gitlab-token"]) {
    if (!req.headers["x-gitlab-token"] == config["x-gitlab-token"]) {
      console.log(
        "x-gitlab-token:",
        req.headers["x-gitlab-token"],
        config["x-gitlab-token"]
      );
      res.writeHead(403, { "Content-type": "text/html" });
      res.end("Forbidden");
      return 0;
    }
  } else if (req.headers["x-gitee-token"]) {
    if (!req.headers["x-gitee-token"] == config["x-gitee-token"]) {
      res.writeHead(403, { "Content-type": "text/html" });
      res.end("Forbidden");
      return 0;
    }
  } else {
    res.writeHead(403, { "Content-type": "text/html" });
    res.end("Forbidden");
    return 0;
  }

  let project = getProject(urlData.pathname);

  // let body = "";
  // req.on("data", chunk => (body += chunk));
  // req.on("end", function() {
  //   // 解析参数
  //   try {
  //     body = JSON.parse(body);
  //   } catch (error) {
  //     console.error(error);
  //   }

  //   console.log("body:", body);
  //   res.end();
  // });

  if (project) {
    res.writeHead(200, { "Content-type": "text/html" });
    process.exec("cd " + project.path + " && git pull", function(
      error,
      stdout,
      stderr
    ) {
      console.log("process.exec:", stdout, stderr);
      res.write("<pre>\r\n");
      res.write(stdout);
      res.write("\r\n");
      res.write(stderr);
      res.write("</pre>\r\n");
      if (project.run) {
        process.exec(project.run, function(error, stdout, stderr) {
          console.log("process.exec:", stdout, stderr);
          res.write("<pre>\r\n");
          res.write(stdout);
          res.write("\r\n");
          res.write(stderr);
          res.write("</pre>\r\n");
          res.end();
        });
      } else {
        res.end();
      }
    });
  } else {
    console.log("404");
    res.writeHead(404, { "Content-type": "text/html" });
    res.end();
  }
});

server.listen(config.port, "0.0.0.0", function() {
  console.log("Listening at: http://localhost:" + config.port);
});

const getClientIp = function(req) {
  var ip =
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress;

  if (ip.indexOf(":") != -1) {
    var arr = ip.split(":");
    ip = arr[arr.length - 1];
  }
  return ip;
};

const checkIP = function(ip) {
  for (var i in config.allowIP) {
    if (ip == config.allowIP[i]) return true;
  }
  return false;
};

const getProject = uri => {
  let itemName = uri.replace(/\/pull\/(.*)$/g, "$1");
  console.log("itemName:", itemName);
  if (!itemName || !config.projects) return false;
  for (let i in config.projects) {
    if (config.projects[i].key == itemName) {
      return config.projects[i];
    }
  }
  return false;
};
