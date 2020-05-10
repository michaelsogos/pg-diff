# Changelog

#### ver 1.2.13
* Fixed a bug to retrieve the COLUMN DEFAULT VALUE because pg_attrdef.adsrc is deprecated
* Updated package "pg" to 8.1.0
* Fixed bug with field "relhasoids" because is deprecated in PG v12.x
* Fixed a bug to not include functions coming from external library (tested with pg_crypto and posgis)
* Excluded from compare objects created by EXTENSIONS
* Added initial support for POSGIS and PG_CRYPTO extensions (should be valid also for other extensions)
* Improved support for USER DEFINED data types (also if coming from extensions)

#### ver 1.2.12
* Improved support for postgres 9.6 in order to not fail looking for IDENTITY COLUMN

#### ver 1.2.11
* Added DEEP compare for JSON and JSONB objects
  
#### ver 1.2.10
* Added support for UUID data type

#### ver 1.2.9
* Added support to JSON and XML fields
* Improved VSCODE debugger launcher

#### ver 1.2.8
* Fixed issue when comparing data records without using TABLE SCHEMA from configuration file

#### ver 1.2.7
* Fix issue on saving SQL ERROR on migration history table

#### ver 1.2.6
* Fixed issues when comparing STRING value containing ' which wasn't properly escaped

#### ver 1.2.5
* Added support to DROP VIEW when missing
* Added support to DROP MATERIALIZED VIEW when missing
* Added support to DROP FUNCTION when missing

#### ver 1.2.4
* Added support to DROP missing table; #3
* Improved output messages
* Fixed a bug which miss a semicolumn creating a new SEQUENCE; #2
* Fixed a bug which a SEQUENCE is going to be RENAMED wrongly; #4
* Cleaned up CONSOLE.LOG

#### ver 1.2.3
* Fixed a bug on handling properly the sequence name on RENAME

#### ver 1.2.2
* Fixed a bug when RENAME SEQUENCE using full sequence name instead of just the its name

#### ver 1.2.1
* Added support to keep in memory schema changes useful to know during data compare
* Added support to include UPDATE SCRIPT during data compare for not yet available table columns because coming from ALTER TABLE during schema compare

#### ver 1.2.0
- Added support for SEQUENCES
- Fixed an issue which rebase sequences's next value even when tables records under data compare don't have differences
- Added support for SEQUENCE RENAME owned by table column
- Added support for SEQUENCE CACHE also for pgsql 9.x versions
- Fixed a bug on handling sequence privileges

#### ver 1.1.3
- Fixed a bug while comparing FUNCTIONS

#### ver 1.1.2
- Added the option to SAVE\REGISTER the patch on migration history table without executing the script, it is useful to keep updated SOURCE DATABASE from own created scripts and avoid issues when applying team member patches
- Added compatibility check between different PGSQL servers versions
- Fixed a bug when comparing DATETIME object

#### ver 1.1.1
- Fixed datatime issue between PGSQL timestamp data type and NodeJS Date object
- Fixed an issue when rebasing sequences

#### ver 1.1.0

- Fixed a bug comparing data between tables
- Improved sql patch generator evaluating objects dependencies
- Small code refactoring
- Improved data type recognition
- Refactored sql path generator to divide commands between DROP and CREATE, removed CHANGE script generator
- Added MIGRATION STRATEGY for patch execution
- Added USING expression for casting on ALTER COLUMN data type
- Improved and re-organized configuration file
- Improved data compare script generator, now with a single statement is possible to merge existing records on same table but in different database

#### ver 1.0.4

- Improved package information for NPM repository

#### ver 1.0.3

- Added option to generate idempotent sql code

#### ver 1.0.2

- Fixed small bugs
- Added records comparing and relative patch generator

#### ver 1.0.1

- Fix issue when publish on NPM repository

#### ver 1.0.0

- First working version to compare e generate patch file for (TABLES, INDEXES, VIEWS, MATERIALIZED VIEWS, FUNCTIONS)
