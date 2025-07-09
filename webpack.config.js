const path = require('path');
const HTMLWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  // Chế độ build (dev/prod)
  mode: process.env.NODE_ENV || 'development',

  // File đầu vào
  entry: './src/index.js',

  // File đầu ra
  output: {
    library: 'DrawingTool',
    libraryTarget: 'umd',
    libraryExport: 'default',
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js',
    clean: true, // Xoá sạch thư mục dist trước mỗi lần build
    publicPath: '/'
  },

  // Cấu hình loader
  module: {
    rules: [
      // JavaScript
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: ['babel-loader']
      },

      // SCSS với PostCSS và Dart Sass
      {
        test: /\.scss$/,
        use: [
          'style-loader',
          'css-loader',
          'postcss-loader',
          {
            loader: 'sass-loader',
            options: {
              implementation: require('sass') // dùng Dart Sass mới
            }
          }
        ]
      },

      // Hình ảnh (PNG, JPG, SVG...)
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/images/[name][ext]'
        }
      },

      // Font (woff, ttf, eot...)
      {
        test: /\.(woff2?|ttf|eot)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/fonts/[name][ext]'
        }
      }
    ]
  },

  // Plugins
  plugins: [
    new HTMLWebpackPlugin({
      template: path.resolve(__dirname, 'index.html')
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public', to: '.' } // copy tất cả file từ ./public vào ./dist
      ]
    })
  ],

  // Dev server
  devServer: {
    static: {
      directory: path.resolve(__dirname, 'dist')
    },
    historyApiFallback: true, // hỗ trợ SPA
    open: true,                // tự mở trình duyệt
    compress: true,
    port: 3000
  },

  // Source maps cho debug
  devtool: process.env.NODE_ENV === 'production'
    ? 'source-map'
    : 'eval-cheap-module-source-map'
};
