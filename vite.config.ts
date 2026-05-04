import { defineConfig } from 'vite';

const repositoryName = 'LX_plant_vs_zombie';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? `/${repositoryName}/` : '/',
}));
