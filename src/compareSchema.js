const sql = require('./sqlScriptGenerator')
const { Progress } = require('clui');
const chalk = require('chalk');

var helper = {
    __finalScripts: [],
    __tempScripts: [],
    __droppedConstraints: [],
    __droppedIndexes: [],
    __droppedViews: [],
    __progressBar: new Progress(20),
    __progressBarValue: 0.0,
    __sourceSchema: {},
    __targetSchema: {},
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
    __compareSchemas: function() {
        this.__updateProgressbar(this.__progressBarValue + 0.0001, 'Comparing schemas');
        const progressBarStep = 0.1999 / Object.keys(this.__sourceSchema.schemas).length;

        for (let schema in this.__sourceSchema.schemas) { //Get missing schemas on target
            this.__updateProgressbar(this.__progressBarValue + progressBarStep, `Comparing SCHEMA ${schema}`);
            this.__tempScripts = [];

            if (!this.__targetSchema.schemas[schema]) { //Schema not exists on target database, then generate script to create schema
                this.__tempScripts.push(sql.generateCreateSchemaScript(schema, this.__sourceSchema.schemas[schema].owner));
            }

            this.__appendScripts(`CREATE SCHEMA ${schema}`);
        }
    },
    __compareTables: function() {
        this.__updateProgressbar(this.__progressBarValue + 0.0001, 'Comparing tables');
        const progressBarStep = 0.1999 / Object.keys(this.__sourceSchema.tables).length;

        for (let table in this.__sourceSchema.tables) { //Get new or changed tablestable
            this.__updateProgressbar(this.__progressBarValue + progressBarStep, `Comparing TABLE ${table}`);
            this.__tempScripts = [];
            this.__droppedConstraints = [];
            this.__droppedIndexes = [];
            let actionLabel = '';

            if (this.__targetSchema.tables[table]) { //Table exists on both database, then compare table schema  
                actionLabel = 'ALTER';

                this.__compareTableOptions(table, this.__sourceSchema.tables[table].options, this.__targetSchema.tables[table].options);
                this.__compareTableColumns(table, this.__sourceSchema.tables[table].columns, this.__targetSchema.tables[table].columns, this.__targetSchema.tables[table].constraints, this.__targetSchema.tables[table].indexes);
                this.__compareTableConstraints(table, this.__sourceSchema.tables[table].constraints, this.__targetSchema.tables[table].constraints);
                this.__compareTableIndexes(this.__sourceSchema.tables[table].indexes, this.__targetSchema.tables[table].indexes);
                this.__compareTablePrivileges(table, this.__sourceSchema.tables[table].privileges, this.__targetSchema.tables[table].privileges);
                if (this.__sourceSchema.tables[table].owner != this.__targetSchema.tables[table].owner)
                    this.__tempScripts.push(sql.generateChangeTableOwnerScript(table, this.__sourceSchema.tables[table].owner));
            } else { //Table not exists on target database, then generate the script to create table
                actionLabel = 'CREATE';

                this.__tempScripts.push(sql.generateCreateTableScript(table, this.__sourceSchema.tables[table]));
            }

            this.__appendScripts(`${actionLabel} TABLE ${table}`);
        }
    },
    __compareTableOptions: function(table, sourceTableOptions, targetTableOptions) {
        if (sourceTableOptions.withOids != targetTableOptions.withOids)
            this.__tempScripts.push(sql.generateChangeTableOptionsScript(table, sourceTableOptions));
    },
    __compareTableColumns: function(table, sourceTableColumns, targetTableColumns, targetTableConstraints, targetTableIndexes) {
        for (let column in sourceTableColumns) { //Get new or changed columns
            if (targetTableColumns[column]) { //Table column exists on both database, then compare column schema
                this.__compareTableColumn(table, column, sourceTableColumns[column], targetTableColumns[column], targetTableConstraints, targetTableIndexes);
            } else { //Table column not exists on target database, then generate script to add column
                this.__tempScripts.push(sql.generateAddTableColumnScript(table, column, sourceTableColumns[column]));
            }
        }
        for (let column in targetTableColumns) { //Get dropped columns
            if (!sourceTableColumns[column]) //Table column not exists on source, then generate script to drop column
                this.__tempScripts.push(sql.generateDropTableColumnScript(table, column))
        }
    },
    __compareTableColumn: function(table, column, sourceTableColumn, targetTableColumn, targetTableConstraints, targetTableIndexes) {
        let changes = {};

        if (sourceTableColumn.nullable != targetTableColumn.nullable)
            changes.nullable = sourceTableColumn.nullable;

        if (sourceTableColumn.datatype != targetTableColumn.datatype ||
            sourceTableColumn.precision != targetTableColumn.precision ||
            sourceTableColumn.scale != targetTableColumn.scale) {
            changes.datatype = sourceTableColumn.datatype;
            changes.dataTypeID = sourceTableColumn.dataTypeID;
            changes.dataTypeCategory = sourceTableColumn.dataTypeCategory;
            changes.precision = sourceTableColumn.precision;
            changes.scale = sourceTableColumn.scale;
        }

        if (sourceTableColumn.default != targetTableColumn.default)
            changes.default = sourceTableColumn.default;

        if (Object.keys(changes).length > 0) {
            let rawColumnName = column.substring(1).slice(0, -1);

            //Check if the column is under constrains
            for (let constraint in targetTableConstraints) {
                if (this.__droppedConstraints.includes(constraint))
                    continue;

                let constraintDefinition = targetTableConstraints[constraint].definition;
                let serachStartingIndex = constraintDefinition.indexOf('(');

                if (constraintDefinition.includes(`${rawColumnName},`, serachStartingIndex) ||
                    constraintDefinition.includes(`${rawColumnName})`, serachStartingIndex) ||
                    constraintDefinition.includes(`${column}`, serachStartingIndex)) {
                    this.__tempScripts.push(sql.generateDropTableConstraintScript(table, constraint));
                    this.__droppedConstraints.push(constraint);
                }
            }

            //Check if the column is part of indexes
            for (let index in targetTableIndexes) {
                let indexDefinition = targetTableIndexes[index].definition;
                let serachStartingIndex = indexDefinition.indexOf('(');

                if (indexDefinition.includes(`${rawColumnName},`, serachStartingIndex) ||
                    indexDefinition.includes(`${rawColumnName})`, serachStartingIndex) ||
                    indexDefinition.includes(`${column}`, serachStartingIndex)) {
                    this.__tempScripts.push(sql.generateDropIndexScript(index))
                    this.__droppedIndexes.push(index);
                }
            }

            //Check if the column is used into view
            for (let view in this.__targetSchema.views) {
                this.__targetSchema.views[view].dependencies.forEach(dependency => {
                    let fullDependencyName = `"${dependency.schemaName}"."${dependency.tableName}"`;
                    if (fullDependencyName == table && dependency.columnName == column) {
                        this.__tempScripts.push(sql.generateDropViewScript(index))
                        this.__droppedViews.push(view);
                    }
                });
            }

            //Check if the column is used into materialized view
            for (let view in this.__targetSchema.materializedViews) {
                this.__targetSchema.materializedViews[view].dependencies.forEach(dependency => {
                    let fullDependencyName = `"${dependency.schemaName}"."${dependency.tableName}"`;
                    if (fullDependencyName == table && dependency.columnName == column) {
                        this.__tempScripts.push(sql.generateDropMaterializedViewScript(index))
                        this.__droppedViews.push(view);
                    }
                });
            }

            this.__tempScripts.push(sql.generateChangeTableColumnScript(table, column, changes));
        }
    },
    __compareTableConstraints: function(table, sourceTableConstraints, targetTableConstraints) {
        for (let constraint in sourceTableConstraints) { //Get new or changed constraint
            if (targetTableConstraints[constraint]) { //Table constraint exists on both database, then compare column schema
                if (sourceTableConstraints[constraint].definition != targetTableConstraints[constraint].definition) {
                    if (!this.__droppedConstraints.includes(constraint))
                        this.__tempScripts.push(sql.generateDropTableConstraintScript(table, constraint));
                    this.__tempScripts.push(sql.generateAddTableConstraintScript(table, constraint, sourceTableConstraints[constraint]));
                } else {
                    if (this.__droppedConstraints.includes(constraint)) //It will recreate a dropped constraints because changes happens on involved columns
                        this.__tempScripts.push(sql.generateAddTableConstraintScript(table, constraint, sourceTableConstraints[constraint]));
                }
            } else { //Table constraint not exists on target database, then generate script to add constraint
                this.__tempScripts.push(sql.generateAddTableConstraintScript(table, constraint, sourceTableConstraints[constraint]));
            }
        }
        for (let constraint in targetTableConstraints) { //Get dropped constraints
            if (!sourceTableConstraints[constraint] && !this.__droppedConstraints.includes(constraint)) //Table constraint not exists on source, then generate script to drop constraint
                this.__tempScripts.push(sql.generateDropTableConstraintScript(table, constraint));
        }
    },
    __compareTableIndexes: function(sourceTableIndexes, targetTableIndexes) {
        for (let index in sourceTableIndexes) { //Get new or changed indexes            
            if (targetTableIndexes[index]) { //Table index exists on both database, then compare index definition
                if (sourceTableIndexes[index].definition != targetTableIndexes[index].definition) {
                    if (!this.__droppedIndexes.includes(index))
                        this.__tempScripts.push(sql.generateDropIndexScript(index));
                    this.__tempScripts.push(`\n${sourceTableIndexes[index].definition};\n`);
                } else {
                    if (this.__droppedIndexes.includes(index)) //It will recreate a dropped index because changes happens on involved columns
                        this.__tempScripts.push(`\n${sourceTableIndexes[index].definition};\n`);
                }
            } else { //Table index not exists on target database, then generate script to add index                
                this.__tempScripts.push(`\n${sourceTableIndexes[index].definition};\n`);
            }
        }
        for (let index in targetTableIndexes) { //Get dropped indexes
            if (!sourceTableIndexes[index] && !this.__droppedIndexes.includes(index)) //Table index not exists on source, then generate script to drop index
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
    __compareViews: function() {
        this.__updateProgressbar(this.__progressBarValue + 0.0001, 'Comparing views');
        const progressBarStep = 0.1999 / Object.keys(this.__sourceSchema.views).length;

        for (let view in this.__sourceSchema.views) { //Get new or changed views
            this.__updateProgressbar(this.__progressBarValue + progressBarStep, `Comparing VIEW ${view}`);
            this.__tempScripts = [];
            let actionLabel = '';

            if (this.__targetSchema.views[view]) { //View exists on both database, then compare view schema                 
                actionLabel = 'ALTER';

                if (this.__sourceSchema.views[view].definition != this.__targetSchema.views[view].definition) {
                    if (!this.__droppedViews.includes(view))
                        this.__tempScripts.push(sql.generateDropViewScript(view));
                    this.__tempScripts.push(sql.generateCreateViewScript(view, this.__sourceSchema.views[view]));
                } else {
                    if (this.__droppedViews.includes(view)) //It will recreate a dropped view because changes happens on involved columns
                        this.__tempScripts.push(sql.generateCreateViewScript(view, this.__sourceSchema.views[view]));

                    this.__compareTablePrivileges(view, this.__sourceSchema.views[view].privileges, this.__targetSchema.views[view].privileges);
                    if (this.__sourceSchema.views[view].owner != this.__targetSchema.views[view].owner)
                        this.__tempScripts.push(sql.generateChangeTableOwnerScript(view, this.__sourceSchema.views[view].owner));
                }
            } else { //View not exists on target database, then generate the script to create view
                actionLabel = 'CREATE';

                this.__tempScripts.push(sql.generateCreateViewScript(view, this.__sourceSchema.views[view]));
            }

            this.__appendScripts(`${actionLabel} VIEW ${view}`);
        }
    },
    __compareMaterializedViews: function() {
        this.__updateProgressbar(this.__progressBarValue + 0.0001, 'Comparing materialized views');
        const progressBarStep = 0.1999 / Object.keys(this.__sourceSchema.materializedViews).length;

        for (let view in this.__sourceSchema.materializedViews) { //Get new or changed materialized views
            this.__updateProgressbar(this.__progressBarValue + progressBarStep, `Comparing MATERIALIZED VIEW ${view}`);
            this.__tempScripts = [];
            let actionLabel = '';

            if (this.__targetSchema.materializedViews[view]) { //Materialized view exists on both database, then compare materialized view schema     
                actionLabel = 'ALTER';

                if (this.__sourceSchema.materializedViews[view].definition != this.__targetSchema.materializedViews[view].definition) {
                    if (!this.__droppedViews.includes(view))
                        this.__tempScripts.push(sql.generateDropMaterializedViewScript(view));
                    this.__tempScripts.push(sql.generateCreateMaterializedViewScript(view, this.__sourceSchema.materializedViews[view]));
                } else {
                    if (this.__droppedViews.includes(view)) //It will recreate a dropped materialized view because changes happens on involved columns
                        this.__tempScripts.push(sql.generateCreateMaterializedViewScript(view, this.__sourceSchema.views[view]));

                    this.__compareTableIndexes(this.__sourceSchema.materializedViews[view].indexes, this.__targetSchema.materializedViews[view].indexes);
                    this.__compareTablePrivileges(view, this.__sourceSchema.materializedViews[view].privileges, this.__targetSchema.materializedViews[view].privileges);
                    if (this.__sourceSchema.materializedViews[view].owner != this.__targetSchema.materializedViews[view].owner)
                        this.__tempScripts.push(sql.generateChangeTableOwnerScript(view, this.__sourceSchema.materializedViews[view].owner));
                }
            } else { //Materialized view not exists on target database, then generate the script to create materialized view
                actionLabel = 'CREATE';

                this.__tempScripts.push(sql.generateCreateMaterializedViewScript(view, this.__sourceSchema.materializedViews[view]));
            }

            this.__appendScripts(`${actionLabel} MATERIALIZED VIEW ${view}`);
        }
    },
    __compareProcedures: function(targetProcedures) {
        this.__updateProgressbar(this.__progressBarValue + 0.0001, 'Comparing functions');
        const progressBarStep = 0.1999 / Object.keys(this.__sourceSchema.functions).length;

        for (let procedure in this.__sourceSchema.functions) { //Get new or changed procedures
            this.__updateProgressbar(this.__progressBarValue + progressBarStep, `Comparing FUNCTION ${procedure}`);
            this.__tempScripts = [];
            let actionLabel = '';

            if (this.__targetSchema.functions[procedure]) { //Procedure exists on both database, then compare procedure definition                     
                actionLabel = 'ALTER';

                if (this.__sourceSchema.functions[procedure].definition != this.__targetSchema.functions[procedure].definition) {
                    this.__tempScripts.push(sql.generateChangeProcedureScript(procedure, this.__sourceSchema.functions[procedure]));
                } else {
                    this.__compareProcedurePrivileges(procedure, this.__sourceSchema.functions[procedure].argTypes, this.__sourceSchema.functions[procedure].privileges, this.__targetSchema.functions[procedure].privileges);
                    if (this.__sourceSchema.functions[procedure].owner != this.__targetSchema.functions[procedure].owner)
                        this.__tempScripts.push(sql.generateChangeProcedureOwnerScript(procedure, this.__sourceSchema.functions[procedure].argTypes, sourceViews[view].owner));
                }
            } else { //Procedure not exists on target database, then generate the script to create procedure
                actionLabel = 'CREATE';

                this.__tempScripts.push(sql.generateCreateProcedureScript(procedure, this.__sourceSchema.functions[procedure]));
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

        this.__sourceSchema = sourceSchema;
        this.__targetSchema = targetSchema;

        this.__compareSchemas();
        this.__compareTables();
        this.__compareViews();
        this.__compareMaterializedViews();
        this.__compareProcedures();

        this.__updateProgressbar(1.0, 'Database objects compared!');

        return this.__finalScripts;
    }
}

module.exports = helper;