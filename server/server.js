const { server } = require('./index.js');

const PORT = process.env.PORT || 3001;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Socket.IO is listening on http://localhost:${PORT}`);
});
