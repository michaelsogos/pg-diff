const sql = require('./sqlScriptGenerator')
const { Progress } = require('clui');
const chalk = require('chalk');

var helper = {
    __finalScripts: [],
    __tempScripts: [],
    __progressBar: new Progress(20),
    __progressBarValue: 0.0,
    __updateProgressbar: function(value, label) {
        this.__progressBarValue = value;
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(this.__progressBar.update(this.__progressBarValue) + ' - ' + chalk.whiteBright(label));
    },
    __appendScripts: function(actionLabel) {
        if (this.__tempScripts.length > 0) {
            this.__finalScripts.push(`\n--- BEGIN ${actionLabel} ---\n`);
            this.__finalScripts = this.__finalScripts.concat(this.__tempScripts);
            this.__finalScripts.push(`\n--- END ${actionLabel} ---\n`);
        }
    },
    __compareSchemas: function(sourceSchemas, targetSchemas) {
        this.__updateProgressbar(this.__progressBarValue + 0.0001, 'Comparing schemas');
        const progressBarStep = 0.1999 / Object.keys(sourceSchemas).length;

        for (let schema in sourceSchemas) { //Get missing schemas on target
            this.__updateProgressbar(this.__progressBarValue + progressBarStep, `Comparing SCHEMA ${schema}`);
            this.__tempScripts = [];

            if (!targetSchemas[schema]) { //Schema not exists on target database, then generate script to create schema
                this.__tempScripts.push(sql.generateCreateSchemaScript(schema, sourceSchemas[schema].owner));
            }

            this.__appendScripts(`CREATE SCHEMA ${schema}`);
        }
    },
    __compareTables: function(sourceTables, targetTables) {
        this.__updateProgressbar(this.__progressBarValue + 0.0001, 'Comparing tables');
        const progressBarStep = 0.1999 / Object.keys(sourceTables).length;

        for (let table in sourceTables) { //Get new or changed tablestable
            this.__updateProgressbar(this.__progressBarValue + progressBarStep, `Comparing TABLE ${table}`);
            this.__tempScripts = [];
            let actionLabel = '';

            if (targetTables[table]) { //Table exists on both database, then compare table schema  
                actionLabel = 'ALTER';

                this.__compareTableOptions(table, sourceTables[table].options, targetTables[table].options);
                this.__compareTableColumns(table, sourceTables[table].columns, targetTables[table].columns);
                this.__compareTableConstraints(table, sourceTables[table].constraints, targetTables[table].constraints);
                this.__compareTableIndexes(sourceTables[table].indexes, targetTables[table].indexes);
                this.__compareTablePrivileges(table, sourceTables[table].privileges, targetTables[table].privileges);
                if (sourceTables[table].owner != targetTables[table].owner)
                    this.__tempScripts.push(sql.generateChangeTableOwnerScript(table, sourceTables[table].owner));
            } else { //Table not exists on target database, then generate the script to create table
                actionLabel = 'CREATE';

                this.__tempScripts.push(sql.generateCreateTableScript(table, sourceTables[table]));
            }

            this.__appendScripts(`${actionLabel} TABLE ${table}`);
        }
    },
    __compareTableOptions: function(table, sourceTableOptions, targetTableOptions) {
        if (sourceTableOptions.withOids != targetTableOptions.withOids)
            this.__tempScripts.push(sql.generateChangeTableOptionsScript(table, sourceTableOptions));
    },
    __compareTableColumns: function(table, sourceTableColumns, targetTableColumns) {
        for (let column in sourceTableColumns) { //Get new or changed columns
            if (targetTableColumns[column]) { //Table column exists on both database, then compare column schema
                this.__compareTableColumn(table, column, sourceTableColumns[column], targetTableColumns[column]);
            } else { //Table column not exists on target database, then generate script to add column
                this.__tempScripts.push(sql.generateAddTableColumnScript(table, column, sourceTableColumns[column]));
            }
        }
        for (let column in targetTableColumns) { //Get dropped columns
            if (!sourceTableColumns[column]) //Table column not exists on source, then generate script to drop column
                this.__tempScripts.push(sql.generateDropTableColumnScript(table, column))
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
            this.__tempScripts.push(sql.generateChangeTableColumnScript(table, column, changes));

    },
    __compareTableConstraints: function(table, sourceTableConstraints, targetTableConstraints) {
        for (let constraint in sourceTableConstraints) { //Get new or changed constraint
            if (targetTableConstraints[constraint]) { //Table constraint exists on both database, then compare column schema
                if (sourceTableConstraints[constraint] != targetTableConstraints[constraint])
                    this.__tempScripts.push(sql.generateChangeTableConstraintScript(table, constraint, sourceTableConstraints[constraint]));
            } else { //Table constraint not exists on target database, then generate script to add constraint
                this.__tempScripts.push(sql.generateAddTableConstraintScript(table, constraint, sourceTableConstraints[constraint]));
            }
        }
        for (let constraint in targetTableConstraints) { //Get dropped constraints
            if (!sourceTableConstraints[constraint]) //Table constraint not exists on source, then generate script to drop constraint
                this.__tempScripts.push(sql.generateDropTableConstraintScript(table, constraint))
        }
    },
    __compareTableIndexes: function(sourceTableIndexes, targetTableIndexes) {
        for (let index in sourceTableIndexes) { //Get new or changed indexes            
            if (targetTableIndexes[index]) { //Table index exists on both database, then compare index definition
                if (sourceTableIndexes[index] != targetTableIndexes[index])
                    this.__tempScripts.push(sql.generateChangeIndexScript(index, sourceTableIndexes[index].definition));
            } else { //Table index not exists on target database, then generate script to add index                
                this.__tempScripts.push(`\n${sourceTableIndexes[index].definition};\n`);
            }
        }
        for (let index in targetTableIndexes) { //Get dropped indexes
            if (!sourceTableIndexes[index]) //Table index not exists on source, then generate script to drop index
                this.__tempScripts.push(sql.generateDropIndexScript(index))
        }
    },
    __compareTablePrivileges: function(table, sourceTablePrivileges, targetTablePrivileges) {
        for (let role in sourceTablePrivileges) { //Get new or changed role privileges            
            if (targetTablePrivileges[role]) { //Table privileges for role exists on both database, then compare privileges
                let changes = {};

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
                    this.__tempScripts.push(sql.generateChangesTableRoleGrantsScript(table, role, changes))
            } else { //Table grants for role not exists on target database, then generate script to add role privileges                  
                this.__tempScripts.push(sql.generateTableRoleGrantsScript(table, role, sourceTablePrivileges[role]))
            }
        }
    },
    __compareViews: function(sourceViews, targetViews) {
        this.__updateProgressbar(this.__progressBarValue + 0.0001, 'Comparing views');
        const progressBarStep = 0.1999 / Object.keys(sourceViews).length;

        for (let view in sourceViews) { //Get new or changed views
            this.__updateProgressbar(this.__progressBarValue + progressBarStep, `Comparing VIEW ${view}`);
            this.__tempScripts = [];
            let actionLabel = '';

            if (targetViews[view]) { //View exists on both database, then compare view schema                 
                actionLabel = 'ALTER';

                if (sourceViews[view].definition != targetViews[view].definition)
                    this.__tempScripts.push(sql.generateChangeViewScript(view, sourceViews[view]));
                else {
                    this.__compareTablePrivileges(view, sourceViews[view].privileges, targetViews[view].privileges);
                    if (sourceViews[view].owner != targetViews[view].owner)
                        this.__tempScripts.push(sql.generateChangeTableOwnerScript(view, sourceViews[view].owner));
                }
            } else { //View not exists on target database, then generate the script to create view
                actionLabel = 'CREATE';

                this.__tempScripts.push(sql.generateCreateViewScript(view, sourceViews[view]));
            }

            this.__appendScripts(`${actionLabel} VIEW ${view}`);
        }
    },
    __compareMaterializedViews: function(sourceMaterializedViews, targetMaterializedViews) {
        this.__updateProgressbar(this.__progressBarValue + 0.0001, 'Comparing materialized views');
        const progressBarStep = 0.1999 / Object.keys(sourceMaterializedViews).length;

        for (let view in sourceMaterializedViews) { //Get new or changed materialized views
            this.__updateProgressbar(this.__progressBarValue + progressBarStep, `Comparing MATERIALIZED VIEW ${view}`);
            this.__tempScripts = [];
            let actionLabel = '';

            if (targetMaterializedViews[view]) { //Materialized view exists on both database, then compare materialized view schema     
                actionLabel = 'ALTER';

                if (sourceMaterializedViews[view].definition != targetMaterializedViews[view].definition)
                    this.__tempScripts.push(sql.generateChangeMaterializedViewScript(view, sourceMaterializedViews[view]));
                else {
                    this.__compareTableIndexes(sourceMaterializedViews[view].indexes, targetMaterializedViews[view].indexes);
                    this.__compareTablePrivileges(view, sourceMaterializedViews[view].privileges, targetMaterializedViews[view].privileges);
                    if (sourceMaterializedViews[view].owner != targetMaterializedViews[view].owner)
                        this.__tempScripts.push(sql.generateChangeTableOwnerScript(view, sourceMaterializedViews[view].owner));
                }
            } else { //Materialized view not exists on target database, then generate the script to create materialized view
                actionLabel = 'CREATE';

                this.__tempScripts.push(sql.generateCreateMaterializedViewScript(view, sourceMaterializedViews[view]));
            }

            this.__appendScripts(`${actionLabel} MATERIALIZED VIEW ${view}`);
        }
    },
    __compareProcedures: function(sourceProcedures, targetProcedures) {
        this.__updateProgressbar(this.__progressBarValue + 0.0001, 'Comparing functions');
        const progressBarStep = 0.1999 / Object.keys(sourceProcedures).length;

        for (let procedure in sourceProcedures) { //Get new or changed procedures
            this.__updateProgressbar(this.__progressBarValue + progressBarStep, `Comparing FUNCTION ${procedure}`);
            this.__tempScripts = [];
            let actionLabel = '';

            if (targetProcedures[procedure]) { //Procedure exists on both database, then compare procedure definition                     
                actionLabel = 'ALTER';

                if (sourceProcedures[procedure].definition != targetProcedures[procedure].definition) {
                    this.__tempScripts.push(sql.generateChangeProcedureScript(procedure, sourceProcedures[procedure]));
                } else {
                    this.__compareProcedurePrivileges(procedure, sourceProcedures[procedure].argTypes, sourceProcedures[procedure].privileges, targetProcedures[procedure].privileges);
                    if (sourceProcedures[procedure].owner != targetProcedures[procedure].owner)
                        this.__tempScripts.push(sql.generateChangeProcedureOwnerScript(procedure, sourceProcedures[procedure].argTypes, sourceViews[view].owner));
                }
            } else { //Procedure not exists on target database, then generate the script to create procedure
                actionLabel = 'CREATE';

                this.__tempScripts.push(sql.generateCreateProcedureScript(procedure, sourceProcedures[procedure]));
            }

            this.__appendScripts(`${actionLabel} FUNCTION ${procedure}`);
        }
    },
    __compareProcedurePrivileges: function(procedure, argTypes, sourceProcedurePrivileges, targetProcedurePrivileges) {
        for (let role in sourceProcedurePrivileges) { //Get new or changed role privileges            
            if (targetProcedurePrivileges[role]) { //Procedure privileges for role exists on both database, then compare privileges
                let changes = {};
                if (sourceProcedurePrivileges[role].execute != targetProcedurePrivileges[role].execute)
                    changes.execute = sourceProcedurePrivileges[role].execute

                if (Object.keys(changes).length > 0)
                    this.__tempScripts.push(sql.generateChangesProcedureRoleGrantsScript(procedure, argTypes, role, changes))
            } else { //Procedure grants for role not exists on target database, then generate script to add role privileges                  
                this.__tempScripts.push(sql.generateProcedureRoleGrantsScript(procedure, argTypes, role, sourceProcedurePrivileges[role]))
            }
        }
    },
    compareDatabaseObjects: function(sourceSchema, targetSchema) {
        this.__updateProgressbar(0.0, 'Comparing database objects ...');

        this.__compareSchemas(sourceSchema.schemas, targetSchema.schemas);
        this.__compareTables(sourceSchema.tables, targetSchema.tables);
        this.__compareViews(sourceSchema.views, targetSchema.views);
        this.__compareMaterializedViews(sourceSchema.materializedViews, targetSchema.materializedViews);
        this.__compareProcedures(sourceSchema.functions, targetSchema.functions);

        this.__updateProgressbar(1.0, 'Database objects compared!');

        return this.__finalScripts;
    }
}

module.exports = helper;