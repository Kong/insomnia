module.exports = {
  name: 'default',
  displayName: 'Core Default',
  theme: {
    background: {
      default: '#555',
      success: '#59a210',
      notice: '#ae9602',
      warning: '#d07502',
      danger: '#d04444',
      surprise: '#7d69cb',
      info: '#1c90b4',
    },
    foreground: {
      default: '#eee',
    },
    styles: {
      transparentOverlay: {
        background: {
          default: 'rgba(30, 30, 30, 0.8)',
        },
        foreground: {
          default: '#ddd',
        },
      },
      dialog: {
        background: {
          default: '#fff',
        },
        foreground: {
          default: '#333',
        },
      },
      sidebar: {
        background: {
          default: '#2e2f2b',
          success: '#7ecf2b',
          notice: '#f0e137',
          warning: '#ff9a1f',
          danger: '#ff5631',
          surprise: '#a896ff',
          info: '#46c1e6',
        },
        foreground: {
          default: '#e0e0e0',
        },
        highlight: {
          default: '#999',
        },
      },
      sidebarHeader: {
        background: {
          default: '#695eb8',
        },
        foreground: {
          default: '#fff',
        },
      },
      paneHeader: {
        foreground: {
          default: '#666',
        },
        background: {
          default: '#fff',
          success: '#75ba24',
          notice: '#d8c84d',
          warning: '#ec8702',
          danger: '#e15251',
          surprise: '#8776d5',
          info: '#20aed9',
        },
      },
      pane: {
        background: {
          default: '#282925',
          success: '{{ styles.sidebar.background.success }}',
          notice: '{{ styles.sidebar.background.notice }}',
          warning: '{{ styles.sidebar.background.warning }}',
          danger: '{{ styles.sidebar.background.danger }}',
          surprise: '{{ styles.sidebar.background.surprise }}',
          info: '{{ styles.sidebar.background.info }}',
        },
        foreground: {
          default: '#e0e0e0',
        },
        highlight: {
          default: '#999',
        },
      },
    },
  },
};
