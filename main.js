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
var config;

__printIntro();
__readArguments();
__loadConfig();
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
    log(chalk.gray("USAGE: ") + chalk.yellow("pg-diff ") + chalk.cyan("{configuration name | or valid option}"));
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

function __readArguments() {
    var args = process.argv.slice(2);
    if (args.length != 1) {
        log(chalk.red('Missing argument!'));
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
    }
}

function __loadConfig() {
    try {
        config = require(path.resolve(process.cwd(), 'pg-diff-config.json'));
        if (!config[configName])
            throw new Error(`Impossible to find the configuration with name ${configName} !`);

        config = config[configName];

        if (!config.source)
            throw new Error('The configuration doesn\'t contains the section "source" !');

        if (!config.source.schemas || !Array.isArray(config.source.schemas) || config.source.schemas <= 0)
            throw new Error('The configuration section "source" must specify at least on schema in option "schemas" !');

        if (!config.target)
            throw new Error('The configuration doesn\'t contains the section "target" !');

        if (!config.target.schemas || !Array.isArray(config.target.schemas) || config.target.schemas <= 0)
            throw new Error('The configuration section "target" must specify at least on schema in option "schemas" !');

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
        log(chalk.yellow("Collect SOURCE database objects schema"))
        let sourceSchema = await schema.collectSchemaObjects(sourceClient, config.source.schemas);

        log();
        log();
        log(chalk.yellow("Collect TARGET database objects schema"))
        let targetSchema = await schema.collectSchemaObjects(targetClient, config.target.schemas);

        log();
        log();
        log(chalk.yellow("Compare SOURCE with TARGET database objects schema"))
        let scripts = await compare.compareSchema(sourceSchema, targetSchema);

        console.dir(scripts, { depth: null })


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