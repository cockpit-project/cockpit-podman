const path = require("path");

module.exports = {
    entry: ["./src/index.js"],
    output: {
        filename: "bundle.js",
        path: path.resolve(__dirname, "build")
    },
    module: {
        rules: [
            {
              exclude: /node_modules/,
              loader: 'babel-loader',
              test: /\.js$/
            }
        ]
    }
}
