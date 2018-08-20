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
                this.__compareTableOptions(table, sourceTables[table].options, targetTables[table].options);
                this.__compareTableColumns(table, sourceTables[table].columns, targetTables[table].columns);
                this.__compareTableConstraints(table, sourceTables[table].constraints, targetTables[table].constraints);
                this.__compareTableIndexes(sourceTables[table].indexes, targetTables[table].indexes);
                this.__compareTablePrivileges(table, sourceTables[table].privileges, targetTables[table].privileges);
            } else { //Table not exists on target database, then generate the script to create table
                this.__scripts.push(sql.generateCreateTableScript(table, sourceTables[table]));
            }
        }
    },
    __compareTableOptions: function(table, sourceTableOptions, targetTableOptions) {
        if (sourceTableOptions.withOids != targetTableOptions.withOids)
            this.__scripts.push(sql.generateChangeTableOptionsScript(table, sourceTableOptions));
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
    },
    __compareTableIndexes: function(sourceTableIndexes, targetTableIndexes) {
        for (let index in sourceTableIndexes) { //Get new or changed indexes            
            if (targetTableIndexes[index]) { //Table index exists on both database, then compare index definition
                if (sourceTableIndexes[index] != targetTableIndexes[index])
                    this.__scripts.push(sql.generateChangeIndexScript(index, sourceTableIndexes[index].definition));
            } else { //Table index not exists on target database, then generate script to add index                
                this.__scripts.push(sourceTableIndexes[index].definition);
            }
        }
        for (let index in targetTableIndexes) { //Get dropped indexes
            if (!sourceTableIndexes[index]) //Table index not exists on source, then generate script to drop index
                this.__scripts.push(sql.generateDropIndexScript(index))
        }
    },
    __compareTablePrivileges: function(table, sourceTablePrivileges, targetTablePrivileges) {
        for (let role in sourceTablePrivileges) { //Get new or changed role privileges            
            if (targetTablePrivileges[role]) { //Table grants for role exists on both database, then compare privileges
                let changes = {};

                if (sourceTablePrivileges[role].all != targetTablePrivileges[role].all)
                    changes.all = sourceTablePrivileges[role].all

                if (sourceTablePrivileges[role].select != targetTablePrivileges[role].select)
                    changes.select = sourceTablePrivileges[role].select

                if (sourceTablePrivileges[role].insert != targetTablePrivileges[role].insert)
                    changes.insert = sourceTablePrivileges[role].insert

                if (sourceTablePrivileges[role].update != targetTablePrivileges[role].update)
                    changes.update = sourceTablePrivileges[role].update

                if (sourceTablePrivileges[role].delete != targetTablePrivileges[role].delete)
                    changes.delete = sourceTablePrivileges[role].delete

                if (sourceTablePrivileges[role].truncate != targetTablePrivileges[role].truncate)
                    changes.truncate = sourceTablePrivileges[role].truncate

                if (sourceTablePrivileges[role].references != targetTablePrivileges[role].references)
                    changes.references = sourceTablePrivileges[role].references

                if (sourceTablePrivileges[role].trigger != targetTablePrivileges[role].trigger)
                    changes.trigger = sourceTablePrivileges[role].trigger

                if (Object.keys(changes).length > 0)
                    this.__scripts.push(sql.generateChangesTableRoleGrantsScript(table, role, changes))
            } else { //Table grants for role not exists on target database, then generate script to add role privileges                  
                this.__scripts.push(sql.generateTableRoleGrantsScript(table, role, sourceTablePrivileges[role]))
            }
        }
    }
}

module.exports = helper;