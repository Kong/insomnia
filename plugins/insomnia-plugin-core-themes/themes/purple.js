module.exports = {
  name: 'purple',
  displayName: 'Purple',
  theme: {
    foreground: {
      default: '#555',
    },
    styles: {
      appHeader: {
        background: {
          default: '#695eb8',
        },
      },
      link: {
        foreground: {
          default: '#68a9a2',
        },
      },
      sidebar: {
        background: {
          default: '#695eb8',
          success: '#a9ea6e',
          notice: '#ffdb02',
          warning: '#ffac49',
          danger: '#ff7472',
          surprise: '#c5bbff',
          info: '#75ddff',
        },
        foreground: {
          default: '#fff',
        },
        highlight: {
          default: 'rgb(217, 204, 255)',
          xxs: 'rgba(207, 190, 255, 0.05)',
          xs: 'rgba(207, 190, 255, 0.1)',
          sm: 'rgba(207, 190, 255, 0.2)',
          md: 'rgba(207, 190, 255, 0.3)',
          lg: 'rgba(207, 190, 255, 0.5)',
          xl: 'rgba(207, 190, 255, 0.8)',
        },
      },
      sidebarHeader: {
        foreground: {
          default: '#eee',
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
