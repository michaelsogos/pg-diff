#!/usr/bin/env node

const chalk = require('chalk');
const { Spinner } = require('clui');
const figlet = require('figlet');
const fs = require('fs');
const path = require('path');
const pjson = require('./package.json');
const schema = require('./src/schema');
const compare = require('./src/compare');
const { Client } = require('pg');
const log = console.log;

var configName;
var scriptName;
var config;

__printIntro();
__readArguments();
__loadConfig();
__printOptions();
__initDbConnections();
__run();


function __printHelp() {
    log(chalk.magenta("|==================|"));
    log(chalk.magenta("|== pg-diff help ==|"));
    log(chalk.magenta("|==================|"));
    log();
    log(chalk.gray('OPTION     \t\tDESCRIPTION'));
    log(chalk.green('-h, --help \t\t') + chalk.blue('To show this help.'));
    log();
    log();
    log(chalk.gray("USAGE:   ") + chalk.yellow("pg-diff ") + chalk.cyan("{configuration name | or valid option} {script name}"));
    log(chalk.gray("EXAMPLE: ") + chalk.yellow("pg-diff ") + chalk.cyan("development my-script"));
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
    log(chalk.yellow("    Script Author: ") + chalk.green(config.options.author));
    log(chalk.yellow(" Output Directory: ") + chalk.green(path.resolve(process.cwd(), config.options.outputDirectory)));
    log(chalk.yellow("Schema Namespaces: ") + chalk.green(config.options.schemaNamespace));
    log();
}

function __readArguments() {
    var args = process.argv.slice(2);
    if (args.length != 2) {
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
        default:
            configName = args[0];
            scriptName = args[1];
    }
}

function __loadConfig() {
    try {
        config = require(path.resolve(process.cwd(), 'pg-diff-config.json'));
        if (!config[configName])
            throw new Error(`Impossible to find the configuration with name ${configName} !`);

        config = config[configName];

        if (!config.options)
            throw new Error('The configuration section "options" must exists !');

        if (!config.options.outputDirectory)
            throw new Error('The configuration section "options" must contains property "outputDirectory" !');

        if (!config.options.schemaNamespace)
            throw new Error('The configuration section "options" must contains property "schemaNamespace" !');

        if (!config.source)
            throw new Error('The configuration doesn\'t contains the section "source" !');

        if (!config.target)
            throw new Error('The configuration doesn\'t contains the section "target" !');

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
        user: config.source.user,
        host: config.source.host,
        database: config.source.database,
        password: config.source.password,
        port: config.source.port,
    })
    global.sourceClient.connect();
    log(chalk.whiteBright(`Connected to [${config.source.host}:${config.source.port}/${config.source.database}] `) + chalk.green('✓'));

    global.targetClient = new Client({
        user: config.target.user,
        host: config.target.host,
        database: config.target.database,
        password: config.target.password,
        port: config.target.port,
    });
    global.targetClient.connect();
    log(chalk.whiteBright(`Connected to [${config.target.host}:${config.target.port}/${config.target.database}] `) + chalk.green('✓'));

    spinner.stop();
}

async function __run() {
    try {
        log();
        log(chalk.yellow("Collect SOURCE database objects"))
        let sourceSchema = await schema.collectSchemaObjects(sourceClient, config.options.schemaNamespace);

        log();
        log();
        log(chalk.yellow("Collect TARGET database objects"))
        let targetSchema = await schema.collectSchemaObjects(targetClient, config.options.schemaNamespace);

        log();
        log();
        log(chalk.yellow("Compare SOURCE with TARGET database objects"))
        let scripts = compare.compareDatabaseObjects(sourceSchema, targetSchema);

        //console.dir(scripts, { depth: null });

        await __saveSqlScript(scripts);

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
        const fileName = `${(now).toISOString().replace(/[-:\.TZ]/g, '')}_${scriptName}.sql`;
        const scriptPath = path.resolve(process.cwd(), config.options.outputDirectory, fileName);

        var file = fs.createWriteStream(scriptPath);

        file.on('error', reject);

        file.on('finish', resolve);

        let titleLength = config.options.author.length > (now).toISOString().length ? config.options.author.length : (now).toISOString().length;

        file.write(`/******************${'*'.repeat(titleLength+2)}***/\n`);
        file.write(`/*** SCRIPT AUTHOR: ${config.options.author.padEnd(titleLength)} ***/\n`);
        file.write(`/***    CREATED ON: ${(now).toISOString().padEnd(titleLength)} ***/\n`);
        file.write(`/******************${'*'.repeat(titleLength+2)}***/\n`);


        scriptLines.forEach(function(line) {
            file.write(line);
        });

        file.end();
    });
}