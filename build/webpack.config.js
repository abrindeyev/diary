const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCSSPlugin = require('optimize-css-assets-webpack-plugin');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const WebpackAutoInject = require('webpack-auto-inject-version');

const path = require('path');

function resolvePath(dir) {
  return path.join(__dirname, '..', dir);
}

const fs = require('fs');
const env = process.env.NODE_ENV || 'development';
const target = process.env.TARGET || 'web';

env.minor = true;

// module.exports = (env = {patch: true}) => { return {
module.exports = {
  mode: env,
  entry: [
    './src/js/app.js',
  ],
  output: {
    path: resolvePath('stitch/hosting/files'),
    filename: 'js/app.js',
    publicPath: '',
  },
  resolve: {
    extensions: ['.js', '.vue', '.json'],
    alias: {
      vue$: 'vue/dist/vue.esm.js',
      '@': resolvePath('src'),
    },
  },
  devtool: env === 'production' ? 'source-map' : 'eval',
  devServer: {
    hot: true,
    open: true,
    compress: true,
    contentBase: '/stitch/hosting/files/',
    disableHostCheck: true,
    https: {
      key: fs.readFileSync('local/key.pem'),
      cert: fs.readFileSync('local/localhost.pem'),
      ca: fs.readFileSync('local/ca.pem'),
    },
    port: 8443,
    watchOptions: {
      poll: true,
    },
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        use: 'babel-loader',
        include: [
          resolvePath('src'),
          resolvePath('node_modules/framework7'),
          resolvePath('node_modules/framework7-vue'),
          resolvePath('node_modules/framework7-react'),
          resolvePath('node_modules/template7'),
          resolvePath('node_modules/dom7'),
          resolvePath('node_modules/ssr-window'),
        ],
      },
      {
        test: /\.f7.html$/,
        use: [
          'babel-loader',
          {
            loader: 'framework7-component-loader',
            options: {
              helpersPath: './src/template7-helpers-list.js',
            },
          },
        ],
      },

      {
        test: /\.css$/,
        use: [
          (env === 'development' ? 'style-loader' : {
            loader: MiniCssExtractPlugin.loader,
            options: {
              publicPath: '../'
            }
          }),
          'css-loader',
          'postcss-loader',
        ],
      },
      {
        test: /\.styl(us)?$/,
        use: [
          (env === 'development' ? 'style-loader' : {
            loader: MiniCssExtractPlugin.loader,
            options: {
              publicPath: '../'
            }
          }),
          'css-loader',
          'postcss-loader',
          'stylus-loader',
        ],
      },
      {
        test: /\.less$/,
        use: [
          (env === 'development' ? 'style-loader' : {
            loader: MiniCssExtractPlugin.loader,
            options: {
              publicPath: '../'
            }
          }),
          'css-loader',
          'postcss-loader',
          'less-loader',
        ],
      },
      {
        test: /\.(sa|sc)ss$/,
        use: [
          (env === 'development' ? 'style-loader' : {
            loader: MiniCssExtractPlugin.loader,
            options: {
              publicPath: '../'
            }
          }),
          'css-loader',
          'postcss-loader',
          'sass-loader',
        ],
      },
      {
        test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
        loader: 'url-loader',
        options: {
          limit: 10000,
          name: 'images/[name].[ext]',
        },
      },
      {
        test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/,
        loader: 'url-loader',
        options: {
          limit: 10000,
          name: 'media/[name].[ext]',
        },
      },
      {
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
        loader: 'url-loader',
        options: {
          limit: 10000,
          name: 'fonts/[name].[ext]',
        },
      },
    ],
  },
  plugins: [
    new WebpackAutoInject({
      PACKAGE_JSON_PATH: './package.json',
      components: {
        AutoIncreaseVersion: true,
        InjectAsComment: true,
        InjectByTag: true
      }
    }),

    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(env),
      'process.env.TARGET': JSON.stringify(target),
    }),

    ...(env === 'production' ? [
      // Production only plugins
      new UglifyJsPlugin({
        uglifyOptions: {
          warnings: false,
        },
        sourceMap: true,
        parallel: true,
      }),
      new OptimizeCSSPlugin({
        cssProcessorOptions: {
          safe: true,
          map: { inline: false },
        },
      }),
      new webpack.optimize.ModuleConcatenationPlugin(),
    ] : [
      // Development only plugins
      new webpack.HotModuleReplacementPlugin(),
      new webpack.NamedModulesPlugin(),
    ]),
    new HtmlWebpackPlugin({
      filename: './index.html',
      template: './src/index.html',
      inject: true,
      minify: env === 'production' ? {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        useShortDoctype: true
      } : false,
    }),
    new MiniCssExtractPlugin({
      filename: 'css/app.css',
    }),
    new CopyWebpackPlugin([
      {
        from: resolvePath('src/static'),
        to: resolvePath('stitch/hosting/files/static'),
      },

    ]),


  ],
};

if (env == "development") {
  module.exports.devServer.port = 8443;
  module.exports.devServer.https = {
      key: fs.readFileSync('local/key.pem'),
      cert: fs.readFileSync('local/localhost.pem'),
      ca: fs.readFileSync('local/ca.pem'),
    };
}
