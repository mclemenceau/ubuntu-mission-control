import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { viteSingleFile } from "vite-plugin-singlefile"

const proxy = {
  '/v1': { target: 'https://tests-api.ubuntu.com', changeOrigin: true },
}

export default defineConfig(({ command, mode }) => {
  const isDeployBuild = command === 'build' && mode === 'production'

  return {
    base: isDeployBuild ? '/ubuntu-mission-control/' : '/',
    plugins: [svelte(), ...(isDeployBuild ? [viteSingleFile()] : [])],
    server: { port: 3000, proxy },
    preview: { port: 3000, proxy },
  }
})
