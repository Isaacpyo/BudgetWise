import { buildApp } from './app';
import { loadConfig } from './config';
import { createDeps } from './deps';
import { ensureDemoSeeded } from './services/demo';

async function main() {
  const config = loadConfig();
  // Fastify's logger is created inside buildApp; use a console shim until then.
  const bootLog = {
    info: (o: unknown, m?: string) => console.warn(m ?? '', o),
    warn: (o: unknown, m?: string) => console.warn(m ?? '', o),
    error: (o: unknown, m?: string) => console.error(m ?? '', o),
  };
  const deps = createDeps(config, bootLog);
  const app = await buildApp(deps);
  deps.log = app.log;

  if (config.demo.seedOnStart) {
    try {
      const reseeded = await ensureDemoSeeded(deps);
      app.log.info({ reseeded }, 'demo account checked');
    } catch (err) {
      app.log.error({ err }, 'demo seeding failed; continuing without it');
    }
  }

  const close = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void close('SIGTERM'));
  process.on('SIGINT', () => void close('SIGINT'));

  await app.listen({ port: config.port, host: config.host });
  app.log.info(
    { provider: config.plaid.provider, emulators: config.firebase.usingEmulators },
    'BudgetWise API ready',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
