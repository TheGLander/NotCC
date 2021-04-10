const path = require("path")
const HtmlWebpackPlugin = require("html-webpack-plugin")
const MinifyPlugin = require("babel-minify-webpack-plugin")
const ProgressPlugin = require("progress-webpack-plugin")
const CopyPlugin = require("copy-webpack-plugin")

const prod = process.env.NODE_ENV === "production"
let plugins = [
	new HtmlWebpackPlugin({
		template: "src/index.html",
	}),
	new CopyPlugin([{ from: "src/data", to: "data/" }]),
]
if (prod) plugins.push(new MinifyPlugin({}, { comments: false }))
else plugins.push(new ProgressPlugin())
module.exports = {
	entry: "./src/index.ts",
	output: {
		filename: "main.js",
		path: path.resolve(__dirname, "dist"),
		library: {
			name: "NotCC",
			export: "default",
			type: "umd",
		},
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
	resolve: { extensions: [".ts", ".js", ".json", ".jsonc"] },
	devtool: "source-map",
	/*optimization: {
		splitChunks: {
			cacheGroups: {
				default: false,
				vendor: {
					chunks: "all",
					name: "vendor",
					test: /node_modules/,
				},
			},
		},
	},
*/
}
