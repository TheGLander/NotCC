const path = require("path")
const HtmlWebpackPlugin = require("html-webpack-plugin")
const MinifyPlugin = require("babel-minify-webpack-plugin")
const ProgressPlugin = require("progress-webpack-plugin")

const prod = process.env.NODE_ENV === "production"
let plugins = [
	new HtmlWebpackPlugin({
		template: "src/index.html",
	}),
	new ProgressPlugin(),
]
if (prod) plugins.push(new MinifyPlugin({}, { comments: false }))
module.exports = {
	entry: "./src/index.ts",
	output: {
		filename: "main.js",
		library: "NotCC",
		libraryTarget: "umd",
		path: path.resolve(__dirname, "dist"),
	},
	mode: prod ? "production" : "development",
	plugins: plugins,
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: "ts-loader",
				exclude: /node_modules/,
			},
			{
				test: /\.css$/i,
				use: ["style-loader", "css-loader"],
				exclude: /node_modules/,
			},
		],
	},
	watch: !prod,
	resolve: { extensions: [".ts", ".js", ".json"] },
}
