const sidebarBackground = {
  default: '#131316',
  success: '#4ade80',
  notice: '#facc15',
  warning: '#fb923c',
  danger: '#f87171',
  surprise: '#7c6cf0',
  info: '#38bdf8',
};

export default {
  name: 'default',
  displayName: 'Default',
  theme: {
    background: sidebarBackground,
    foreground: {
      default: '#d4d4d8',
    },
    styles: {
      transparentOverlay: {
        background: {
          default: 'rgba(0, 0, 0, 0.5)',
        },
        foreground: {
          default: '#d4d4d8',
        },
      },
      dialog: {
        background: {
          default: '#1c1c20',
        },
      },
      appHeader: {
        background: {
          default: '#131316',
        },
      },
      sidebar: {
        background: sidebarBackground,
        foreground: {
          default: '#d4d4d8',
        },
        highlight: {
          default: '#999',
        },
      },
      sidebarHeader: {
        background: {
          default: '#131316',
        },
        foreground: {
          default: '#fff',
        },
      },
      paneHeader: {
        foreground: {
          default: '#d4d4d8',
        },
        background: {
          default: '#18181b',
          success: '#22c55e',
          notice: '#eab308',
          warning: '#f97316',
          danger: '#ef4444',
          surprise: '#6d5ae6',
          info: '#0ea5e9',
        },
      },
      pane: {
        background: {
          ...sidebarBackground,
          default: '#18181b',
        },
        foreground: {
          default: '#d4d4d8',
        },
        highlight: {
          default: '#999',
        },
      },
    },
  },
};
