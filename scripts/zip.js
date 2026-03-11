#!/usr/bin/env node
"use strict";

var fs = require("fs");
var path = require("path");
var archiver = require("archiver");
var execSync = require("child_process").execSync;

var branch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim().replace(/\//g, "-");
var sha = execSync("git rev-parse --short HEAD").toString().trim();
var zipName = "webvowl-" + branch + "-" + sha + ".zip";
var deployDir = path.join(__dirname, "..", "deploy");

if (!fs.existsSync(deployDir)) {
	console.error("deploy/ directory not found — run `npm run build` first");
	process.exit(1);
}

var output = fs.createWriteStream(path.join(__dirname, "..", zipName));
var archive = archiver("zip", {zlib: {level: 9}});

output.on("close", function() {
	console.log("Created " + zipName + " (" + (archive.pointer() / 1024 / 1024).toFixed(2) + " MB)");
});

archive.on("error", function(err) { throw err; });
archive.pipe(output);
archive.directory(deployDir, false);
archive.finalize();
