import chalk from "chalk";
const figlet = require("figlet");
const path = require("path");
const log = console.log;

class CLI {
	/**
	 * Print initial CLI information
	 * @param {Object} pjson The package json
	 */
	static PrintIntro(pjson) {
		log(chalk.yellow(figlet.textSync(pjson.name, { horizontalLayout: "full" })));
		log();
		log(chalk.blue("     Author: ") + chalk.green(pjson.author));
		log(chalk.blue("    Version: ") + chalk.green(pjson.version));
		log(chalk.blue(" PostgreSQL: ") + chalk.green(pjson.pgver));
		log(chalk.blue("    License: ") + chalk.green(pjson.license));
		log(chalk.blue("Description: ") + chalk.green(pjson.description));
		log();
	}

	/**
	 * Print help documentation
	 */
	static PrintHelp() {
		log();
		log();
		log(chalk.magenta("=============================="));
		log(chalk.magenta("===   pg-diff-cli   HELP   ==="));
		log(chalk.magenta("=============================="));
		log();
		log(chalk.gray("OPTION                      \t\tDESCRIPTION"));
		log(chalk.green("-h,  --help                \t\t") + chalk.blue("To show this help."));
		log(chalk.green("-c,  --compare             \t\t") + chalk.blue("To run compare and generate a patch file."));
		log(chalk.green("-ms, --migrate-to-source   \t\t") + chalk.blue("To run migration applying all missing patch files to SOURCE CLIENT."));
		log(chalk.green("-mt, --migrate-to-target   \t\t") + chalk.blue("To run migration applying all missing patch files to TARGET CLIENT."));
		log(
			chalk.green("-f,  --config-file         \t\t") +
				chalk.blue("To specify where to find config file, otherwise looks for 'pg-diff-config.json' on current working directory.")
		);
		log(
			chalk.green("-p,  --patch-folder        \t\t") +
				chalk.blue("To set patch folder where save\\retrieve patches (it will override configuration).")
		);
		log(
			chalk.green("-s,  --save                \t\t") +
				chalk.blue("To save\\register patch on migration history table without executing the script.")
		);
		log();
		log();
		log(chalk.gray(" TO COMPARE: ") + chalk.yellow("pg-diff ") + chalk.gray("-c ") + chalk.cyan("configuration-name script-name"));
		log(chalk.gray("    EXAMPLE: ") + chalk.yellow("pg-diff ") + chalk.gray("-c ") + chalk.cyan("development my-script"));
		log();
		log(chalk.gray(" TO MIGRATE: ") + chalk.yellow("pg-diff ") + chalk.gray("[-ms | -mt] ") + chalk.cyan("configuration-name"));
		log(chalk.gray("    EXAMPLE: ") + chalk.yellow("pg-diff ") + chalk.gray("-ms ") + chalk.cyan("development"));
		log(chalk.gray("    EXAMPLE: ") + chalk.yellow("pg-diff ") + chalk.gray("-mt ") + chalk.cyan("development"));
		log();
		log(chalk.gray("TO REGISTER: ") + chalk.yellow("pg-diff ") + chalk.gray("-s ") + chalk.cyan("configuration-name patch-file-name"));
		log(chalk.gray("    EXAMPLE: ") + chalk.yellow("pg-diff ") + chalk.gray("-s ") + chalk.cyan("development 20182808103040999_my-script.sql"));
		log();
		log();
	}

	/**
	 * Print configuration options
	 *
	 * @param {Object} config The configuration
	 */
	static PrintOptions(config) {
		log();
		log(chalk.gray("CONFIGURED OPTIONS"));
		log(chalk.yellow("         Script Author: ") + chalk.green(config.compareOptions.author));
		log(chalk.yellow("      Output Directory: ") + chalk.green(path.resolve(process.cwd(), config.compareOptions.outputDirectory)));
		let schemasMessage =
			config.compareOptions.schemaCompare.namespaces && config.compareOptions.schemaCompare.namespaces.length
				? config.compareOptions.schemaCompare.namespaces
				: "will be retrieve dynamically from database";
		log(chalk.yellow("     Schema Namespaces: ") + chalk.green(schemasMessage));
		log(chalk.yellow("          Data Compare: ") + chalk.green(config.compareOptions.dataCompare.enable ? "ENABLED" : "DISABLED"));
		log();
	}
}

module.exports.CLI = CLI;
