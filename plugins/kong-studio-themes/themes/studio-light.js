module.exports = {
  name: 'studio-light',
  displayName: 'Designer Light',
  theme: {
    foreground: {
      default: '#555',
    },
    background: {
      success: '#3d9c62',
      notice: '#bb9700',
      warning: '#d6803e',
      danger: '#da5b56',
      info: '#003052',
      surprise: '#6030BF',
    },
    styles: {
      link: {
        foreground: {
          default: '#68a9a2',
        },
      },
      editor: {
        background: {
          surprise: '{{ background.info }}',
          info: '{{ background.surprise }}',
        },
      },
      activityBar: {
        foreground: {
          default: '#fff',
        },
        background: {
          default: '#003052',
        },
        highlight: {
          default: 'rgba(23, 130, 207, 1)',
          xxs: 'rgba(23, 130, 207, 0.05)',
          xs: 'rgba(23, 130, 207, 0.1)',
          sm: 'rgba(23, 130, 207, 0.2)',
          md: 'rgba(23, 130, 207, 0.3)',
          lg: 'rgba(23, 130, 207, 0.5)',
          xl: 'rgba(23, 130, 207, 0.8)',
        },
      },
      dialog: {
        background: {
          info: '#005B9E',
        },
      },
      sidebar: {
        background: {
          default: '#f7fafc',
          success: '#50a14f',
          notice: '#c18401',
          warning: '#c18401',
          danger: '#e45649',
          surprise: '#a626a4',
          info: '#0184bc',
        },
        foreground: {
          default: '#444',
        },
        highlight: {},
      },
      transparentOverlay: {
        background: {
          default: 'rgba(230,240,250,0.8)',
        },
        foreground: {
          default: '#555',
        },
      },
    },
  },
};
