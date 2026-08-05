import { type Config } from '@react-router/dev/config';

export default {
  appDirectory: 'src',
  ssr: false,
  serverModuleFormat: 'cjs',
  future: {
    v8_middleware: true,
  },
} satisfies Config;
