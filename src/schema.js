const Exception = require('./error')
const { Progress } = require('clui');
const chalk = require('chalk');

const query = {
    "getSchemas": function(schemas) {
        return `SELECT nspname, nspowner::regrole::name as owner FROM pg_namespace WHERE nspname IN ('${schemas.join("','")}')`
    },
    "getTables": function(schemas) {
        return `SELECT schemaname, tablename, tableowner FROM pg_tables WHERE schemaname IN ('${schemas.join("','")}')`
    },
    "getTableOptions": function(tableName) {
        return `SELECT relhasoids FROM pg_class WHERE oid = '${tableName}'::regclass`
    },
    "getTableColumns": function(tableName) {
        return `SELECT a.attname, a.attnotnull, t.typname, ad.adsrc,
                CASE 
                    WHEN t.typname = 'numeric' THEN (a.atttypmod-4) >> 16
                    WHEN t.typname = 'bpchar' or t.typname = 'varchar' THEN a.atttypmod-4
                    ELSE null
                END AS precision,
                CASE
                    WHEN t.typname = 'numeric' THEN (a.atttypmod-4) & 65535
                    ELSE null
                END AS scale 	
                FROM pg_attribute a
                INNER JOIN pg_type t ON t.oid = a.atttypid
                LEFT JOIN pg_attrdef ad on ad.adrelid = a.attrelid AND a.attnum = ad.adnum
                WHERE attrelid = '${tableName}'::regclass AND attnum > 0 AND attisdropped = false`
    },
    "getTableConstraints": function(tableName) {
        return `SELECT conname, contype, pg_get_constraintdef(c.oid) as definition
                FROM pg_constraint c
                WHERE c.conrelid = '${tableName}'::regclass`
    },
    "getTableIndexes": function(schemaName, tableName) {
        return `SELECT idx.relname as indexname, pg_get_indexdef(idx.oid) AS indexdef
                FROM pg_index i
                INNER JOIN pg_class tbl ON tbl.oid = i.indrelid
                INNER JOIN pg_class idx ON idx.oid = i.indexrelid
                WHERE tbl.relnamespace = '"${schemaName}"'::regnamespace::oid and tbl.relname='${tableName}' and i.indisprimary = false`
    },
    "getTablePrivileges": function(schemaName, tableName) {
        return `SELECT t.schemaname, t.tablename, u.usename, 
                HAS_TABLE_PRIVILEGE(u.usename,'"${schemaName}"."${tableName}"', 'SELECT') as select,
                HAS_TABLE_PRIVILEGE(u.usename,'"${schemaName}"."${tableName}"', 'INSERT') as insert,
                HAS_TABLE_PRIVILEGE(u.usename,'"${schemaName}"."${tableName}"', 'UPDATE') as update,
                HAS_TABLE_PRIVILEGE(u.usename,'"${schemaName}"."${tableName}"', 'DELETE') as delete, 
                HAS_TABLE_PRIVILEGE(u.usename,'"${schemaName}"."${tableName}"', 'TRUNCATE') as truncate,
                HAS_TABLE_PRIVILEGE(u.usename,'"${schemaName}"."${tableName}"', 'REFERENCES') as references,
                HAS_TABLE_PRIVILEGE(u.usename,'"${schemaName}"."${tableName}"', 'TRIGGER') as trigger
                FROM pg_tables t, pg_user u 
                WHERE t.schemaname = '${schemaName}' and t.tablename='${tableName}'`
    },
    "getViews": function(schemas) {
        return `SELECT schemaname, viewname, viewowner, definition FROM pg_views WHERE schemaname IN ('${schemas.join("','")}')`
    },
    "getViewPrivileges": function(schemaName, viewName) {
        return `SELECT v.schemaname, v.viewname, u.usename, 
                HAS_TABLE_PRIVILEGE(u.usename,'"${schemaName}"."${viewName}"', 'SELECT') as select,
                HAS_TABLE_PRIVILEGE(u.usename,'"${schemaName}"."${viewName}"', 'INSERT') as insert,
                HAS_TABLE_PRIVILEGE(u.usename,'"${schemaName}"."${viewName}"', 'UPDATE') as update,
                HAS_TABLE_PRIVILEGE(u.usename,'"${schemaName}"."${viewName}"', 'DELETE') as delete, 
                HAS_TABLE_PRIVILEGE(u.usename,'"${schemaName}"."${viewName}"', 'TRUNCATE') as truncate,
                HAS_TABLE_PRIVILEGE(u.usename,'"${schemaName}"."${viewName}"', 'REFERENCES') as references,
                HAS_TABLE_PRIVILEGE(u.usename,'"${schemaName}"."${viewName}"', 'TRIGGER') as trigger
                FROM pg_views v, pg_user u 
                WHERE v.schemaname = '${schemaName}' and v.viewname='${viewName}'`
    },
    "getMaterializedViews": function(schemas) {
        return `SELECT schemaname, matviewname, matviewowner, definition FROM pg_matviews WHERE schemaname IN ('${schemas.join("','")}')`
    },
    "getMaterializedViewPrivileges": function(schemaName, viewName) {
        return `SELECT v.schemaname, v.matviewname, u.usename, 
                HAS_TABLE_PRIVILEGE(u.usename,'"${schemaName}"."${viewName}"', 'SELECT') as select,
                HAS_TABLE_PRIVILEGE(u.usename,'"${schemaName}"."${viewName}"', 'INSERT') as insert,
                HAS_TABLE_PRIVILEGE(u.usename,'"${schemaName}"."${viewName}"', 'UPDATE') as update,
                HAS_TABLE_PRIVILEGE(u.usename,'"${schemaName}"."${viewName}"', 'DELETE') as delete, 
                HAS_TABLE_PRIVILEGE(u.usename,'"${schemaName}"."${viewName}"', 'TRUNCATE') as truncate,
                HAS_TABLE_PRIVILEGE(u.usename,'"${schemaName}"."${viewName}"', 'REFERENCES') as references,
                HAS_TABLE_PRIVILEGE(u.usename,'"${schemaName}"."${viewName}"', 'TRIGGER') as trigger
                FROM pg_matviews v, pg_user u 
                WHERE v.schemaname = '${schemaName}' and v.matviewname='${viewName}'`
    },
    "getFunctions": function(schemas) {
        return `SELECT p.proname, n.nspname, pg_get_functiondef(p.oid) as definition, p.proowner::regrole::name as owner, oidvectortypes(proargtypes) as argtypes
                FROM pg_proc p
                INNER JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname IN ('${schemas.join("','")}')`
    },
    "getFunctionPrivileges": function(schemaName, functionName, argTypes) {
        return `SELECT p.pronamespace::regnamespace::name, p.proname, u.usename, 
                HAS_FUNCTION_PRIVILEGE(u.usename,'"${schemaName}"."${functionName}"(${argTypes})','EXECUTE') as execute  
                FROM pg_proc p, pg_user u 
                WHERE p.proname='${functionName}' AND p.pronamespace::regnamespace = '"${schemaName}"'::regnamespace`
    },
}

var helper = {
    __progressBar: new Progress(20),
    __progressBarValue: 0.0,
    __updateProgressbar: function(value, label) {
        this.__progressBarValue = value;
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(this.__progressBar.update(this.__progressBarValue) + ' - ' + chalk.whiteBright(label));
    },
    collectSchemaObjects: async function(client, schemas) {
        return new Promise(async(resolve, reject) => {
            try {

                helper.__updateProgressbar(0.0, 'Collecting database objects ...');

                var schema = {
                    schemas: await helper.__retrieveSchemas(client, schemas),
                    tables: await helper.__retrieveTables(client, schemas),
                    views: await helper.__retrieveViews(client, schemas),
                    materializedViews: await helper.__retrieveMaterializedViews(client, schemas),
                    functions: await helper.__retrieveFunctions(client, schemas)
                };
                //TODO: Do we need to retrieve sequences?
                //TODO: Do we need to retrieve data types?
                //TODO: Do we need to retrieve roles?
                //TODO: Do we need to retieve special table like TEMPORARY and UNLOGGED? for sure not temporary, but UNLOGGED probably yes.     
                //TODO: Do we need to retrieve collation for both table and columns?           

                helper.__updateProgressbar(1.0, 'Database objects collected!');

                resolve(schema);
            } catch (e) {
                reject(e);
            }
        });
    },
    __retrieveSchemas: async function(client, schemas) {
        let result = {}

        helper.__updateProgressbar(helper.__progressBarValue + 0.0001, 'Collecting schemas');

        //Get schemas
        const namespaces = await client.query(query.getSchemas(schemas))
        const progressBarStep = 0.1999 / namespaces.rows.length;

        await Promise.all(namespaces.rows.map(async(namespace) => {
            result[namespace.nspname] = {
                owner: namespace.owner
            };

            helper.__updateProgressbar(helper.__progressBarValue + progressBarStep, `Collected SCHEMA ${namespace.nspname}`);
        }));

        return result;
    },
    __retrieveTables: async function(client, schemas) {
        let result = {}

        helper.__updateProgressbar(helper.__progressBarValue + 0.0001, 'Collecting tables');

        //Get tables
        const tables = await client.query(query.getTables(schemas))
        const progressBarStep = 0.1999 / tables.rows.length;

        await Promise.all(tables.rows.map(async(table) => {
            const progressBarSubStep = progressBarStep / 5;

            let fullTableName = `"${table.schemaname}"."${table.tablename}"`;
            result[fullTableName] = {
                columns: {},
                constraints: {},
                options: {},
                indexes: {},
                privileges: {},
                owner: table.tableowner
            };

            helper.__updateProgressbar(helper.__progressBarValue + progressBarSubStep, `Collecting COLUMNS for table ${fullTableName}`);

            //Get table columns
            const columns = await client.query(query.getTableColumns(fullTableName))
            columns.rows.forEach(column => {
                let columnName = `"${column.attname}"`;
                let isAutoIncrement = (column.adsrc && column.adsrc.startsWith('nextval') && column.adsrc.includes('_seq')) || false;
                let defaultValue = isAutoIncrement ? '' : column.adsrc
                let dataType = isAutoIncrement ? 'serial' : column.typname
                result[fullTableName].columns[columnName] = {
                    nullable: !column.attnotnull,
                    datatype: dataType,
                    default: defaultValue,
                    precision: column.precision,
                    scale: column.scale
                }
            });

            helper.__updateProgressbar(helper.__progressBarValue + progressBarSubStep, `Collecting CONSTRAINTS for table ${fullTableName}`);

            //Get table constraints
            let constraints = await client.query(query.getTableConstraints(fullTableName))
            constraints.rows.forEach(constraint => {
                let constraintName = `"${constraint.conname}"`;
                result[fullTableName].constraints[constraintName] = {
                    type: constraint.contype,
                    definition: constraint.definition
                }
            });

            helper.__updateProgressbar(helper.__progressBarValue + progressBarSubStep, `Collecting OPTIONS for table ${fullTableName}`);

            //Get table options
            let options = await client.query(query.getTableOptions(fullTableName))
            options.rows.forEach(option => {
                result[fullTableName].options = {
                    withOids: option.relhasoids
                }
            });

            helper.__updateProgressbar(helper.__progressBarValue + progressBarSubStep, `Collecting INDEXES for table ${fullTableName}`);

            //Get table indexes
            let indexes = await client.query(query.getTableIndexes(table.schemaname, table.tablename))
            indexes.rows.forEach(index => {
                result[fullTableName].indexes[index.indexname] = {
                    definition: index.indexdef
                }
            });

            helper.__updateProgressbar(helper.__progressBarValue + progressBarSubStep, `Collecting PRIVILEGES for table ${fullTableName}`);

            //Get table privileges
            let privileges = await client.query(query.getTablePrivileges(table.schemaname, table.tablename))
            privileges.rows.forEach(privilege => {
                result[fullTableName].privileges[privilege.usename] = {
                    select: privilege.select,
                    insert: privilege.insert,
                    update: privilege.update,
                    delete: privilege.delete,
                    truncate: privilege.truncate,
                    references: privilege.references,
                    trigger: privilege.trigger
                }
            });

            //TODO: Missing discovering of PARTITION
            //TODO: Missing discovering of TRIGGER
            //TODO: Missing discovering of GRANTS for COLUMNS
            //TODO: Missing discovering of WITH GRANT OPTION, that is used to indcate if user\role can add GRANTS to other users

        }));

        return result;
    },
    __retrieveViews: async function(client, schemas) {
        let result = {}

        helper.__updateProgressbar(helper.__progressBarValue + 0.0001, 'Collecting views');

        //Get views
        const views = await client.query(query.getViews(schemas))
        const progressBarStep = 0.1999 / views.rows.length;

        await Promise.all(views.rows.map(async(view) => {
            let fullViewName = `"${view.schemaname}"."${view.viewname}"`;
            result[fullViewName] = {
                definition: view.definition,
                owner: view.viewowner,
                privileges: {}
            };

            helper.__updateProgressbar(helper.__progressBarValue + progressBarStep, `Collecting PRIVILEGES for view ${fullViewName}`);

            //Get view privileges
            let privileges = await client.query(query.getViewPrivileges(view.schemaname, view.viewname))
            privileges.rows.forEach(privilege => {
                result[fullViewName].privileges[privilege.usename] = {
                    select: privilege.select,
                    insert: privilege.insert,
                    update: privilege.update,
                    delete: privilege.delete,
                    truncate: privilege.truncate,
                    references: privilege.references,
                    trigger: privilege.trigger
                }
            });
        }));

        //TODO: Missing discovering of TRIGGER
        //TODO: Missing discovering of GRANTS for COLUMNS
        //TODO: Should we get TEMPORARY VIEW?

        return result;
    },
    __retrieveMaterializedViews: async function(client, schemas) {
        let result = {}

        helper.__updateProgressbar(helper.__progressBarValue + 0.0001, 'Collecting materialized views');

        //Get materialized views
        const views = await client.query(query.getMaterializedViews(schemas))
        const progressBarStep = 0.1999 / views.rows.length;

        await Promise.all(views.rows.map(async(view) => {
            const progressBarSubStep = progressBarStep / 2;

            let fullViewName = `"${view.schemaname}"."${view.matviewname}"`;
            result[fullViewName] = {
                definition: view.definition,
                indexes: {},
                owner: view.matviewowner,
                privileges: {}
            };

            helper.__updateProgressbar(helper.__progressBarValue + progressBarSubStep, `Collecting INDEXES for materialized view ${fullViewName}`);

            //Get view indexes
            let indexes = await client.query(query.getTableIndexes(view.schemaname, view.matviewname))
            indexes.rows.forEach(index => {
                result[fullViewName].indexes[index.indexname] = {
                    definition: index.indexdef
                }
            });

            helper.__updateProgressbar(helper.__progressBarValue + progressBarSubStep, `Collecting PRIVILEGES for materialized view ${fullViewName}`);

            //Get view privileges
            let privileges = await client.query(query.getMaterializedViewPrivileges(view.schemaname, view.matviewname))
            privileges.rows.forEach(privilege => {
                result[fullViewName].privileges[privilege.usename] = {
                    select: privilege.select,
                    insert: privilege.insert,
                    update: privilege.update,
                    delete: privilege.delete,
                    truncate: privilege.truncate,
                    references: privilege.references,
                    trigger: privilege.trigger
                }
            });
        }));

        //TODO: Missing discovering of GRANTS for COLUMNS

        return result;
    },
    __retrieveFunctions: async function(client, schemas) {
        let result = {}

        helper.__updateProgressbar(helper.__progressBarValue + 0.0001, 'Collecting functions');

        //Get functions
        const procedures = await client.query(query.getFunctions(schemas))
        const progressBarStep = 0.1999 / procedures.rows.length;

        await Promise.all(procedures.rows.map(async(procedure) => {
            let fullProcedureName = `"${procedure.nspname}"."${procedure.proname}"`;
            result[fullProcedureName] = {
                definition: procedure.definition,
                owner: procedure.owner,
                argTypes: procedure.argtypes,
                privileges: {}
            };

            helper.__updateProgressbar(helper.__progressBarValue + progressBarStep, `Collecting PRIVILEGES for function ${fullProcedureName}`);

            //Get function privileges
            let privileges = await client.query(query.getFunctionPrivileges(procedure.nspname, procedure.proname, procedure.argtypes))

            privileges.rows.forEach(privilege => {
                result[fullProcedureName].privileges[privilege.usename] = {
                    execute: privilege.execute
                }
            });
        }));
        return result;
    }
}

module.exports = helper;