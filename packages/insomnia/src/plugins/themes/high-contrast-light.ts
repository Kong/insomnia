export default {
  name: 'high-contrast-light',
  displayName: 'High Contrast',
  theme: {
    background: {
      default: '#ffffff',
      success: '#000',
      notice: '#000',
      warning: '#000',
      danger: '#000',
      surprise: '#000',
      info: '#000',
    },
    foreground: {
      default: '#000',
    },
    highlight: {
      default: 'rgb(80, 80, 80)',
      xxs: 'rgba(80, 80, 80, 0.1)',
      xs: 'rgba(80, 80, 80, 0.3)',
      sm: 'rgba(80, 80, 80, 0.4)',
      md: 'rgba(80, 80, 80, 0.5)',
      lg: 'rgba(80, 80, 80, 0.6)',
      xl: 'rgba(80, 80, 80, 0.9)',
    },
    styles: {
      link: {
        foreground: {
          default: '#444',
        },
      },
      paneHeader: {
        background: {
          success: '#222',
          notice: '#222',
          warning: '#222',
          danger: '#222',
          surprise: '#222',
          info: '#222',
        },
        highlight: {
          default: 'rgb(150, 150, 150)',
          xxs: 'rgba(150, 150, 150, 0.1)',
          xs: 'rgba(150, 150, 150, 0.3)',
          sm: 'rgba(150, 150, 150, 0.4)',
          md: 'rgba(150, 150, 150, 0.5)',
          lg: 'rgba(150, 150, 150, 0.6)',
          xl: 'rgba(150, 150, 150, 0.9)',
        },
      },
    },
  },
};
