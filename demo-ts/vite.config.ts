import _config from './_config.js';
import { defineConfig } from 'vite'

const HOST = _config.server.host;
const PORT = _config.server.port;

export default defineConfig({
  server: {
    host: HOST,
    port: PORT,
  },
  build: {
    target: 'es2020',
  },
});
