process.env.TS_NODE_PROJECT = 'tsconfig.webpack.json'
process.env.NODE_ENV = 'development'
import webpack from 'webpack'
import config from './webpack.config.electron'

webpack(config).run(err => {
  if (err) console.log(err)
})
