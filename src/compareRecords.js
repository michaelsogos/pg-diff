const sql = require('./sqlScriptGenerator')
const {
    Progress
} = require('clui');
const chalk = require('chalk');

var helper = {
    __finalScripts: [],
    __tempScripts: [],
    __isSequenceRebaseNeeded: false,
    __progressBar: new Progress(20),
    __progressBarValue: 0.0,
    __updateProgressbar: function (value, label) {
        this.__progressBarValue = value;
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(this.__progressBar.update(this.__progressBarValue) + ' - ' + chalk.whiteBright(label));
    },
    __appendScripts: function (actionLabel) {
        if (this.__tempScripts.length > 0) {
            this.__finalScripts.push(`\n--- BEGIN ${actionLabel} ---\n`);
            this.__finalScripts = this.__finalScripts.concat(this.__tempScripts);
            this.__finalScripts.push(`\n--- END ${actionLabel} ---\n`);
        }
    },
    compareTablesRecords: function (tables, sourceTablesRecords, targetTablesRecords) {
        this.__updateProgressbar(0.0, 'Comparing tables records ...');
        const progressBarStep = 1.0 / Object.keys(tables).length;

        for (let table in tables) {
            let tableName = `"${tables[table].schema||'public'}"."${table}"`
            this.__updateProgressbar(this.__progressBarValue, `Comparing table ${tableName} records`);
            this.__tempScripts = [];
            this.__isSequenceRebaseNeeded = false;

            if (!sourceTablesRecords[table] || !sourceTablesRecords[table].exists) {
                this.__tempScripts.push(`\n--ERROR: Table ${tableName} not found on SOURCE database for comparison!\n`);
            } else {
                if (!targetTablesRecords[table] || !targetTablesRecords[table].exists)
                    this.__tempScripts.push(`\n--ERROR: Table ${tableName} not found on TARGET database for comparison!\n`);

                //Check if at least one sequence is for an ALWAYS IDENTITY in case the OVERRIDING SYSTEM VALUE must be issued
                let isIdentityUserValuesAllowed = this.__checkIdentityAllowUserValues(targetTablesRecords[table].sequences);
                this.__compareTableRecords(tableName, tables[table].keyFields, sourceTablesRecords[table], targetTablesRecords[table], isIdentityUserValuesAllowed);
                //Reset sequences to avoid PKEY or UNIQUE CONSTRAINTS conflicts
                if (this.__isSequenceRebaseNeeded)
                    this.__rebaseSequences(tableName, sourceTablesRecords[table].sequences);
            }

            this.__appendScripts(`SYNCHRONIZE TABLE ${tableName} RECORDS`);
            this.__progressBarValue += progressBarStep;
        }

        this.__updateProgressbar(1.0, 'Tables records compared!');

        return this.__finalScripts;
    },
    __rebaseSequences: function (tableName, tableSequences) {
        tableSequences.forEach(sequence => {
            this.__tempScripts.push(sql.generateSetSequenceValueScript(tableName, sequence));
        });
    },
    __checkIdentityAllowUserValues: function (tableSequences) {
        return !tableSequences.some((sequence) => sequence.identitytype === 'ALWAYS');
    },
    __compareTableRecords: function (table, keyFields, sourceTableRecords, targetTableRecords, isIdentityUserValuesAllowed) {
        let ignoredRowHash = [];

        sourceTableRecords.records.rows.forEach((record, index) => {
            let keyFieldsMap = this.__getKeyFieldsMap(keyFields, record);

            //Check if row hash has been ignored because duplicated or already processed from source
            if (ignoredRowHash.some((hash) => hash === record.rowHash))
                return;

            //Check if record is duplicated in source
            if (this.__checkDuplicatedRowHash(sourceTableRecords.records.rows, record.rowHash, index)) {
                ignoredRowHash.push(record.rowHash);
                this.__tempScripts.push(`\n--ERROR: Too many record found in SOURCE database for table {${table}} and key fields ${JSON.stringify(keyFieldsMap)} !\n`);
                return;
            };

            //Check if record is duplicated in target
            let targetRecord = [];
            if (targetTableRecords.exists)
                targetRecord = targetTableRecords.records.rows.filter(function (r) {
                    return r.rowHash === record.rowHash;
                });

            if (targetRecord.length > 1) {
                ignoredRowHash.push(record.rowHash);
                this.__tempScripts.push(`\n--ERROR: Too many record found in TARGET database for table {${table}} and key fields ${JSON.stringify(keyFieldsMap)} !\n`);
                return;
            }

            //Generate sql script to add\update record in target database table
            ignoredRowHash.push(record.rowHash);
            if (targetRecord.length <= 0) { //A record with same KEY FIELDS not exists, then create a new record
                delete record.rowHash;
                this.__tempScripts.push(sql.generateInsertTableRecordScript(table, record, sourceTableRecords.records.fields, isIdentityUserValuesAllowed));
                this.__isSequenceRebaseNeeded = true;
            } else { //A record with same KEY FIELDS VALUES has been found, then update not matching fieds only
                this.__compareTableRecordFields(table, keyFieldsMap, sourceTableRecords.records.fields, record, targetRecord[0])
            }

        });

        if (targetTableRecords.exists)
            targetTableRecords.records.rows.forEach((record, index) => {
                //Check if row hash has been ignored because duplicated or already processed from source
                if (ignoredRowHash.some((hash) => hash === record.rowHash))
                    return;

                //Check if record is duplicated in target
                if (this.__checkDuplicatedRowHash(targetTableRecords.records.rows, record.rowHash, index)) {
                    ignoredRowHash.push(record.rowHash);
                    this.__tempScripts.push(`\n--ERROR: Too many record found in TARGET database for table {${table}} and key fields ${JSON.stringify(keyFieldsMap)} !\n`);
                    return;
                };

                let keyFieldsMap = this.__getKeyFieldsMap(keyFields, record);

                //Generate sql script to delete record because not exists on source database table
                this.__tempScripts.push(sql.generateDeleteTableRecordScript(table, sourceTableRecords.records.fields, keyFieldsMap));
                this.__isSequenceRebaseNeeded = true;
            });
    },
    __compareTableRecordFields: function (table, keyFieldsMap, fields, sourceRecord, targetRecord) {
        let changes = {};

        for (field in sourceRecord) {
            if (field === 'rowHash')
                continue;

            if (targetRecord[field] === undefined && this.__checkIsNewColumn(table, field)) {
                changes[field] = sourceRecord[field];
            } else if (this.__compareFieldValues(sourceRecord[field], targetRecord[field])) {
                changes[field] = sourceRecord[field];
            }
        }

        if (Object.keys(changes).length > 0) {
            this.__isSequenceRebaseNeeded = true;
            this.__tempScripts.push(sql.generateUpdateTableRecordScript(table, fields, keyFieldsMap, changes));
        }
    },
    __checkIsNewColumn: function (table, field) {
        if (global.schemaChanges.newColumns[table] &&
            global.schemaChanges.newColumns[table].some(
                (column) => {
                    return column == `"${field}"`;
                }))
            return true;
        else
            return false;
    },
    __compareFieldValues: function (sourceValue, targetValue) {
        var sourceValueType = typeof sourceValue;
        var targetValueType = typeof targetValue;



        if (sourceValueType != targetValueType)
            return false;
        else if (sourceValue instanceof Date)
            return sourceValue.getTime() !== targetValue.getTime();
        else
            return sourceValue !== targetValue
    },
    __getKeyFieldsMap: function (keyFields, record) {
        let keyFieldsMap = {};
        keyFields.forEach((item, index) => {
            keyFieldsMap[item] = record[item];
        });
        return keyFieldsMap;
    },
    __checkDuplicatedRowHash: function (records, rowHash, index) {
        return records.some(function (r, idx) {
            return (r.rowHash === rowHash && idx > index);
        });
    }
}

module.exports = helper;