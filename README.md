# cheetah

Command line interface for MSSQL that works in OSX and Linux. It also supports [Azure SQL Data Warehouse](https://azure.microsoft.com/en-us/services/sql-data-warehouse/). The package was heavily inspired by [psql](http://www.postgresql.org/docs/9.2/static/app-psql.html) (PostgreSQL), [sql-cli](https://github.com/hasankhan/sql-cli) and [sqlcmd](https://msdn.microsoft.com/en-us/library/ms162773.aspx) (MSSQL).

The tool is **under development**, please use it with caution as it has no test coverage!

## Installation

You have to install [NodeJS](https://nodejs.org) (at least 5.6+) to use this package. 

```sh
$ git clone https://github.com/wunderlist/cheetah.git
$ cd cheetah
$ npm install -g
```

The package is not available via `npm` at the moment.

## Usage

It's quite simple.

```
Usage: cheetah [file]

Options:

  -h, --help                          output usage information
  -V, --version                       output the version number
  -S, --server <server>               server or hostname
  -p, --port <port>                   port
  -U, --username <user>               login id
  -P, --password <password>           password
  -d, --database <database>           use database name
  -l, --login-timeout <logintimeout>  login timeout
  -t, --query-timeout <querytimout>   query timeout
  -I, --interactive                   interactive interface for query running
  --encrypt                           encrypt connection
  --timing                            print timing informations
  --verbose                           print statements for debugging
```

You can also define a few environment variable if you don't want to specify these attributes everytime.

```sh
export MSSQL_HOST='host'
export MSSQL_PORT='1433'
export MSSQL_DATABASE='database'
export MSSQL_USER='username'
export MSSQL_PASSWORD='password'
export MSSQL_ENCRYPT='true' # `true` for azure
``` 

### Executing files

You can execute files with the following commands:

```sh
$ cat query.sql | cheetah
$ cheetah query.sql
```

Do not forget, you have to use the `GO` command to specify the batches!

Furthermore, you can specify the debugging settings within the file if you want.

```sql
-- cheetah/timing ON
-- cheetah/verbose ON
```

### Interactive mode

You can start the interactive mode with the following command:

```sh
$ cheetah -I
```

It contains a few built-in commands inspired by `psql`.

```
Commands:
  \d 		Lists tables and views
  \dt 		Lists tables
  \dv 		Lists views
  \d TABLE 	Describes table schema
  \q 		Quit

Other commands:
  \u 		Updates available suggestions
```

You have to use the `GO` command when you want to execute your previous commands.

The package supports multi-line queries and copy-paste. Moreover it provides auto-complete like suggestions for tables and columns with the quoted form.

## What's next

- Show affected rows' number.

## License

Copyright © 2016, Microsoft

Distributed under the MIT License.

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
