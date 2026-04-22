const http = require("http");

http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h1>Hello from Brimble Deploy!</h1><p>Deployment working.</p>");
  })
  .listen(process.env.PORT || 3000);
