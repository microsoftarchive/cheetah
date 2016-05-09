"use strict";

const packages = require("../package.json");

var Config = class Config{
	constructor(argv) {
		this.cmd = require("commander");
		this.cmd.version(packages.version)
			.usage('[file]')
			.option('-S, --server <server>', 'server or hostname')
			.option('-p, --port <port>', 'port')
			.option('-U, --username <user>', 'login id')
			.option('-P, --password <password>', 'password')
			.option('-d, --database <database>', 'use database name')
			.option('-l, --login-timeout <logintimeout>', 'login timeout', 999999)
			.option('-t, --query-timeout <querytimout>', 'query timeout', 999999)
			.option('-I, --interactive', 'interactive interface for query running')
			.option('--encrypt', 'encrypt connection')
			.option('--timing', 'print timing informations')
			.option('--verbose', 'print statements for debugging');

		this.cmd.parse(argv);

		if (this.cmd.args.length > 1) {
			this.cmd.help();
			progress.exit(1);
		}
		if (!this.isCorrect()) {
			process.stderr.write("\nServer, port and username are required. Please set at least these attributes!\n");
			this.cmd.help();
			progress.exit(1);
		}
	}

	isInteractive() {
		return (this.cmd.interactive || false) && this.isFromStdin();
	}

	isFromStdin() {
		return (this.cmd.args.length == 0);
	}
	
	isCorrect() {
		var opt =  this.options;
		return opt.user && opt.server && opt.port;
	}

	get filePath() {
		return this.cmd.args[0];
	}

	get options() {
		return {
			user: (this.cmd.username || process.env['MSSQL_USER'] || "").trim(),
			password: (this.cmd.password || process.env['MSSQL_PASSWORD'] || "").trim(),
			server: (this.cmd.server || process.env['MSSQL_HOST'] || "").trim(),
			database: (this.cmd.database || process.env['MSSQL_DATABASE'] || "").trim(),
			requestTimeout: this.cmd.queryTimeout,
			connectionTimeout: this.cmd.loginTimeout,
			port: (this.cmd.port || process.env['MSSQL_PORT'] || "").trim(),
			verbose: this.cmd.verbose || false,
			timing: this.cmd.timing || false,
			options: {
				tdsVersion: null,
				encrypt: this.cmd.encrypt || ((process.env['MSSQL_ENCRYPT'] || '').trim() == 'true'),
				requestTimeout: null
			}
		};
	}
}

module.exports.Config = Config;
