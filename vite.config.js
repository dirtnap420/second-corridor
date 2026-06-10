import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

let rev = 'dev';
try {
  rev = execSync('git rev-parse --short HEAD').toString().trim();
} catch {
  /* no git — keep 'dev' */
}

export default defineConfig({
  define: {
    __BUILD_REV__: JSON.stringify(rev),
  },
});
