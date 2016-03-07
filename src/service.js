"use strict";

const mssql = require('mssql'),
	sprintf = require('sprintf').sprintf,
	table = require('markdown-table');

var Connection = class Connection{
	static connect(config, callback) {
		process.stderr.write(sprintf("Connecting to %s ... ", config.server));
		mssql.connect(config, function(err) {
			if (err) {
				process.stderr.write("FAIL\n");
				process.stderr.write(err.toString());
				process.exit(1);
			}
			process.stderr.write("done\n");
			callback(new Connection(config));
		});
	}

	constructor(config) {
		this.verbose = config.verbose || false;
		this.timing = config.timing || false;
		this.stopOnError = true;
	}

	close() {
		mssql.close();
	}

	getRecords(recordset) {
		var results = [Object.keys(recordset[0])];
		for (var i=0; i<recordset.length; i++) {
			var obj = recordset[i];
			results.push(Object.keys(obj).map(key => obj[key]));
		}
		return results;
	}

	prepare(options, sql) {
		options.verbose = options.verbose || this.verbose;
		options.timing = options.timing || this.timing;
		options.silent = options.silent || false;

		if (sql.indexOf('-- cheetah/verbose ON') > -1) {
			options.verbose = true;
			sql = sql.replace('-- cheetah/verbose ON', '');
		}
		if (sql.indexOf('-- cheetah/timing ON') > -1) {
			options.timing = true;
			sql = sql.replace('-- cheetah/timing ON', '');
		}
		if (sql.indexOf('-- cheetah/verbose OFF') > -1) {
			options.verbose = false;
			sql = sql.replace('-- cheetah/verbose OFF', '');
		}
		if (sql.indexOf('-- cheetah/timing OFF') > -1) {
			options.timing = false;
			sql = sql.replace('-- cheetah/verbose OFF', '');
		}
		return sql;
	}

	batch(sql, callback, options) {
		options = options || {};
		sql = this.prepare(options, sql);
		var request = new mssql.Request(),
			started = new Date().getTime();

		request.multiple = true;

		if (options.verbose && !options.silent) {
			process.stdout.write("\n" + sql.trim().split(" ")[0]);
		}

		request.batch(sql, ((err, recordset) => {
			if (err) {
				process.stdout.write(sprintf("\nERROR: %s\n", err.toString()));
				if (this.stopOnError) {
					this.close();
					process.exit(1);
				}
				callback(recordset, sql);
				return;
			}

			if (!options.silent) {
				for (var i=0; i<recordset.length; i++) {
					var subrecordset = recordset[i];
					if (subrecordset && subrecordset.length > 0) {
						var md = table(this.getRecords(subrecordset))
						process.stdout.write("\n" + md);
					}
					if (recordset) {
						process.stdout.write(sprintf("\n(%d row%s)\n", subrecordset.length, ((subrecordset.length > 0) ? "s" : "")));
					}
				}
				if (options.timing) {
					process.stdout.write(sprintf("\nTime: %d ms\n", (new Date().getTime()) - started));
				}
			}
			callback(recordset, sql);
		}).bind(this));
	}

	run(sql, callback, options) {
		options = options || {};
		sql = this.prepare(options, sql);
		var batches = sql.split("\nGO\n").filter((batch) => {return batch.trim() != ''}),
			results = [],
			self = this;

		if (batches.length == 0) {
			callback(results, sql);
			return
		}

		var pipedCallback = ((recordset, batchsql) => {
			results.push(recordset);
			var idx = batches.indexOf(batchsql);
			if (idx == batches.length-1) {
				callback(results, sql);
			}
			else {
				this.batch(batches[idx+1], pipedCallback, options);
			}
		}).bind(this);

		this.batch(batches[0], pipedCallback, options);
	}
}

module.exports.connect = Connection.connect;
