import { createApp } from './app';

const port = Number(process.env.PORT ?? 2567);
const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

createApp(clientOrigin).listen(port, () => {
  console.log(`Hutel-server kører på http://localhost:${port}  (health: /health)`);
});
