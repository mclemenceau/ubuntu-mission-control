import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { viteSingleFile } from "vite-plugin-singlefile"

export default defineConfig({
  base: '/ubuntu-mission-control/',
  plugins: [svelte(), viteSingleFile()],
  server: {
    port: 3000,
  },
  preview: {
    port: 3000,
  },
})
