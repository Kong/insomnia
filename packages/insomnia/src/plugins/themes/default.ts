const sidebarBackground = {
  default: '#181818',
  success: '#3fb950',
  notice: '#d7ba7d',
  warning: '#e8964a',
  danger: '#f14c4c',
  surprise: '#3b8eea',
  info: '#4fc1ff',
};

export default {
  name: 'default',
  displayName: 'Default',
  theme: {
    background: sidebarBackground,
    foreground: {
      default: '#cccccc',
    },
    styles: {
      transparentOverlay: {
        background: {
          default: 'rgba(0, 0, 0, 0.5)',
        },
        foreground: {
          default: '#cccccc',
        },
      },
      dialog: {
        background: {
          default: '#202020',
        },
      },
      appHeader: {
        background: {
          default: '#181818',
        },
      },
      sidebar: {
        background: sidebarBackground,
        foreground: {
          default: '#cccccc',
        },
        highlight: {
          default: '#999',
        },
      },
      sidebarHeader: {
        background: {
          default: '#181818',
        },
        foreground: {
          default: '#fff',
        },
      },
      paneHeader: {
        foreground: {
          default: '#cccccc',
        },
        background: {
          default: '#1f1f1f',
          success: '#75ba24',
          notice: '#d8c84d',
          warning: '#ec8702',
          danger: '#e15251',
          surprise: '#0078d4',
          info: '#20aed9',
        },
      },
      pane: {
        background: {
          ...sidebarBackground,
          default: '#1f1f1f',
        },
        foreground: {
          default: '#cccccc',
        },
        highlight: {
          default: '#999',
        },
      },
    },
  },
};
