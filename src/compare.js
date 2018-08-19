const sql = require('./sql')

var helper = {
    __scripts: [],
    compareSchema: function(sourceSchema, targetSchema) {
        this.__compareTables(sourceSchema.tables, targetSchema.tables);
    },
    __compareTables: function(sourceTables, targetTables) {
        for (let table in sourceTables) {
            if (targetTables[table]) { //Table exists on both database, then compare table schema
                this.__compareTableColumns(table, sourceTables[table].columns, targetTables[table].columns)
            } else { //Table not exists on target database, then generate the script to create table
                this.__scripts.push(sql.generateCreateTableScript(table, sourceTables[table]))
            }
        }
    },
    __compareTableColumns: function(table, sourceTableColumns, targetTableColumns) {
        for (let column in sourceTableColumns) {
            if (targetTableColumns[column]) { //Table column exists on both database, then compare column schema
                this.__compareTableColumn(table, column, sourceTableColumns[column], targetTableColumns[column])
            } else { //Table column not exists on target database, then generate script to add column
                this.__scripts.push(sql.generateAddTableColumnScript(table, column, sourceTableColumns[column]))
            }
        }
    },
    __compareTableColumn: function(table, column, sourceTableColumn, targetTableColumn) {
        let changes = {}

        if (sourceTableColumn.nullable != targetTableColumn.nullable)
            changes.nullable = sourceTableColumn.nullable

        if (sourceTableColumn.datatype != targetTableColumn.datatype ||
            sourceTableColumn.precision != targetTableColumn.precision ||
            sourceTableColumn.scale != targetTableColumn.scale) {
            changes.datatype = sourceTableColumn.datatype
            changes.precision = sourceTableColumn.precision
            changes.scale = sourceTableColumn.scale
        }

        if (sourceTableColumn.default != targetTableColumn.default)
            changes.default = sourceTableColumn.default

        if (Object.keys(changes).length > 0)
            this.__scripts.push(sql.generateChangeTableColumnScript(table, column, changes))

    }
}

module.exports = helper;