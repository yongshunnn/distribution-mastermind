import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Distribution Mastermind',
    short_name: 'Mastermind',
    description: 'Plan and manage distribution plays across principals, channels and markets.',
    start_url: '/home',
    display: 'standalone',
    background_color: '#f7f7f5',
    theme_color: '#1f5eff',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
