const sql = require('./sql')

var helper = {
    __scripts: [],
    compareDatabaseObjects: function(sourceSchema, targetSchema) {
        this.__compareSchemas(sourceSchema.schemas, targetSchema.schemas);
        this.__compareTables(sourceSchema.tables, targetSchema.tables);
    },
    __compareSchemas: function(sourceSchemas, targetSchemas) {
        for (let schema in sourceSchemas) { //Get missing schemas on target
            if (!targetSchemas[schema]) { //Schema not exists on target database, then generate script to create schema
                this.__scripts.push(sql.generateCreateSchemaScript(schema, sourceSchemas[schema].owner));
            }
        }
    },
    __compareTables: function(sourceTables, targetTables) {
        for (let table in sourceTables) { //Get new or changes tables
            if (targetTables[table]) { //Table exists on both database, then compare table schema
                this.__compareTableColumns(table, sourceTables[table].columns, targetTables[table].columns);
                this.__compareTableConstraints(table, sourceTables[table].constraints, targetTables[table].constraints);
            } else { //Table not exists on target database, then generate the script to create table
                this.__scripts.push(sql.generateCreateTableScript(table, sourceTables[table]));
            }
        }
    },
    __compareTableColumns: function(table, sourceTableColumns, targetTableColumns) {
        for (let column in sourceTableColumns) { //Get new or changed columns
            if (targetTableColumns[column]) { //Table column exists on both database, then compare column schema
                this.__compareTableColumn(table, column, sourceTableColumns[column], targetTableColumns[column]);
            } else { //Table column not exists on target database, then generate script to add column
                this.__scripts.push(sql.generateAddTableColumnScript(table, column, sourceTableColumns[column]));
            }
        }
        for (let column in targetTableColumns) { //Get dropped columns
            if (!sourceTableColumns[column]) //Table column not exists on source, then generate script to drop column
                this.__scripts.push(sql.generateDropTableColumnScript(table, column))
        }
    },
    __compareTableColumn: function(table, column, sourceTableColumn, targetTableColumn) {
        let changes = {};

        if (sourceTableColumn.nullable != targetTableColumn.nullable)
            changes.nullable = sourceTableColumn.nullable;

        if (sourceTableColumn.datatype != targetTableColumn.datatype ||
            sourceTableColumn.precision != targetTableColumn.precision ||
            sourceTableColumn.scale != targetTableColumn.scale) {
            changes.datatype = sourceTableColumn.datatype;
            changes.precision = sourceTableColumn.precision;
            changes.scale = sourceTableColumn.scale;
        }

        if (sourceTableColumn.default != targetTableColumn.default)
            changes.default = sourceTableColumn.default;

        if (Object.keys(changes).length > 0)
            this.__scripts.push(sql.generateChangeTableColumnScript(table, column, changes));

    },
    __compareTableConstraints: function(table, sourceTableConstraints, targetTableConstraints) {
        for (let constraint in sourceTableConstraints) { //Get new or changed constraint
            if (targetTableConstraints[constraint]) { //Table constraint exists on both database, then compare column schema
                if (sourceTableConstraints[constraint] != targetTableConstraints[constraint])
                    this.__scripts.push(sql.generateChangeTableConstraintScript(table, constraint, sourceTableConstraints[constraint]));
            } else { //Table constraint not exists on target database, then generate script to add constraint
                this.__scripts.push(sql.generateAddTableConstraintScript(table, constraint, sourceTableConstraints[constraint]));
            }
        }
        for (let constraint in targetTableConstraints) { //Get dropped constraints
            if (!sourceTableConstraints[constraint]) //Table constraint not exists on source, then generate script to drop constraint
                this.__scripts.push(sql.generateDropTableConstraintScript(table, constraint))
        }
    }
}

module.exports = helper;