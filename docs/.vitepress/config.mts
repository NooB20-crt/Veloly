import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Veloly Docs',
  description: 'Guides and documentation for Veloly, the open-source music player.',
  base: '/Veloly/docs/',
  lang: 'en',
  cleanUrls: true,
  appearance: 'force-dark',
  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', href: '/Veloly/assets/veloly-mark.png', type: 'image/png', sizes: '512x512' }],
    ['meta', { name: 'theme-color', content: '#000000' }],
  ],
  themeConfig: {
    logo: { src: 'https://zyndrax707.github.io/Veloly/assets/veloly-mark.png', alt: 'Veloly' },
    siteTitle: 'Docs',
    nav: [
      { text: 'Features', link: 'https://zyndrax707.github.io/Veloly/#features', target: '_self', noIcon: true },
      { text: 'Download', link: 'https://zyndrax707.github.io/Veloly/#download', target: '_self', noIcon: true },
      { text: 'FAQ', link: 'https://zyndrax707.github.io/Veloly/#faq', target: '_self', noIcon: true },
      { text: 'iOS guide', link: 'https://zyndrax707.github.io/Veloly/ios.html', target: '_self', noIcon: true },
      { text: 'Docs', link: '/', activeMatch: '^/' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Install Veloly', link: '/guide/install' },
          { text: 'Using the player', link: '/guide/using' },
          { text: 'Your music library', link: '/guide/library' },
          { text: 'Playlists and queue', link: '/guide/playlists' },
          { text: 'Lyrics', link: '/guide/lyrics' },
          { text: 'Sound and appearance', link: '/guide/sound' },
          { text: 'Listen offline', link: '/guide/offline' },
          { text: 'Privacy and network use', link: '/guide/privacy' },
          { text: 'Troubleshooting', link: '/guide/troubleshooting' },
        ],
      },
      {
        text: 'Theming',
        items: [
          { text: 'Getting started', link: '/theming/' },
          { text: 'Theme files', link: '/theming/theme-files' },
          { text: 'CSS variables', link: '/theming/variables' },
          { text: 'Selectors', link: '/theming/selectors' },
          { text: 'Examples', link: '/theming/examples' },
          { text: 'Keep themes portable', link: '/theming/share' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/zyndrax707/Veloly' },
    ],
    search: { provider: 'local' },
    editLink: {
      pattern: 'https://github.com/zyndrax707/Veloly/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
    footer: {
      message: 'Free and open source · Independent project based on 555.',
      copyright: 'Veloly',
    },
  },
})
