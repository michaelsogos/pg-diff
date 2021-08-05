#!/usr/bin/env node
const CLI = require("./src/CLI").CLI;
const ConfigHandler = require("./src/ConfigHandler").ConfigHandler;
const PgDiffApi = require("pg-diff-api").PgDiff;
const chalk = require("chalk");
const { Progress } = require("clui");
const stdout = require("readline");
const pjson = require("./package.json");
const log = console.log;
const actions = require("./src/enums/actions");
const options = require("./src/enums/options");

//pgTypes.setTypeParser(1114, value => new Date(Date.parse(`${value}+0000`)));

CLI.PrintIntro(pjson);

Run()
	.then(() => {
		process.exitCode = 0;
		process.exit();
	})
	.catch((err) => {
		HandleError(err);
		process.exitCode = -1;
		process.exit();
	});

/**
 *
 * @param {Error} e
 */
function HandleError(e) {
	log();
	log(chalk.red(e.stack));
	process.stderr.write(e.message);
	process.stderr.write("\n");

	switch (e.code) {
		case "MODULE_NOT_FOUND":
			log(
				chalk.red(
					'Please create the configuration file "pg-diff-config.json" in the same folder where you run pg-diff or specify config file full path with option parameter "-f"!'
				)
			);
			break;
	}
}

/**
 *
 * @param {String} lastAction
 * @param {String} currentAction
 */
function CheckDoubleActionError(lastAction, currentAction) {
	if (lastAction) {
		HandleError(new Error(`Too many execution options specified! "${lastAction}" and "${currentAction}" cannot co-exists.`));
		CLI.PrintHelp();
		process.exit();
	}
}

/**
 * Run the tool
 */
async function Run() {
	var args = process.argv.slice(2);
	if (args.length <= 0) {
		HandleError(new Error("Missing arguments!"));
	}

	let action = null;
	let lastOption = null;
	let breakLoop = false;
	/** @type {Map<String,String[]>} */
	let optionParams = new Map();
	let parsingOptionParams = false;

	for (const arg of args) {
		if (arg.startsWith("-")) {
			parsingOptionParams = true;
			breakLoop = false;
			lastOption = null;

			switch (arg) {
				case "-h":
				case "--help":
					CheckDoubleActionError(action, arg);
					action = actions.HELP;
					breakLoop = true;
					parsingOptionParams = false;
					break;
				case "-c":
				case "--compare":
					CheckDoubleActionError(action, arg);
					action = actions.COMPARE;
					lastOption = actions.COMPARE;
					if (!optionParams.has(lastOption)) optionParams.set(lastOption, []);
					break;
				case "-ms":
				case "--migrate-to-source":
					CheckDoubleActionError(action, arg);
					action = actions.MIGRATE_TO_SOURCE;
					lastOption = actions.MIGRATE_TO_SOURCE;
					if (!optionParams.has(lastOption)) optionParams.set(lastOption, []);
					break;
				case "-mt":
				case "--migrate-to-target":
					CheckDoubleActionError(action, arg);
					action = actions.MIGRATE_TO_TARGET;
					lastOption = actions.MIGRATE_TO_TARGET;
					if (!optionParams.has(lastOption)) optionParams.set(lastOption, []);
					break;
				case "-s":
				case "--save":
					CheckDoubleActionError(action, arg);
					action = actions.SAVE;
					lastOption = actions.SAVE;
					if (!optionParams.has(lastOption)) optionParams.set(lastOption, []);
					break;
				case "-p":
				case "--patch-folder":
					lastOption = options.PATCH_FOLDER;
					if (!optionParams.has(lastOption)) optionParams.set(lastOption, []);
					break;
				case "-f":
				case "--config-file":
					lastOption = options.CONFIG_FILEPATH;
					if (!optionParams.has(lastOption)) optionParams.set(lastOption, []);
					break;
				default:
					HandleError(new Error(`Invalid parameter "${arg}"!`));
					CLI.PrintHelp();
					process.exit();
			}
		} else if (parsingOptionParams) {
			optionParams.get(lastOption).push(arg);
		}

		if (breakLoop) break;
	}

	if (!action) {
		HandleError(new Error(`Missing execution options! Please specify one between -c, -ms, -mt, -s execution option.`));
		CLI.PrintHelp();
		process.exit();
	}

	switch (action) {
		case actions.HELP: {
			CLI.PrintHelp();
			process.exit();
			break;
		}
		case actions.COMPARE:
			{
				if (!optionParams.has(actions.COMPARE) || optionParams.get(actions.COMPARE).length != 2) {
					HandleError(new Error("Missing or invalid arguments for option 'COMPARE'!"));
					CLI.PrintHelp();
					process.exit();
				}

				const params = optionParams.get(actions.COMPARE);
				let config = ConfigHandler.LoadConfig(params[0], ConfigHandler.GetConfigFilePath(optionParams));
				ConfigHandler.ValidateCompareConfig(optionParams, config);
				CLI.PrintOptions(config);

				let progressBar = new Progress(20);
				let pgDiff = new PgDiffApi(config);
				pgDiff.events.on("compare", function (message, percentage) {
					stdout.clearLine(process.stdout);
					stdout.cursorTo(process.stdout, 0);
					process.stdout.write(progressBar.update(percentage / 100) + " - " + chalk.whiteBright(message));
				});
				let scriptFilePath = await pgDiff.compare(params[1]);
				log();
				if (scriptFilePath) log(chalk.whiteBright("SQL patch file has been created succesfully at: ") + chalk.green(scriptFilePath));
				else log(chalk.yellow("No patch has been created because no differences have been found!"));
			}
			break;
		case actions.MIGRATE_TO_SOURCE:
		case actions.MIGRATE_TO_TARGET:
			{
				let configName = null;
				let toSourceClient = false;

				if (action == actions.MIGRATE_TO_SOURCE) {
					if (!optionParams.has(actions.MIGRATE_TO_SOURCE) || optionParams.get(actions.MIGRATE_TO_SOURCE).length != 1) {
						HandleError(new Error("Missing or invalid arguments for option 'MIGRATE TO SOURCE'!"));
						CLI.PrintHelp();
						process.exit();
					} else {
						configName = optionParams.get(actions.MIGRATE_TO_SOURCE)[0];
						toSourceClient = true;
					}
				}

				if (action == actions.MIGRATE_TO_TARGET) {
					if (!optionParams.has(actions.MIGRATE_TO_TARGET) || optionParams.get(actions.MIGRATE_TO_TARGET).length != 1) {
						HandleError(new Error("Missing or invalid arguments for option 'MIGRATE TO TARGET'!"));
						CLI.PrintHelp();
						process.exit();
					} else configName = optionParams.get(actions.MIGRATE_TO_TARGET)[0];
				}

				let config = ConfigHandler.LoadConfig(configName, ConfigHandler.GetConfigFilePath(optionParams));
				ConfigHandler.ValidateMigrationConfig(optionParams, config);
				CLI.PrintOptions(config);

				let progressBar = new Progress(20);
				let pgDiff = new PgDiffApi(config);
				pgDiff.events.on("migrate", function (message, percentage) {
					stdout.clearLine(process.stdout);
					stdout.cursorTo(process.stdout, 0);
					process.stdout.write(progressBar.update(percentage / 100) + " - " + chalk.whiteBright(message));
				});

				let patches = await pgDiff.migrate(true, toSourceClient);
				log();
				if (patches.length <= 0) log(chalk.yellow("No new db patches have been found."));
				else {
					log(chalk.green("Following db patches have been applied:"));
					for (let patch of patches) {
						log(chalk.green(`- Patch "${patch.name}" version "${patch.version}"`));
					}
				}
			}
			break;
		case actions.SAVE:
			{
				if (!optionParams.has(actions.SAVE) || optionParams.get(actions.SAVE).length != 2) {
					HandleError(new Error("Missing or invalid arguments for option 'SAVE'!"));
					CLI.PrintHelp();
					process.exit();
				}

				const params = optionParams.get(actions.SAVE);
				let config = ConfigHandler.LoadConfig(params[0], ConfigHandler.GetConfigFilePath(optionParams));
				CLI.PrintOptions(config);

				let pgDiff = new PgDiffApi(config);
				await pgDiff.save(params[1]);
				log();
				log(chalk.green(`Patch ${params[1]} has been saved!`));
			}
			break;

		default: {
			HandleError(new Error(`Not implemented yet execution option "${action}"!`));
			CLI.PrintHelp();
			process.exit();
		}
	}
}
