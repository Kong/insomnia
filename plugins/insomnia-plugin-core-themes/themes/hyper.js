module.exports = {
  name: 'hyper',
  displayName: 'Hyper',
  theme: {
    foreground: {
      default: '#ddd',
    },
    background: {
      default: '#000',
      success: '#87ee59',
      notice: '#f8d245',
      warning: '#f9ac2a',
      danger: '#ff505c',
      surprise: '#f24aff',
      info: '#23dce8',
    },
    rawCss: `
      .tooltip, .dropdown__menu {
        opacity: 0.95;
      }
    `,
    styles: {
      dialog: {
        background: {
          default: '#111',
        },
      },
      transparentOverlay: {
        background: {
          default: 'rgba(0, 0, 0, 0.5)',
        },
      },
      sidebar: {
        highlight: {
          default: '#aaa',
        },
      },
      paneHeader: {
        background: {
          default: '#000',
          success: '#6ac04b',
          notice: '#ebc742',
          warning: '#ea9f29',
          danger: '#df4b56',
          surprise: '#ed46f9',
          info: '#20bec9',
        },
      },
    },
  },
};
