import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

// 빌드마다 고유 번호 — 화면이 새 버전 배포를 알아차리는 데 사용 (/version.json)
const BUILD_ID = `${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)}-${(process.env.VERCEL_GIT_COMMIT_SHA || Math.random().toString(36).slice(2, 9)).slice(0, 7)}`;

function versionFile(): Plugin {
  return {
    name: 'msec-version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ build: BUILD_ID, builtAt: Date.now() }),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), versionFile()],
  define: {
    __APP_BUILD__: JSON.stringify(BUILD_ID),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
