module.exports = {
  name: 'studio-light',
  displayName: 'Studio Light',
  theme: {
    foreground: {
      default: '#555',
    },
    styles: {
      link: {
        foreground: {
          default: '#68a9a2',
        },
      },
      sidebar: {
        background: {
          default: '#0f578a',
          success: '#90d5ad',
          notice: '#ffdb02',
          warning: '#ffac49',
          danger: '#ff7472',
          surprise: '#70c4ff',
          info: '#75ddff',
        },
        foreground: {
          default: '#fff',
        },
        highlight: {
          default: 'rgb(112, 196, 255)',
          xxs: 'rgba(112, 196, 255, 0.05)',
          xs: 'rgba(112, 196, 255, 0.1)',
          sm: 'rgba(112, 196, 255, 0.2)',
          md: 'rgba(112, 196, 255, 0.3)',
          lg: 'rgba(112, 196, 255, 0.5)',
          xl: 'rgba(112, 196, 255, 0.8)',
        },
      },
      paneHeader: {
        background: {
          default: '#f0f9ff',
          success: '#3fa66a',
          notice: '#efba66',
          warning: '#e48a37',
          danger: '#dc4939',
          surprise: '#a3a1d3',
          info: '#6d9cbe',
        },
      },
      sidebarHeader: {
        foreground: {
          default: '#fff',
        },
      },
      transparentOverlay: {
        background: {
          default: 'rgba(243, 242, 250, 0.8)',
        },
        foreground: {
          default: '#555',
        },
      },
    },
  },
};
