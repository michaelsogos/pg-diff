#!/usr/bin/env node

const chalk = require('chalk');
const { Spinner } = require('clui');
const figlet = require('figlet');
const fs = require('fs');
const path = require('path');
const pjson = require('./package.json');
const schema = require('./src/retrieveSchema');
const compareSchema = require('./src/compareSchema');
const data = require('./src/retrieveRecords');
const compareRecords = require('./src/compareRecords');
const { Client } = require('pg');
const pgTypes = require('pg').types;
const log = console.log;

pgTypes.setTypeParser(1114, (value) => new Date(Date.parse(`${value}+0000`)));

global.configName = '';
global.scriptName = '';
global.config = null;
global.replayMigration = false;
global.schemaChanges = {
    newColumns: {},
};

__printIntro();
__readArguments().catch((err) => {
    __handleError(err);
    process.exitCode = -1;
    process.exit();
});

function __printHelp() {
    log();
    log();
    log(chalk.magenta("=============================="));
    log(chalk.magenta("===   pg-diff-cli   HELP   ==="));
    log(chalk.magenta("=============================="));
    log();
    log(chalk.gray('OPTION                 \t\tDESCRIPTION'));
    log(chalk.green('-h,  --help           \t\t') + chalk.blue('To show this help.'));
    log(chalk.green('-c,  --compare        \t\t') + chalk.blue('To run compare and generate a patch file.'));
    log(chalk.green('-m,  --migrate        \t\t') + chalk.blue('To run migration applying all missing patch files.'));
    /* log(chalk.green('-mu, --migrate-upto   \t\t') + chalk.blue('To run migration applying all patch files till the specified patch file.')); */
    log(chalk.green('-mr, --migrate-replay \t\t') + chalk.blue('To run migration applying all missing or failed or stuck patch files.'));
    log(chalk.green('-s, --save            \t\t') + chalk.blue('To save\\register patch on migration history table without executing the script.'));
    log();
    log();
    log(chalk.gray(" TO COMPARE: ") + chalk.yellow("pg-diff ") + chalk.gray("-c ") + chalk.cyan("configuration-name script-name"));
    log(chalk.gray("    EXAMPLE: ") + chalk.yellow("pg-diff ") + chalk.gray("-c ") + chalk.cyan("development my-script"));
    log();
    log(chalk.gray(" TO MIGRATE: ") + chalk.yellow("pg-diff ") + chalk.gray("[-m | -mr] ") + chalk.cyan("configuration-name"));
    log(chalk.gray("    EXAMPLE: ") + chalk.yellow("pg-diff ") + chalk.gray("-m ") + chalk.cyan("development"));
    log(chalk.gray("    EXAMPLE: ") + chalk.yellow("pg-diff ") + chalk.gray("-mr ") + chalk.cyan("development"));
    /*     log();
        log(chalk.gray(" TO MIGRATE: ") + chalk.yellow("pg-diff ") + chalk.gray("-mu ") + chalk.cyan("configuration-name patch-file-name"));
        log(chalk.gray("    EXAMPLE: ") + chalk.yellow("pg-diff ") + chalk.gray("-mu ") + chalk.cyan("development 20182808103040999_my-script.sql")); */
    log();
    log(chalk.gray("TO REGISTER: ") + chalk.yellow("pg-diff ") + chalk.gray("-s ") + chalk.cyan("configuration-name patch-file-name"));
    log(chalk.gray("    EXAMPLE: ") + chalk.yellow("pg-diff ") + chalk.gray("-s ") + chalk.cyan("development 20182808103040999_my-script.sql"));
    log();
    log();
}

function __printIntro() {
    log(chalk.yellow(figlet.textSync(pjson.name, { horizontalLayout: 'full' })));
    log();
    log(chalk.blue("     Author: ") + chalk.green(pjson.author));
    log(chalk.blue("    Version: ") + chalk.green(pjson.version));
    log(chalk.blue(" PostgreSQL: ") + chalk.green(pjson.pgver));
    log(chalk.blue("    License: ") + chalk.green(pjson.license));
    log(chalk.blue("Description: ") + chalk.green(pjson.description));
    log();
}

function __printOptions() {
    log();
    log(chalk.gray('CONFIGURED OPTIONS'))
    log(chalk.yellow("         Script Author: ") + chalk.green(global.config.options.author));
    log(chalk.yellow("      Output Directory: ") + chalk.green(path.resolve(process.cwd(), global.config.options.outputDirectory)));
    log(chalk.yellow("     Schema Namespaces: ") + chalk.green(global.config.options.schemaCompare.namespaces));
    log(chalk.yellow("     Idempotent Script: ") + chalk.green(global.config.options.schemaCompare.idempotentScript ? 'ENABLED' : 'DISABLED'));
    log(chalk.yellow("          Data Compare: ") + chalk.green(global.config.options.dataCompare.enable ? 'ENABLED' : 'DISABLED'));
    log();
}

async function __readArguments() {
    var args = process.argv.slice(2);
    if (args.length <= 0) {
        log(chalk.red('Missing arguments!'));
        __printHelp();
        process.exit();
    }

    switch (args[0]) {
        case '-h':
        case '--help':
            {
                __printHelp();
                process.exit();
            }
        case '-c':
        case '--compare':
            {
                if (args.length != 3) {
                    log(chalk.red('Missing arguments!'));
                    __printHelp();
                    process.exit();
                }
                global.configName = args[1];
                global.scriptName = args[2];
                __loadConfig();
                __validateCompareConfig();
                __printOptions();
                await __initDbConnections();
                await __runComparison();
            }
            break;
        case '-m':
        case '--migrate':
        case '-mr':
        case '--migrate-replay':
            {
                if (args.length != 2) {
                    log(chalk.red('Missing arguments!'));
                    __printHelp();
                    process.exit();
                }

                if (args[0] == '-mr' || args[0] == '--migrate-replay')
                    global.replayMigration = true;

                global.configName = args[1];
                __loadConfig();
                __validateMigrationConfig();
                __printOptions();
                await __initDbConnections();
                await __runMigration();
            }
            break;
        case '-s':
        case '--save':
            {
                if (args.length != 3) {
                    log(chalk.red('Missing arguments!'));
                    __printHelp();
                    process.exit();
                }
                global.configName = args[1];
                global.scriptName = args[2];
                __loadConfig();
                __printOptions();
                await __initDbConnections();
                await __runSavePatch();
            }
            break;
        default:
            {
                log(chalk.red('Missing arguments!'));
                __printHelp();
                process.exit();
            }
    }
}

function __loadConfig() {
    try {
        let configFile = require(path.resolve(process.cwd(), 'pg-diff-config.json'));
        if (!configFile[global.configName])
            throw new Error(`Impossible to find the configuration with name ${global.configName} !`);

        global.config = configFile[global.configName];

        if (!global.config.options)
            throw new Error('The configuration section "options" must exists !');

        if (!global.config.source)
            throw new Error('The configuration doesn\'t contains the section "source (object)" !');

        if (!global.config.target)
            throw new Error('The configuration doesn\'t contains the section "target (object)" !');

    } catch (e) {
        __handleError(e);
        process.exitCode = -1;
        process.exit();
    }
}

function __validateCompareConfig() {
    try {
        if (!global.config.options.outputDirectory)
            throw new Error('The configuration section "options" must contains property "outputDirectory (string)" !');

        if (!global.config.options.schemaCompare)
            throw new Error('The configuration section "options" must contains property "schemaCompare (object)" !');

        if (!global.config.options.schemaCompare.hasOwnProperty("namespaces"))
            throw new Error('The configuration section "options.schemaCompare" must contains property "namespaces (array of strings)" !');

        if (!global.config.options.schemaCompare.hasOwnProperty('idempotentScript'))
            throw new Error('The configuration section "options.schemaCompare" must contains property "idempotentScript (boolean)" !');

        if (!global.config.options.dataCompare)
            throw new Error('The configuration section "options" must contains property "dataCompare (object)" !');

        if (!global.config.options.dataCompare.hasOwnProperty('enable'))
            throw new Error('The configuration section "options.dataCompare" must contains property "enable (boolean)" !');

    } catch (e) {
        __handleError(e);
        process.exitCode = -1;
        process.exit();
    }
}

function __validateMigrationConfig() {
    try {

        if (!global.config.options.migration)
            throw new Error('The configuration section "options" must contains property "migration (object)" !');

        if (!global.config.options.migration.hasOwnProperty("tableSchema"))
            throw new Error('The configuration section "options.migration" must contains property "tableSchema (string)" !');

        if (!global.config.options.migration.hasOwnProperty('tableName'))
            throw new Error('The configuration section "options.migration" must contains property "tableName (string)" !');

    } catch (e) {
        __handleError(e);
        process.exitCode = -1;
        process.exit();
    }
}

async function __initDbConnections() {
    log();
    var spinner = new Spinner(chalk.blue('Connecting to source database ...'), ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷']);
    spinner.start();

    global.sourceClient = new Client({
        user: global.config.source.user,
        host: global.config.source.host,
        database: global.config.source.database,
        password: global.config.source.password,
        port: global.config.source.port,
    });

    await global.sourceClient.connect();
    spinner.stop();
    global.sourceDatabaseVersion = __parseSemVersion((await global.sourceClient.query("SELECT current_setting('server_version')")).rows[0].current_setting);
    log(chalk.whiteBright(`Connected to PostgreSQL ${global.sourceDatabaseVersion.value} on [${global.config.source.host}:${global.config.source.port}/${global.config.source.database}] `) + chalk.green('✓'));

    var spinner = new Spinner(chalk.blue('Connecting to target database ...'), ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷']);
    spinner.start();

    global.targetClient = new Client({
        user: global.config.target.user,
        host: global.config.target.host,
        database: global.config.target.database,
        password: global.config.target.password,
        port: global.config.target.port,
    });

    await global.targetClient.connect();
    spinner.stop();
    global.targetDatabaseVersion = __parseSemVersion((await global.targetClient.query("SELECT current_setting('server_version')")).rows[0].current_setting);
    log(chalk.whiteBright(`Connected to PostgreSQL ${global.targetDatabaseVersion.value} on [${global.config.target.host}:${global.config.target.port}/${global.config.target.database}] `) + chalk.green('✓'));

}

async function __runComparison() {
    log();
    log(chalk.yellow("Collect SOURCE database objects"));
    let sourceSchema = await schema.collectSchemaObjects(global.sourceClient, global.config.options.schemaCompare.namespaces, global.sourceDatabaseVersion);

    log();
    log();
    log(chalk.yellow("Collect TARGET database objects"));
    let targetSchema = await schema.collectSchemaObjects(global.targetClient, global.config.options.schemaCompare.namespaces, global.targetDatabaseVersion);

    log();
    log();
    log(chalk.yellow("Compare SOURCE with TARGET database objects"));
    let scripts = compareSchema.compareDatabaseObjects(sourceSchema, targetSchema);

    //console.dir(scripts, { depth: null });

    if (global.config.options.dataCompare.enable) {
        global.dataTypes = (await sourceClient.query(`SELECT oid, typcategory, typname FROM pg_type`)).rows;

        log();
        log();
        log(chalk.yellow("Collect SOURCE tables records"));
        let sourceTablesRecords = await data.collectTablesRecords(sourceClient, global.config.options.dataCompare.tables);

        log();
        log();
        log(chalk.yellow("Collect TARGET tables records"));
        let targetTablesRecords = await data.collectTablesRecords(targetClient, global.config.options.dataCompare.tables);

        log();
        log();
        log(chalk.yellow("Compare SOURCE with TARGET database table records"));
        scripts = scripts.concat(compareRecords.compareTablesRecords(global.config.options.dataCompare.tables, sourceTablesRecords, targetTablesRecords));
    } else {
        log();
        log();
        log(chalk.yellow("Data compare not enabled!"));
    }

    let scriptFilePath = await __saveSqlScript(scripts);

    log();
    log();
    log(chalk.whiteBright("SQL patch file has been created succesfully at: ") + chalk.green(scriptFilePath));

    process.exit();
}

function __handleError(e) {
    log();
    log(chalk.red(e));
    log(chalk.magenta(e.stack));

    switch (e.code) {
        case 'MODULE_NOT_FOUND':
            log(chalk.red('Please create the configuration file "pg-diff-config.json" in the same folder where you run pg-diff!'));
            break;
    }
}

async function __saveSqlScript(scriptLines) {
    return new Promise((resolve, reject) => {
        const now = new Date()
        const fileName = `${(now).toISOString().replace(/[-:\.TZ]/g, '')}_${global.scriptName}.sql`;
        const scriptPath = path.resolve(process.cwd(), global.config.options.outputDirectory, fileName);

        var file = fs.createWriteStream(scriptPath);

        file.on('error', reject);

        file.on('finish', () => resolve(scriptPath));

        let titleLength = global.config.options.author.length > (now).toISOString().length ? global.config.options.author.length : (now).toISOString().length;

        file.write(`/******************${'*'.repeat(titleLength+2)}***/\n`);
        file.write(`/*** SCRIPT AUTHOR: ${global.config.options.author.padEnd(titleLength)} ***/\n`);
        file.write(`/***    CREATED ON: ${(now).toISOString().padEnd(titleLength)} ***/\n`);
        file.write(`/******************${'*'.repeat(titleLength+2)}***/\n`);

        scriptLines.forEach(function(line) {
            file.write(line);
        });

        file.end();
    });
}

async function __runMigration() {
    global.dataTypes = (await sourceClient.query(`SELECT oid, typcategory, typname FROM pg_type`)).rows;
    const migratePatch = require('./src/migratePatch');
    await migratePatch.migrate();

    process.exit();
}

async function __runSavePatch() {
    global.dataTypes = (await sourceClient.query(`SELECT oid, typcategory, typname FROM pg_type`)).rows;
    const migratePatch = require('./src/migratePatch');
    await migratePatch.savePatch();

    process.exit();
}

function __parseSemVersion(version) {
    if (typeof(version) != 'string') { return false; }
    var splittedVersion = version.split('.');

    return {
        major: parseInt(splittedVersion[0]) || 0,
        minor: parseInt(splittedVersion[1]) || 0,
        patch: parseInt(splittedVersion[2]) || 0,
        value: version
    }
}