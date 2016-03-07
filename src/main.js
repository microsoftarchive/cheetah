"use strict";

const cfg = require("./config"),
	fs = require('fs'),
	service = require("./service"),
	pr = require("./prompt");

function run() {
	var mgr = new Manager();

	if (config.isInteractive()) {
		mgr.runInteractive();
	}
	else if (config.isFromStdin()) {
		mgr.runStdin();
	}
	else if (config.filePath) {
		mgr.runFile();
	}
}

var Manager = class Manager{
	static run() {
		new Manager(new cfg.Config(process.argv)).run();
	}

	constructor(config) {
		this.config = config;
		this.run = this[this.mode];
	}

	get mode() {
		if (this.config.isInteractive()) {
			return 'interactive';
		}
		else if (this.config.isFromStdin()) {
			return 'stdin';
		}
		else if (this.config.filePath) {
			return 'file';
		}
	}

	stdin() {
		process.stderr.write("Reading from stdin ...\n");

		var sql = "";
		process.stdin.on('data', (chunk) => {
			sql += chunk.toString();
		});
		process.stdin.on('end', (() => {
			service.connect(this.config.options, (connection) => {
				connection.run(sql, (r) => {
					connection.close();
				});
			});
		}).bind(this));
	}

	file() {
		fs.readFile(this.config.filePath, 'utf8', ((err, sql) => {
			if (err) {
				process.stderr.write("ERROR: " + err.toString());
				process.exit(1);
			}
			service.connect(this.config.options, (connection) => {
				connection.run(sql, (r) => {
					connection.close();
				});
			});
		}).bind(this));
	}

	interactive() {
		service.connect(this.config.options, ((connection) => {
			connection.timing = true;
			connection.stopOnError = false;
			process.stderr.write("Type `help` for help\n");
			var p = new pr.Prompt(connection, this.config);
			p.listen();
		}).bind(this));
	}
}

module.exports.run = Manager.run;