const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = (argv, env) => {
  const isDev = argv.mode === 'development';

  const plugins = [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'public', 'index.html'),
      minify: isDev
        ? false
        : {
            collapseWhitespace: true,
            removeComments: true,
            removeRedundantAttributes: true,
            useShortDoctype: true
          }
    }),
    !isDev && new MiniCssExtractPlugin({
      filename: 'css/[name].[contenthash:8].css',
      chunkFilename: 'css/[id].[contenthash:8].css'
    })
  ];

  if (!isDev && process.env.ANALYZE === 'true') {
    plugins.push(
      new BundleAnalyzerPlugin({
        analyzerMode: 'server',
        analyzerHost: '0.0.0.0',
        analyzerPort: 8888,
        openAnalyzer: false
      })
    );
  }

  return {
    mode: isDev ? 'development' : 'production',
    entry: path.resolve(__dirname, 'src', 'index.tsx'),
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'js/[contenthash:8].js',
      assetModuleFilename: 'assets/[hash][etc][query]',
      clean: true,
      publicPath: '/'
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.jsx', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    module: {
      rules: [
        {
          test: /.[jt]sx?$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'babel-loader',
              options: {
                presets: [
                  [
                    '@babel/preset-env',
                    {
                      targets: 'defaults',
                      modules: false
                    }
                  ],
                  ['@babel/preset-react', { runtime: 'automatic' }],
                  '@babel/preset-typescript'
                ]
              }
            }
          ]
        },
        {
          test: /.css$/i,
          use: [
            isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: {
                importLoaders: 1,
                modules: true
              }
            }
          ]
        },
        {
          test: /.s[ac]ss$/i,
          use: [
            isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: {
                importLoaders: 2
              }
            },
            'sass-loader'
          ]
        },
        {
          test: /.(png|webp|jpe?g|gif|ico|svg|avif)$/i,
          type: 'asset/resource'
        },
        {
          test: /.(woff2?|eot|ttf|otf)$/i,
          type: 'asset/resource'
        }
      ]
    },
    plugins: plugins.filter(Boolean),
    devServer: {
      static: path.resolve(__dirname, 'dist'),
      historyApiFallback: true,
      port: 3000,
      open: false,
      hot: true
    },
    devtool: isDev ? 'eval-source-map' : 'source-map',
    optimization: {
      splitChunks: {
        chunks: 'all'
      }
    },
    cache: {
      type: 'filesystem',
      cacheDirectory: path.resolve(__dirname, '.webpack-cache')
    }
  }
}