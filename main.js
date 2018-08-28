#!/usr/bin/env node

const chalk = require('chalk');
const { Spinner } = require('clui');
const figlet = require('figlet');
const fs = require('fs');
const path = require('path');
const pjson = require('./package.json');
const schema = require('./src/retrieveSchema');
const compareSchema = require('./src/compareSchema');
const data = require('./src/retrieveData');
const compareRecords = require('./src/compareRecords');
const { Client } = require('pg');
const log = console.log;

global.configName = '';
global.scriptName = '';
global.config = null;

__printIntro();
__readArguments();
__loadConfig();
__printOptions();
__initDbConnections();
__run();


function __printHelp() {
    log();
    log();
    log(chalk.magenta("=============================="));
    log(chalk.magenta("===   pg-diff-cli   HELP   ==="));
    log(chalk.magenta("=============================="));
    log();
    log(chalk.gray('OPTION     \t\tDESCRIPTION'));
    log(chalk.green('-h, --help\t\t') + chalk.blue('To show this help.'));
    log();
    log();
    log(chalk.gray("USAGE:   ") + chalk.yellow("pg-diff ") + chalk.cyan("{configuration name | or valid option} {script name}"));
    log(chalk.gray("EXAMPLE: ") + chalk.yellow("pg-diff ") + chalk.cyan("development my-script"));
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
    log(chalk.yellow("    Script Author: ") + chalk.green(global.config.options.author));
    log(chalk.yellow(" Output Directory: ") + chalk.green(path.resolve(process.cwd(), global.config.options.outputDirectory)));
    log(chalk.yellow("Schema Namespaces: ") + chalk.green(global.config.options.schemaNamespace));
    log(chalk.yellow("Idempotent Script: ") + chalk.green(global.config.options.idempotent ? 'ENABLED' : 'DISABLED'));
    log(chalk.yellow("     Data Compare: ") + chalk.green(global.config.options.dataCompare.enable ? 'ENABLED' : 'DISABLED'));
    log();
}

function __readArguments() {
    var args = process.argv.slice(2);
    if (args.length <= 0) {
        log(chalk.red('Missing arguments!'));
        __printHelp();
        process.exit();
    }

    if (args.length == 1)
        switch (args[0]) {
            case '-h':
            case '--help':
                __printHelp();
                process.exit();
        }

    if (args.length == 2) {
        global.configName = args[0];
        global.scriptName = args[1];
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

        if (!global.config.options.outputDirectory)
            throw new Error('The configuration section "options" must contains property "outputDirectory (string)" !');

        if (!global.config.options.schemaNamespace)
            throw new Error('The configuration section "options" must contains property "schemaNamespace (array of strings)" !');

        if (!global.config.options.hasOwnProperty('idempotent'))
            throw new Error('The configuration section "options" must contains property "idempotent (boolean)" !');

        if (!global.config.options.dataCompare)
            throw new Error('The configuration section "options" must contains property "dataCompare (object)" !');

        if (!global.config.options.dataCompare.hasOwnProperty('enable'))
            throw new Error('The configuration section "options.dataCompare" must contains property "enable (boolean)" !');

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

function __initDbConnections() {
    var spinner = new Spinner(chalk.blue('Connecting to databases ...'), ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷']);
    spinner.start();

    global.sourceClient = new Client({
        user: global.config.source.user,
        host: global.config.source.host,
        database: global.config.source.database,
        password: global.config.source.password,
        port: global.config.source.port,
    })
    global.sourceClient.connect();
    log(chalk.whiteBright(`Connected to [${global.config.source.host}:${global.config.source.port}/${global.config.source.database}] `) + chalk.green('✓'));

    global.targetClient = new Client({
        user: global.config.target.user,
        host: global.config.target.host,
        database: global.config.target.database,
        password: global.config.target.password,
        port: global.config.target.port,
    });
    global.targetClient.connect();
    log(chalk.whiteBright(`Connected to [${global.config.target.host}:${global.config.target.port}/${global.config.target.database}] `) + chalk.green('✓'));

    spinner.stop();
}

async function __run() {
    try {
        log();
        log(chalk.yellow("Collect SOURCE database objects"));
        let sourceSchema = await schema.collectSchemaObjects(sourceClient, global.config.options.schemaNamespace);

        log();
        log();
        log(chalk.yellow("Collect TARGET database objects"));
        let targetSchema = await schema.collectSchemaObjects(targetClient, global.config.options.schemaNamespace);

        log();
        log();
        log(chalk.yellow("Compare SOURCE with TARGET database objects"));
        let scripts = compareSchema.compareDatabaseObjects(sourceSchema, targetSchema);

        //console.dir(scripts, { depth: null });

        if (global.config.options.dataCompare.enable) {
            global.dataTypes = (await sourceClient.query(`SELECT oid, typcategory FROM pg_type`)).rows;

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

    } catch (e) {
        __handleError(e);

        process.exitCode = -1;
        process.exit();
    }
}

function __handleError(e) {
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