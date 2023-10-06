const sidebarBackground = {
  default: '#2C2C2C',
  success: '#7ecf2b',
  notice: '#f0e137',
  warning: '#ff9a1f',
  danger: '#ff5631',
  surprise: '#4000BF',
  info: '#46c1e6',
};

export default {
  name: 'default',
  displayName: 'Default',
  theme: {
    background: sidebarBackground,
    foreground: {
      default: '#ddd',
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
          default: '#2a2a2a',
        },
      },
      appHeader: {
        background: {
          default: '#2C2C2C',
        },
      },
      sidebar: {
        background: sidebarBackground,
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
          default: '#ccc',
        },
        background: {
          default: '#212121',
          success: '#75ba24',
          notice: '#d8c84d',
          warning: '#ec8702',
          danger: '#e15251',
          surprise: '#4000BF',
          info: '#20aed9',
        },
      },
      pane: {
        background: {
          ...sidebarBackground,
          default: '#292929',
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
