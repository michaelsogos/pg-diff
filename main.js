#!/usr/bin/env node
const CLI = require("./src/CLI").CLI;
const ConfigHandler = require("./src/ConfigHandler").ConfigHandler;
const PgDiffApi = require("pg-diff-api").PgDiff;
const chalk = require("chalk");
const { Progress } = require("clui");
const stdout = require("readline");
const pjson = require("./package.json");
const log = console.log;

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

	switch (e.code) {
		case "MODULE_NOT_FOUND":
			log(chalk.red('Please create the configuration file "pg-diff-config.json" in the same folder where you run pg-diff!'));
			break;
	}
}

/**
 * Run the tool
 */
async function Run() {
	var args = process.argv.slice(2);
	if (args.length <= 0) {
		log(chalk.red("Missing arguments!"));
		CLI.PrintHelp();
		process.exit();
	}

	switch (args[0]) {
		case "-h":
		case "--help": {
			CLI.PrintHelp();
			process.exit();
		}
		// falls through
		case "-c":
		case "--compare":
			{
				if (args.length != 3) {
					log(chalk.red("Missing arguments!"));
					CLI.PrintHelp();
					process.exit();
				}

				let config = ConfigHandler.LoadConfig(args[1]);
				ConfigHandler.ValidateCompareConfig(config);
				CLI.PrintOptions(config);

				let progressBar = new Progress(20);
				let pgDiff = new PgDiffApi(config);
				pgDiff.events.on("compare", function (message, percentage) {
					stdout.clearLine(process.stdout);
					stdout.cursorTo(process.stdout, 0);
					process.stdout.write(progressBar.update(percentage / 100) + " - " + chalk.whiteBright(message));
				});
				let scriptFilePath = await pgDiff.compare(args[2]);
				log();
				if (scriptFilePath) log(chalk.whiteBright("SQL patch file has been created succesfully at: ") + chalk.green(scriptFilePath));
				else log(chalk.yellow("No patch has been created because no differences have been found!"));
			}
			break;
		case "-ms":
		case "--migrate-to-source":
		case "-mt":
		case "--migrate-to-target":
			{
				if (args.length != 2) {
					log(chalk.red("Missing arguments!"));
					CLI.PrintHelp();
					process.exit();
				}

				let toSourceClient = false;
				if (args[0] == "-ms" || args[0] == "--migrate-to-source") toSourceClient = true;

				let config = ConfigHandler.LoadConfig(args[1]);
				ConfigHandler.ValidateMigrationConfig(config);
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
		case "-s":
		case "--save":
			{
				if (args.length != 3) {
					log(chalk.red("Missing arguments!"));
					CLI.PrintHelp();
					process.exit();
				}

				let config = ConfigHandler.LoadConfig(args[1]);
				CLI.PrintOptions(config);

				let pgDiff = new PgDiffApi(config);
				await pgDiff.save(args[2]);
				log();
				log(chalk.green(`Patch ${args[2]} has been saved!`));
			}
			break;
		default: {
			log(chalk.red("Missing arguments!"));
			CLI.PrintHelp();
			process.exit();
		}
	}
}
