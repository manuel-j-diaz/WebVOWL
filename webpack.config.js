const path = require("path");
const webpack = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const pkg = require("./package.json");

module.exports = function(env, argv) {
	const isRelease = argv && argv.mode === "production";

	return {
		cache: true,
		entry: {
			webvowl: "./src/webvowl/js/entry.js",
			"webvowl.app": "./src/app/js/entry.js"
		},
		output: {
			path: path.join(__dirname, "deploy/"),
			publicPath: "",
			filename: "js/[name].js",
			chunkFilename: "js/[chunkhash].js",
			library: {
				name: "[name]",
				type: "assign"
			}
		},
		optimization: {
			minimize: isRelease,
			usedExports: true,
			concatenateModules: isRelease,
			splitChunks: false
		},
		module: {
			rules: [
				{test: /\.css$/, use: [MiniCssExtractPlugin.loader, "css-loader"]}
			]
		},
		plugins: [
			new CopyWebpackPlugin({
				patterns: [
					{context: "src/app", from: "data/**/*"},
					{from: "node_modules/d3/dist/d3.min.js", to: "js/d3.min.js"},
					{from: "src/favicon.ico", to: "favicon.ico"},
					{from: "license.txt", to: "license.txt"}
				]
			}),
			new MiniCssExtractPlugin({filename: "css/[name].css"}),
			new webpack.ProvidePlugin({
				d3: "d3"
			}),
			new webpack.DefinePlugin({
				__WEBVOWL_VERSION__: JSON.stringify(pkg.version)
			}),
			new HtmlWebpackPlugin({
				template: "src/index.html",
				filename: "index.html",
				inject: false,
				templateParameters: {version: pkg.version, isRelease: isRelease}
			})
		],
		externals: {
			"d3": "d3"
		},
		devServer: {
			static: {directory: path.join(__dirname, "deploy")},
			open: true
		}
	};
};
