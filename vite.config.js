export default {
  plugins: [
    {
      name: "lab-03-evidence-endpoint",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.url === "/missing-sprite.svg") {
            response.statusCode = 404;
            response.setHeader("Content-Type", "text/plain");
            response.end("missing sprite");
            return;
          }
          if (request.url !== "/__lab03/slow-json") {
            next();
            return;
          }
          const timer = setTimeout(() => {
            response.setHeader("Content-Type", "application/json");
            response.end('{"status":"late"}');
          }, 600);
          request.on("close", () => clearTimeout(timer));
        });
      },
    },
  ],
};
