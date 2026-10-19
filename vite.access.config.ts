import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
// Separate access bundle. No legacy application bootstrap or private environment loading.
export default defineConfig({
 envDir:false,publicDir:false,plugins:[react()],base:'/',
 resolve:{alias:{'@':path.resolve(__dirname,'src')}},
 define:{
  'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('https://elahjmtboqhqqxmoaths.supabase.co'),
  'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify('sb_publishable_U3WJRl0zpZDEFzAgguf3bQ_ihiwn_-O'),
 },
 build:{outDir:'access-dist',emptyOutDir:true,sourcemap:false,assetsDir:'access-assets',rolldownOptions:{input:path.resolve(__dirname,'acesso.html')}},
})
