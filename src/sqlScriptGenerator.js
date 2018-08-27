const hints = {
    addColumnNotNullableWithoutDefaultValue: " --WARN: Add a new column not nullable without a default value can occure in a sql error during execution!",
    changeColumnDataType: " --WARN: Change column data type can occure in a auto-casting sql error during execution, is recommended to use the keyword USING to include a casting logic!",
    dropColumn: " --WARN: Drop column can occure in data loss!",
    potentialRoleMissing: " --WARN: Grant\\Revoke privileges to a role can occure in a sql error during execution if role is missing to the target database!"
}

var helper = {
    __generateColumnDataTypeDefinition: function(columnSchema) {
        let dataType = columnSchema.datatype;
        if (columnSchema.precision) {
            let dataTypeScale = columnSchema.scale ? `,${columnSchema.scale}` : '';
            dataType += `(${columnSchema.precision}${dataTypeScale})`;
        }

        return dataType;
    },
    __generateColumnDefinition: function(column, columnSchema) {
        let defaultValue = '';
        if (columnSchema.default)
            defaultValue = `DEFAULT ${columnSchema.default}`;

        let dataType = this.__generateColumnDataTypeDefinition(columnSchema);

        return `${column} ${dataType} ${columnSchema.nullable?'NULL':'NOT NULL'} ${defaultValue}`
    },
    __generateTableGrantsDefinition: function(table, role, privileges) {
        let definitions = [];

        if (privileges.select)
            definitions.push(`GRANT SELECT ON TABLE ${table} TO ${role};${hints.potentialRoleMissing}`);

        if (privileges.insert)
            definitions.push(`GRANT INSERT ON TABLE ${table} TO ${role};${hints.potentialRoleMissing}`);

        if (privileges.update)
            definitions.push(`GRANT UPDATE ON TABLE ${table} TO ${role};${hints.potentialRoleMissing}`);

        if (privileges.delete)
            definitions.push(`GRANT DELETE ON TABLE ${table} TO ${role};${hints.potentialRoleMissing}`);

        if (privileges.truncate)
            definitions.push(`GRANT TRUNCATE ON TABLE ${table} TO ${role};${hints.potentialRoleMissing}`);

        if (privileges.references)
            definitions.push(`GRANT REFERENCES ON TABLE ${table} TO ${role};${hints.potentialRoleMissing}`);

        if (privileges.trigger)
            definitions.push(`GRANT TRIGGER ON TABLE ${table} TO ${role};${hints.potentialRoleMissing}`);

        return definitions;
    },
    __generateProcedureGrantsDefinition: function(procedure, argTypes, role, privileges) {
        let definitions = [];

        if (privileges.execute)
            definitions.push(`GRANT EXECUTE ON FUNCTION ${procedure}(${argTypes}) TO ${role};${hints.potentialRoleMissing}`);

        return definitions;
    },
    generateCreateSchemaScript: function(schema, owner) {
        let script = `\nCREATE SCHEMA ${schema} AUTHORIZATION ${owner};\n`;
        //console.log(script);
        return script;
    },
    generateCreateTableScript: function(table, schema) {
        //Generate columns script
        let columns = [];
        for (let column in schema.columns) {
            columns.push(this.__generateColumnDefinition(column, schema.columns[column]));
        }

        //Generate constraints script
        for (let constraint in schema.constraints) {
            columns.push(`CONSTRAINT ${constraint} ${schema.constraints[constraint].definition} `);
        }

        //Generate options script
        let options = `WITH ( OIDS=${schema.options.withOids.toString().toUpperCase()} )`;

        //Generate indexes script
        let indexes = [];
        for (let index in schema.indexes) {
            indexes.push(`\n${schema.indexes[index].definition};\n`);
        }

        //Generate privileges script
        let privileges = [];
        privileges.push(`ALTER TABLE ${table} OWNER TO ${schema.owner};\n`);
        for (let role in schema.privileges) {
            privileges = privileges.concat(this.__generateTableGrantsDefinition(table, role, schema.privileges[role]))
        }

        let script = `\nCREATE TABLE ${table} (\n\t${columns.join(',\n\t')}\n)\n${options};\n${indexes.join('\n')}\n${privileges.join('\n')}\n`
            //console.log(script)
        return script;
    },
    generateAddTableColumnScript: function(table, column, schema) {
        let script = `\nALTER TABLE ${table} ADD COLUMN ${this.__generateColumnDefinition(column, schema)};`
        if (script.includes('NOT NULL') && !script.includes('DEFAULT'))
            script += hints.addColumnNotNullableWithoutDefaultValue;

        // console.log(script);
        script += '\n';
        return script;
    },
    generateChangeTableColumnScript: function(table, column, changes) {
        let definitions = []
        if (changes.hasOwnProperty('nullable'))
            definitions.push(`ALTER COLUMN ${column} ${changes.nullable? 'DROP NOT NULL': 'SET NOT NULL'}`);

        if (changes.hasOwnProperty('datatype')) {
            definitions.push(`${hints.changeColumnDataType}`)
            definitions.push(`ALTER COLUMN ${column} SET DATA TYPE ${this.__generateColumnDataTypeDefinition(changes)}`);
        }

        if (changes.hasOwnProperty('default'))
            definitions.push(`ALTER COLUMN ${column} ${changes.default?'SET':'DROP'} DEFAULT ${changes.default||''}`);


        let script = `\nALTER TABLE ${table}\n\t${definitions.join(',\n\t')};\n`

        //console.log(script);

        //TODO: Should we include COLLATE when change column data type?

        return script;
    },
    generateDropTableColumnScript: function(table, column) {
        let script = `\nALTER TABLE ${table} DROP COLUMN ${column} CASCADE;${hints.dropColumn}\n`;
        //console.log(script);
        return script;
    },
    generateAddTableConstraintScript: function(table, constraint, schema) {
        let script = `\nALTER TABLE ${table} ADD CONSTRAINT ${constraint} ${schema.definition};\n`;
        //console.log(script);
        return script;
    },
    generateChangeTableConstraintScript: function(table, constraint, schema) {
        let script = `\nALTER TABLE ${table} DROP CONSTRAINT ${constraint}, ADD CONSTRAINT ${constraint} ${schema.definition};\n`;
        //console.log(script);
        return script;
    },
    generateDropTableConstraintScript: function(table, constraint) {
        let script = `\nALTER TABLE ${table} DROP CONSTRAINT ${constraint};\n`;
        //console.log(script);
        return script;
    },
    generateChangeTableOptionsScript: function(table, options) {
        let script = `\nALTER TABLE ${table} SET ${options.withOids?'WITH':'WITHOUT'} OIDS;\n`;
        //console.log(script);
        return script;
    },
    generateChangeIndexScript: function(index, definition) {
        let script = `\nDROP INDEX ${index};\n${definition};\n`;
        //console.log(script);
        return script;
    },
    generateDropIndexScript: function(index) {
        let script = `\nDROP INDEX ${index};\n`;
        //console.log(script);
        return script;
    },
    generateTableRoleGrantsScript: function(table, role, privileges) {
        let script = `\n${this.__generateTableGrantsDefinition(table,role,privileges).join('\n')}\n`;
        //console.log(script);
        return script;
    },
    generateChangesTableRoleGrantsScript: function(table, role, changes) {
        let privileges = [];

        if (changes.hasOwnProperty('select'))
            privileges.push(`${changes.select?'GRANT':'REVOKE'} SELECT ON TABLE ${table} ${changes.select?'TO':'FROM'} ${role};${hints.potentialRoleMissing}`);

        if (changes.hasOwnProperty('insert'))
            privileges.push(`${changes.insert?'GRANT':'REVOKE'} INSERT ON TABLE ${table} ${changes.insert?'TO':'FROM'} ${role};${hints.potentialRoleMissing}`);

        if (changes.hasOwnProperty('update'))
            privileges.push(`${changes.update?'GRANT':'REVOKE'} UPDATE ON TABLE ${table} ${changes.update?'TO':'FROM'} ${role};${hints.potentialRoleMissing}`);

        if (changes.hasOwnProperty('delete'))
            privileges.push(`${changes.delete?'GRANT':'REVOKE'} DELETE ON TABLE ${table} ${changes.delete?'TO':'FROM'} ${role};${hints.potentialRoleMissing}`);

        if (changes.hasOwnProperty('truncate'))
            privileges.push(`${changes.truncate?'GRANT':'REVOKE'} TRUNCATE ON TABLE ${table} ${changes.truncate?'TO':'FROM'} ${role};${hints.potentialRoleMissing}`);

        if (changes.hasOwnProperty('references'))
            privileges.push(`${changes.references?'GRANT':'REVOKE'} REFERENCES ON TABLE ${table} ${changes.references?'TO':'FROM'} ${role};${hints.potentialRoleMissing}`);

        if (changes.hasOwnProperty('trigger'))
            privileges.push(`${changes.trigger?'GRANT':'REVOKE'} TRIGGER ON TABLE ${table} ${changes.trigger?'TO':'FROM'} ${role};${hints.potentialRoleMissing}`);

        let script = `\n${privileges.join('\n')}\n`;
        //console.log(script);
        return script;
    },
    generateChangeTableOwnerScript: function(table, owner) {
        let script = `\nALTER TABLE ${table} OWNER TO ${owner};\n`;
        //console.log(script);
        return script;
    },
    generateCreateViewScript: function(view, schema) {
        //Generate privileges script
        let privileges = [];
        privileges.push(`ALTER TABLE ${view} OWNER TO ${schema.owner};`);
        for (let role in schema.privileges) {
            privileges = privileges.concat(this.__generateTableGrantsDefinition(view, role, schema.privileges[role]))
        }

        let script = `\nCREATE VIEW ${view} AS ${schema.definition}\n${privileges.join('\n')}\n`;
        //console.log(script)
        return script;
    },
    generateChangeViewScript: function(view, schema) {
        let script = `\nDROP VIEW ${view};\n${this.generateCreateViewScript(view,schema)}`;
        //console.log(script)
        return script;
    },
    generateCreateMaterializedViewScript: function(view, schema) {

        //Generate indexes script
        let indexes = [];
        for (let index in schema.indexes) {
            indexes.push(`\n${schema.indexes[index].definition};\n`);
        }

        //Generate privileges script
        let privileges = [];
        privileges.push(`ALTER TABLE ${view} OWNER TO ${schema.owner};\n`);
        for (let role in schema.privileges) {
            privileges = privileges.concat(this.__generateTableGrantsDefinition(view, role, schema.privileges[role]))
        }

        let script = `\nCREATE MATERIALIZED VIEW ${view} AS ${schema.definition}\n${indexes.join('\n')}\n${privileges.join('\n')}\n`;
        //console.log(script)
        return script;
    },
    generateChangeMaterializedViewScript: function(view, schema) {
        let script = `\nDROP MATERIALIZED VIEW ${view};\n${this.generateCreateMaterializedViewScript(view,schema)}`;
        //console.log(script)
        return script;
    },
    generateCreateProcedureScript: function(procedure, schema) {
        //Generate privileges script
        let privileges = [];
        privileges.push(`ALTER FUNCTION ${procedure}(${schema.argTypes}) OWNER TO ${schema.owner};`);
        for (let role in schema.privileges) {
            privileges = privileges.concat(this.__generateProcedureGrantsDefinition(procedure, schema.argTypes, role, schema.privileges[role]))
        }

        let script = `\n${schema.definition}\n${privileges.join('\n')}\n`;
        //console.log(script)
        return script;
    },
    generateChangeProcedureScript: function(procedure, schema) {
        let script = `\nDROP FUNCTION ${procedure}(${schema.argTypes});\n${this.generateCreateProcedureScript(procedure,schema)}`;
        //console.log(script)
        return script;
    },
    generateProcedureRoleGrantsScript: function(procedure, argTypes, role, privileges) {
        let script = `\n${this.__generateProcedureGrantsDefinition(procedure,argTypes,role,privileges).join('\n')}`;
        console.log(script);
        return script;
    },
    generateChangesProcedureRoleGrantsScript: function(procedure, argTypes, role, changes) {
        let privileges = [];

        if (changes.hasOwnProperty('execute'))
            privileges.push(`${changes.execute?'GRANT':'REVOKE'} EXECUTE ON FUNCTION ${procedure}(${argTypes}) ${changes.execute?'TO':'FROM'} ${role};${hints.potentialRoleMissing}`);

        let script = `\n${privileges.join('\n')}`;
        //console.log(script);
        return script;
    },
    generateChangeProcedureOwnerScript: function(procedure, argTypes, owner) {
        let script = `\nALTER FUNCTION ${procedure}(${argTypes}) OWNER TO ${owner};`;
        //console.log(script);
        return script;
    },
    generateUpdateTableRecordScript: function(table, fields, keyFieldsMap, changes) {
        let updates = [];
        for (let field in changes) {
            updates.push(`"${field}" = ${this.__generateSqlFormattedValue(field,fields,changes[field])}`);
        }

        let conditions = [];
        for (let condition in keyFieldsMap) {
            conditions.push(`"${condition}" = ${this.__generateSqlFormattedValue(condition, fields, keyFieldsMap[condition])}`);
        }

        let script = `\nUPDATE ${table} SET ${updates.join(', ')} WHERE ${conditions.join(' AND ')};\n`;
        return script;
    },
    generateInsertTableRecordScript: function(table, record, fields) {
        let fieldNames = [];
        let fieldValues = [];
        for (let field in record) {
            fieldNames.push(`"${field}"`);
            fieldValues.push(this.__generateSqlFormattedValue(field, fields, record[field]));
        }

        let script = `\nINSERT INTO ${table} (${fieldNames.join(', ')}) VALUES (${fieldValues.join(', ')});\n`;
        return script;
    },
    generateDeleteTableRecordScript: function(table, fields, keyFieldsMap) {
        let conditions = [];
        for (let condition in keyFieldsMap) {
            conditions.push(`"${condition}" = ${this.__generateSqlFormattedValue(condition, fields, keyFieldsMap[condition])}`);
        }

        let script = `\nDELETE FROM ${table} WHERE ${conditions.join(' AND ')};\n`;
        return script;
    },
    __generateSqlFormattedValue: function(fieldName, fields, value) {
        let dataTypeId = fields.find((field) => {
            return fieldName === field.name
        }).dataTypeID;

        let dataTypeCategory = global.dataTypes.find((dataType) => {
            return dataType.oid === dataTypeId
        }).typcategory;

        switch (dataTypeCategory) {
            case 'A': //ARRAY
            case 'D': //DATE TIME
            case 'R': //RANGE
            case 'S': //STRING
            case 'U': //BIT
                return `'${value}'`; //Value should have also curly braket
            case 'B': //BOOL
            case 'E': //ENUM
            case 'G': //GEOMETRIC
            case 'I': //NETWORK ADDRESS
            case 'N': //NUMERIC
            case 'T': //TIMESPAN
                return value;
            case 'X': //UNKNOWN
            case 'U': //USER TYPE
            case 'P': //PSEUDO TYPE
            case 'C': //COMPOSITE TYPE
            default:
                throw new Error(`The data type category ${dataTypeCategory} is not recognized!`);
        }
    }
}

module.exports = helper;