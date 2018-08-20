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
    __genereateTableGrantsDefinition: function(table, role, privileges) {
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
    generateCreateSchemaScript: function(schema, owner) {
        let script = `\nCREATE SCHEMA ${schema} AUTHORIZATION ${owner};`;
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
            indexes.push(`${schema.indexes[index].definition};`);
        }

        //Generate privileges script
        let privileges = [];
        privileges.push(`ALTER TABLE ${table} OWNER TO ${schema.owner};`);
        for (let role in schema.privileges) {
            privileges = privileges.concat(this.__genereateTableGrantsDefinition(table, role, schema.privileges[role]))
        }

        let script = `\nCREATE TABLE ${table} (\n\t${columns.join(',\n\t')}\n)\n${options};\n${indexes.join('\n')}\n${privileges.join('\n')}`
            //console.log(script)
        return script;
    },
    generateAddTableColumnScript: function(table, column, schema) {

        let script = `\nALTER TABLE ${table} ADD COLUMN ${this.__generateColumnDefinition(column, schema)};`
        if (script.includes('NOT NULL') && !script.includes('DEFAULT'))
            script += hints.addColumnNotNullableWithoutDefaultValue;

        // console.log(script);

        return script;
    },
    generateChangeTableColumnScript: function(table, column, changes) {

        let definitions = []
        if (changes.hasOwnProperty('nullable'))
            definitions.push(`ALTER COLUMN ${column} ${changes.nullable? 'DROP NOT NULL': 'SET NOT NULL'}`);

        if (changes.hasOwnProperty('datatype'))
            definitions.push(`ALTER COLUMN ${column} SET DATA TYPE ${this.__generateColumnDataTypeDefinition(changes)}${hints.changeColumnDataType}`);

        if (changes.hasOwnProperty('default'))
            definitions.push(`ALTER COLUMN ${column} ${changes.default?'SET':'DROP'} DEFAULT ${changes.default||''}`);


        let script = `\nALTER TABLE ${table}\n\t${definitions.join(',\n\t')};`

        //console.log(script);

        //TODO: Should we include COLLATE when change column data type?

        return script;
    },
    generateDropTableColumnScript: function(table, column) {
        let script = `\nALTER TABLE ${table} DROP COLUMN ${column} CASCADE;${hints.dropColumn}`;
        //console.log(script);
        return script;
    },
    generateAddTableConstraintScript: function(table, constraint, schema) {
        let script = `\nALTER TABLE ${table} ADD CONSTRAINT ${constraint} ${schema.definition};`;
        //console.log(script);
        return script;
    },
    generateChangeTableConstraintScript: function(table, constraint, schema) {
        let script = `\nALTER TABLE ${table} DROP CONSTRAINT ${constraint}, ADD CONSTRAINT ${constraint} ${schema.definition};`;
        //console.log(script);
        return script;
    },
    generateDropTableConstraintScript: function(table, constraint) {
        let script = `\nALTER TABLE ${table} DROP CONSTRAINT ${constraint};`;
        //console.log(script);
        return script;
    },
    generateChangeTableOptionsScript: function(table, options) {
        let script = `\nALTER TABLE ${table} SET ${options.withOids?'WITH':'WITHOUT'} OIDS;`;
        //console.log(script);
        return script;
    },
    generateChangeIndexScript: function(index, definition) {
        let script = `\nDROP INDEX ${index}; ${definition};`;
        //console.log(script);
        return script;
    },
    generateDropIndexScript: function(index) {
        let script = `\nDROP INDEX ${index};`;
        //console.log(script);
        return script;
    },
    generateTableRoleGrantsScript: function(table, role, privileges) {
        let script = `\n${this.__genereateTableGrantsDefinition(table,role,privileges).join('\n')}`;
        //console.log(script);
        return script;
    },
    generateChangesTableRoleGrantsScript: function(table, role, changes) {
        let privileges = [];


        if (changes.hasOwnProperty('select'))
            privileges.push(`${changes.select?'GRANT':'REVOKE'} SELECT ON TABLE ${table} TO ${role};${hints.potentialRoleMissing}`);

        if (changes.hasOwnProperty('insert'))
            privileges.push(`${changes.insert?'GRANT':'REVOKE'} INSERT ON TABLE ${table} TO ${role};${hints.potentialRoleMissing}`);

        if (changes.hasOwnProperty('update'))
            privileges.push(`${changes.update?'GRANT':'REVOKE'} UPDATE ON TABLE ${table} TO ${role};${hints.potentialRoleMissing}`);

        if (changes.hasOwnProperty('delete'))
            privileges.push(`${changes.delete?'GRANT':'REVOKE'} DELETE ON TABLE ${table} TO ${role};${hints.potentialRoleMissing}`);

        if (changes.hasOwnProperty('truncate'))
            privileges.push(`${changes.truncate?'GRANT':'REVOKE'} TRUNCATE ON TABLE ${table} TO ${role};${hints.potentialRoleMissing}`);

        if (changes.hasOwnProperty('references'))
            privileges.push(`${changes.references?'GRANT':'REVOKE'} REFERENCES ON TABLE ${table} TO ${role};${hints.potentialRoleMissing}`);

        if (changes.hasOwnProperty('trigger'))
            privileges.push(`${changes.trigger?'GRANT':'REVOKE'} TRIGGER ON TABLE ${table} TO ${role};${hints.potentialRoleMissing}`);

        let script = `\n${privileges.join('\n')}`;
        console.log(script);
        return script;
    }
}

module.exports = helper;