import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// host:true lets phones and other PCs on the hotel network open the app (and the QR menus).
export default defineConfig({ plugins: [react()], server: { host: true, port: 5173, proxy: { '/api': 'http://localhost:4000' } } });
