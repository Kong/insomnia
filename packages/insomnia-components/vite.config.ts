import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const __DEV__ = mode !== 'production';

  return {
    build: {
      sourcemap: __DEV__,
      lib: {
        entry: './src/index.ts',
        fileName: format => {
          if (format === 'cjs') {
            return 'commonjs/index.js';
          }
          return 'index.js';
        },
        // We use CommonJS output for running tests in jest.
        formats: ['cjs', 'es'],
        name: 'insomnia-components',
      },
      rollupOptions: {
        external: ['react', 'react-dom', 'styled-components', 'react-use'],
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
  };
});
