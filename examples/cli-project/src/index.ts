import { join } from 'path';
import { homedir } from 'os';
import { config, loadConfig } from '@lcdev/app-config';

// NOTE: this will fail until you make a file in ~/.config/my-cli.yml (or toml, json, json5)

async function main() {
  await loadConfig({
    directory: join(homedir(), '.config'),
    schemaDirectory: join(__dirname, '..'),
    fileNameBase: 'my-cli',
  });

  console.log({ config });
}

main().catch((error) => {
  console.error(error);
  setTimeout(() => process.exit(1), 0);
});