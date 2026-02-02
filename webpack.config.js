const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const ZipPlugin = require('zip-webpack-plugin');
const fs = require('fs');

module.exports = (env) => {
  const isDev = env.environment === 'dev';
  const isStaging = env.environment === 'staging';
  const isProd = env.environment === 'production';

  return {
    mode: isProd ? 'production' : 'development',
    devtool: isDev ? 'inline-source-map' : false,
    
    entry: {
      popup: './src/popup/popup.js',
      background: './src/background/background.js',
      content: './src/content/content.js',
      offscreen: './src/offscreen/offscreen.js',
    },
    
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name]/[name].js',
      clean: true
    },
    
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          }
        }
      ]
    },
    
    plugins: [
      new CopyPlugin({
        patterns: [
          { from: 'public/manifest.json', to: 'manifest.json' },
          { from: 'public/icons', to: 'icons' },
          { from: `config/config.${env.environment}.json`, to: 'config.json' },
          { from: 'src/popup/popup.html', to: 'popup/popup.html' },
          { from: 'models/manifest.json', to: 'models/manifest.json' },
          { from: 'src/offscreen/offscreen.html', to: 'offscreen/offscreen.html' },
        ]
      }),
      
      // Update manifest with environment prefix
      new (class {
        apply(compiler) {
          compiler.hooks.afterEmit.tap('UpdateManifest', () => {
            const manifestPath = path.resolve(__dirname, 'dist/manifest.json');
            const configPath = path.resolve(__dirname, `config/config.${env.environment}.json`);
            
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            
            manifest.name = `${config.name_prefix}${manifest.name}`;
            
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
            console.log(`✓ Manifest updated: ${manifest.name}`);
          });
        }
      })(),
      
      ...(isProd || isStaging ? [
        new ZipPlugin({
          filename: `srutilekhak-${env.environment}-${require('./package.json').version}.zip`
        })
      ] : [])
    ]
  };
};
