const HtmlWebpackPlugin = require("html-webpack-plugin");
const ModuleFederationPlugin =
  require("webpack").container.ModuleFederationPlugin;
const path = require("path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

const getCssLoaders = (env, type) => {
  const isEnvDevelopment = env === "development";
  let importLoaders = 0;

  if (type === "css") {
    // The option importLoaders allows you to configure how many loaders before
    // css-loader should be applied to @imported resources.
    // https://stackoverflow.com/questions/52544620/what-is-exactly-the-importloaders-option-of-css-loader-in-webpack-4
    importLoaders = 1;
  }

  return [
    isEnvDevelopment ? "style-loader" : MiniCssExtractPlugin.loader,
    {
      loader: "css-loader",
      options: {
        sourceMap: true,
        importLoaders,
        modules: {
          localIdentName: "[name]__[local]___[hash:base64:5]",
        },
      },
    },
  ];
};

module.exports = (env, options) => {
  return [
    {
      name: "app",
      entry: "./src/index",
      mode: options.mode,
      devServer: {
        static: [
          {
            directory: path.join(__dirname, "dist"),
          },
          {
            directory: path.join(__dirname, ".wp_federation"),
          },
        ],
        port: 3002,
      },
      output: {
        publicPath: "auto",
      },
      resolve: {
        extensions: [".ts", ".tsx", ".js"],
      },
      module: {
        rules: [
          {
            test: /\.css$/,
            use: getCssLoaders(options.mode, "css"),
          },
          {
            test: /bootstrap\.tsx$/,
            loader: "bundle-loader",
            options: {
              lazy: true,
            },
          },
          {
            test: /\.tsx?$/,
            loader: "babel-loader",
            exclude: /node_modules/,
            options: {
              presets: ["@babel/preset-react", "@babel/preset-typescript"],
            },
          },
        ],
      },
      plugins: [
        new ModuleFederationPlugin({
          name: "app2",
          filename: "remoteEntry.js",
          exposes: {
            "./Button": "./src/Button",
          },
          shared: ["react", "react-dom"],
        }),
        new HtmlWebpackPlugin({
          template: "./public/index.html",
        }),
        new MiniCssExtractPlugin({
          filename: "[name].[contenthash:8].css",
        }),
      ],
    },
    {
      name: "dts",
      entry: ["./src/Button"],
      mode: "development",
      output: {
        publicPath: "auto",
      },
      resolve: {
        extensions: [".ts", ".tsx", ".js"],
      },
      module: {
        rules: [
          {
            test: /\.css$/,
            use: getCssLoaders("development", "css"),
          },
          {
            test: /\.tsx?$/,
            loader: "babel-loader",
            exclude: /node_modules/,
            options: {
              presets: ["@babel/preset-react", "@babel/preset-typescript"],
            },
          },
          {
            test: /\.tsx?$/,
            exclude: /node_modules/,
            use: [
              {
                loader: "dts-loader",
                options: {
                  name: "app2",
                  exposes: {
                    "./Button": "./src/Button",
                  },
                },
              },
            ],
          },
        ],
      },
    },
  ];
};
