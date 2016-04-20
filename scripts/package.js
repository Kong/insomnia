import packager from 'electron-packager'

const options = {
  arch: 'x64',
  platform: 'darwin',
  dir: './dist'
};

packager(options, (err, appPaths) => {
  console.log(err, appPaths);
});
