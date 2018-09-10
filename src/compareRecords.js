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
    compareTablesRecords: function(options, sourceTablesRecords, targetTablesRecords) {
        this.__updateProgressbar(0.0, 'Comparing tables records ...');
        const progressBarStep = 1.0 / Object.keys(options).length;

        for (let table in options) {
            let tableName = `"${options[table].schema||'public'}"."${table}"`
            this.__updateProgressbar(this.__progressBarValue, `Comparing table ${tableName} records`);
            this.__tempScripts = [];

            if (!sourceTablesRecords[table] || !sourceTablesRecords[table].exists) {
                this.__tempScripts.push(`\n--ERROR: Table ${tableName} not found on SOURCE database for comparison!\n`);
            } else {
                if (!targetTablesRecords[table] || !targetTablesRecords[table].exists)
                    this.__tempScripts.push(`\n--ERROR: Table ${tableName} not found on TARGET database for comparison!\n`);
                this.__compareTableRecords(tableName, options[table].keyFields, sourceTablesRecords[table], targetTablesRecords[table]);
            }

            this.__appendScripts(`SYNCHRONIZE TABLE ${tableName} RECORDS`);
            this.__progressBarValue += progressBarStep;
        }

        this.__updateProgressbar(1.0, 'Tables records compared!');

        return this.__finalScripts;
    },
    __compareTableRecords: function(table, keyFields, sourceTableRecords, targetTableRecords) {
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
                targetRecord = targetTableRecords.records.rows.filter(function(r) {
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
                this.__tempScripts.push(sql.generateInsertTableRecordScript(table, record, sourceTableRecords.records.fields));
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
            });
    },
    __compareTableRecordFields: function(table, keyFieldsMap, fields, sourceRecord, targetRecord) {
        let changes = {};
        for (field in sourceRecord) {
            if (field === 'rowHash')
                continue;

            if (sourceRecord[field] !== targetRecord[field]) {
                changes[field] = sourceRecord[field];
            }
        }

        if (Object.keys(changes).length > 0)
            this.__tempScripts.push(sql.generateUpdateTableRecordScript(table, fields, keyFieldsMap, changes));
    },
    __getKeyFieldsMap: function(keyFields, record) {
        let keyFieldsMap = {};
        keyFields.forEach((item, index) => {
            keyFieldsMap[item] = record[item];
        });
        return keyFieldsMap;
    },
    __checkDuplicatedRowHash: function(records, rowHash, index) {
        return records.some(function(r, idx) {
            return (r.rowHash === rowHash && idx > index);
        });
    }
}

module.exports = helper;