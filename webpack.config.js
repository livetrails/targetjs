const path = require('path');
const ESLintPlugin = require('eslint-webpack-plugin');
const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
    entry: './src/index.js',
    output: {
        library: {
            name: 'TargetJS',
            type: 'window'
        },
        environment: {
          arrowFunction: false
        },
        path: path.resolve(__dirname, './dist'),
        filename: 'targetjs.js'
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                include: path.resolve(__dirname, 'src'),          
                use: 'babel-loader'
            }
        ]
    },
    plugins: [
        new ESLintPlugin({
            exclude: ['node_modules', 'build'],
            overrideConfig: {
                env: {
                    browser: true,
                    es2021: true
                },
                extends: [
                    'eslint:recommended'
                ],
                parser: "@babel/eslint-parser",
                parserOptions: {
                    ecmaVersion: 12,
                    sourceType: 'module'
                },
                rules: {
                    'curly': 'error',
                    'eqeqeq': 'error',
                    'dot-notation': 'off',
                    'no-console': 'warn',
                    'no-loop-func': 'off',
                    'no-empty': 'off'
                }
            }
        })
    ],
    resolve: {
        extensions: ['.js']
    },
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          extractComments: false,
          terserOptions: {
            format: {
              comments: false
            }
          }
        })
      ]
    }
};
