# Changelog

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
