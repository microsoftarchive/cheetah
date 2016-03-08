"use strict";

const readline = require('readline'),
	sprintf = require('sprintf').sprintf;

const builtInCommands = {
	"\\d": [{
		cmd: `
		SELECT [TABLE_SCHEMA] AS [schema], [TABLE_NAME] AS [name], [TABLE_TYPE] AS [type]
		FROM [information_schema].[tables]
		ORDER BY [TABLE_SCHEMA], [TABLE_NAME];`
	}, {
		regexp: new RegExp('[\\[]*([^.\\]\\[]+)[\\]]*\.[\\[]*([^.\\]\\[]+)[\\]]*'),
		cmd: `
		SELECT [COLUMN_NAME] AS [column], [DATA_TYPE] AS [type], CASE WHEN [IS_NULLABLE] = 'NO' THEN 'not null' ELSE '' END AS [modifiers]
		FROM information_schema.columns
		WHERE [TABLE_SCHEMA] = '$1' AND [TABLE_NAME] = '$2'
		ORDER BY [ORDINAL_POSITION] ASC;`
	}],
	"\\dt": [{
		cmd: `
		SELECT [TABLE_SCHEMA] AS [schema], [TABLE_NAME] AS [name], [TABLE_TYPE] AS [type]
		FROM [information_schema].[tables]
		WHERE [TABLE_TYPE] = 'BASE TABLE'
		ORDER BY [TABLE_SCHEMA], [TABLE_NAME];`
	}],
	"\\dv": [{
		cmd: `
		SELECT [TABLE_SCHEMA] AS [schema], [TABLE_NAME] AS [name], [TABLE_TYPE] AS [type]
		FROM [information_schema].[tables]
		WHERE [TABLE_TYPE] = 'VIEW'
		ORDER BY [TABLE_SCHEMA], [TABLE_NAME];`
	}]
};

const staticCommands = {
	"help": (p) => {
		process.stdout.write("\nCommands:")
		process.stdout.write("\n  \\d \t\tLists tables and views")
		process.stdout.write("\n  \\dt \t\tLists tables")
		process.stdout.write("\n  \\dv \t\tLists views")
		process.stdout.write("\n  \\d TABLE \tDescribes table schema")
		process.stdout.write("\n  \\q \t\tQuit")
		process.stdout.write("\n")
		process.stdout.write("Other commands:")
		process.stdout.write("\n  \\u \t\tUpdates available suggestions")
		process.stdout.write("\n")
		p.reset();
	},
	"\\q": (p) => {
		p.close();
	},
	"\\u": (p) => {
		p.updateAvailableSuggestions();
		p.reset();
	}
}

const suggestionCollector = `
	SELECT QUOTENAME([TABLE_SCHEMA]) + '.' + QUOTENAME([TABLE_NAME]) AS [table], QUOTENAME([COLUMN_NAME]) AS [column]
	FROM information_schema.columns
	ORDER BY [TABLE_SCHEMA], [TABLE_NAME], [ORDINAL_POSITION];`;

var Prompt = class Prompt{
	constructor(connection, config) {
		this.connection = connection;
		this.config = config;
		this.sql = '';
		this.rs = {};

		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
			completer: this.completer.bind(this),
			historySize: 150
		});
		this.rl.on('line', this.actionOnLine.bind(this));
		this.rl.on('SIGINT', this.closeOrReset.bind(this));
		this.updateAvailableSuggestions();
	}

	get newPrompt() {
		return sprintf('%s/%s= ', this.config.options.user, this.config.options.database);
	}

	get resumePrompt() {
		return '-> ';
	}

	updateAvailableSuggestions() {
		this.connection.batch(suggestionCollector, ((r) => {
			this.rs = {};
			for (var i=0; i<r[0].length; i++) {
				var obj = r[0][i];
				if (!this.rs[obj.table]) {
					this.rs[obj.table] = [obj.column];
				}
				else {
					this.rs[obj.table].push(obj.column);
				}
			}
		}).bind(this), {silent: true});
	}

	getAvailableSuggestions(line) {
		var suggestions = Object.keys(this.rs);
		var usedTables = Object.keys(this.rs).filter((t) => {
			return line.indexOf(t) != -1;
		});
		for (var i=0; i<usedTables.length; i++) {
			suggestions.push.apply(suggestions,this.rs[usedTables[i]]);
		}
		return suggestions.filter((s, pos) => {
			return suggestions.indexOf(s) == pos;
		});
	}

	completer(cmd) {
		var quoteName = (name) => {
			var re = new RegExp("[\\[]*([^\\[\\]]+)[\\]]*"),
				unquoted = name.match(re)[1];
			return sprintf("[%s]", unquoted);
		}
		var words = cmd.split(" "),
			origWord = words.slice(-1)[0],
			line = this.sql + "\n" + this.rl.line,
			allSuggestions = this.getAvailableSuggestions(line);

		var word = origWord.split(".").map(quoteName).join(".");
		word = word.substring(0, word.length-1);

		var hits = allSuggestions.filter((c) => {
			return c.indexOf(word) == 0;
		});

		if (hits.length == 1) {
			var craftedSuggestions = [cmd.substring(0, cmd.length-origWord.length) + hits[0]], // set the suggestion
				leftOriginalLine = cmd.substring(0, cmd.length-origWord.length) + word, // add quotes to the left side
				rightOriginalLine = this.rl.line.slice(cmd.length); // grab the right side of the original cmd

			// WARNING: Awful hack & completly ignores the readline functionality!
			this.rl.line = craftedSuggestions[0] + rightOriginalLine;
			this.rl.cursor = craftedSuggestions[0].length;
			craftedSuggestions = [""];
		}
		else if (hits.length == 0 || hits.length > 10) {
			var craftedSuggestions = [];
		}
		else {
			var craftedSuggestions = hits;
		}

		return [craftedSuggestions, cmd];
	}

	listen() {
		this.rl.setPrompt(this.newPrompt);
		this.rl.prompt();
	}

	close() {
		this.rl.close();
		this.connection.close();
		process.exit(1);
	}

	reset() {
		this.sql = '';
		this.rl.setPrompt(this.newPrompt);
		this.rl.prompt();
	}

	closeOrReset() {
		process.stdout.write("^C\n")
		if (this.isEmptyCommand()) {
			this.close();
		}
		this.rl.clearLine(0);
		this.reset();
	}

	isEmptyCommand() {
		return this.sql == '';
	}

	getBuiltInCommand(cmd) {
		var fCmd = cmd.split(" ")[0];
		if (!builtInCommands[fCmd]) {
			return null;
		}
		var param = (cmd.split(" ").length > 1)
			? cmd.slice(-1*(cmd.length-fCmd.length-1))
			: null;
		return this._getBuiltInCommand(fCmd, param);
	}

	_getBuiltInCommand(cmd, params) {
		for (var i=0; i<builtInCommands[cmd].length; i++) {
			var opt = builtInCommands[cmd][i];
			if (!opt['regexp'] && !params) {
				return opt.cmd;
			}
			if (!opt['regexp'] && params) {
				continue;
			}
			var match = params.match(opt.regexp);
			if (!match) {
				continue;
			}
			var finalCmd = opt.cmd;
			for (var j=0; j<match.length; j++) {
				finalCmd = finalCmd.replace(sprintf("$%d", j), match[j]);
			}
			return finalCmd;
		}
	}

	isBuiltInCommand(cmd) {
		return this.getBuiltInCommand(cmd) != null;
	}

	runBuiltInSingleCommand(cmd) {
		this.connection.batch(this.getBuiltInCommand(cmd), ((rs) => {
			this.rl.prompt();
		}).bind(this));
	}

	runBatch() {
		this.connection.batch(this.sql, ((rs) => {
			this.reset();
		}).bind(this));
	}

	extendBatchCommand(cmd) {
		this.sql += cmd + "\n";
		this.rl.setPrompt(this.newPrompt);
		this.rl.prompt();
	}

	extendBatchResumedCommand(cmd) {
		this.sql += cmd + "\n";
		this.rl.setPrompt(this.resumePrompt);
		this.rl.prompt();
	}

	actionOnLine(cmd) {
		var tCmd = cmd.trim();

		if (this.isEmptyCommand() && staticCommands[tCmd]) {
			staticCommands[tCmd](this);
		}
		else if (this.isEmptyCommand() && this.isBuiltInCommand(tCmd)) {
			this.runBuiltInSingleCommand(tCmd);
		}
		else if (tCmd.toUpperCase() == "GO") {
			this.runBatch();
		}
		else if (tCmd.slice(-1) == ";") {
			this.extendBatchCommand(cmd);
		}
		else {
			this.extendBatchResumedCommand(cmd);
		}
	}
}

module.exports.Prompt = Prompt;
