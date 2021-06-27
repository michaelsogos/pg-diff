const path = require("path");
const options = require("./enums/options");

class ConfigHandler {
	/**
	 * Load configurations
	 *
	 * @param {String} configName The configuration name
	 * @returns {import("pg-diff-api/src/models/config")} Return the specified configuration
	 */
	static LoadConfig(configName, configPath) {
		const absoluteFilePath = path.resolve(configPath || "pg-diff-config.json");

		if (!path.extname(absoluteFilePath) || path.extname(absoluteFilePath).toLocaleLowerCase() !== ".json")
			throw new Error(`The configuration file path "${absoluteFilePath}" not include file name or it isn't a JSON file!`);

		let configFile = require(absoluteFilePath);
		if (!configFile[configName]) throw new Error(`Impossible to find the configuration with name ${configName} !`);

		/** @type {import("pg-diff-api/src/models/config")} */
		let config = configFile[configName];

		if (!config.sourceClient) throw new Error('The configuration doesn\'t contains the section "sourceClient {object}" !');

		if (!config.targetClient) throw new Error('The configuration doesn\'t contains the section "targetClient {object}" !');

		return config;
	}

	/**
	 * Validate the configuration schema
	 *
	 * @param {Map<String,String[]>} optionParams
	 * @param {Object} config
	 */
	static ValidateCompareConfig(optionParams, config) {
		this.ValidatePatchFolderOption(optionParams, config);

		if (!config.compareOptions) throw new Error('The configuration doesn\'t contains the section "compareOptions {object}" !');

		if (!config.compareOptions.outputDirectory)
			throw new Error('The configuration section "compareOptions" must contains property "outputDirectory {string}" !');

		if (!config.compareOptions.schemaCompare)
			throw new Error('The configuration section "compareOptions" must contains property "schemaCompare {object}" !');

		// if (
		// 	!config.compareOptions.schemaCompare.namespaces ||
		// 	!Array.isArray(config.compareOptions.schemaCompare.namespaces) ||
		// 	config.compareOptions.schemaCompare.namespaces.length <= 0
		// )
		// 	throw new Error('The configuration section "compareOptions.schemaCompare" must contains property "namespaces (array of strings}" !');

		if (!config.compareOptions.schemaCompare.roles || !Array.isArray(config.compareOptions.schemaCompare.roles))
			throw new Error('The configuration section "compareOptions.schemaCompare" must contains property "roles (array of strings}" !');

		if (!config.compareOptions.dataCompare)
			throw new Error('The configuration section "optcompareOptionsions" must contains property "dataCompare (object}" !');

		if (!Object.prototype.hasOwnProperty.call(config.compareOptions.dataCompare, "enable"))
			throw new Error('The configuration section "compareOptions.dataCompare" must contains property "enable (boolean}" !');
	}

	/**
	 * Validate the migration configuration schema
	 *
	 * @param {Map<String,String[]>} optionParams
	 * @param {Object} config
	 */
	static ValidateMigrationConfig(optionParams, config) {
		this.ValidatePatchFolderOption(optionParams, config);

		if (!config.migrationOptions) throw new Error('The configuration doesn\'t contains the section "migrationOptions {object}" !');

		if (!config.migrationOptions.historyTableSchema)
			throw new Error('The configuration section "migrationOptions" must contains property "historyTableSchema {string}" !');

		if (!config.migrationOptions.historyTableName)
			throw new Error('The configuration section "migrationOptions" must contains property "historyTableName {string}" !');

		if (!config.migrationOptions.patchesDirectory)
			throw new Error('The configuration section "migrationOptions" must contains property "patchesDirectory {string}" !');
	}

	/**
	 *
	 * @param {Map<String,String[]>} optionParams
	 * @param {import("pg-diff-api/src/models/config")} config
	 */
	static ValidatePatchFolderOption(optionParams, config) {
		if (optionParams.has(options.PATCH_FOLDER))
			if (optionParams.get(options.PATCH_FOLDER).length == 1 && optionParams.get(options.PATCH_FOLDER)[0])
				config.compareOptions.outputDirectory = optionParams.get(options.PATCH_FOLDER)[0];
			else throw new Error("Missing or invalid arguments for option 'PATCH FOLDER'!");
	}

	/**
	 *
	 * @param {Map<String,String[]>} optionParams
	 */
	static GetConfigFilePath(optionParams) {
		if (optionParams.has(options.CONFIG_FILEPATH))
			if (optionParams.get(options.CONFIG_FILEPATH).length == 1 && optionParams.get(options.CONFIG_FILEPATH)[0]) {
				const configFilePath = optionParams.get(options.CONFIG_FILEPATH)[0];
				if (typeof configFilePath === "string" || configFilePath instanceof String) return configFilePath;
				else throw new Error("Missing or invalid arguments for option 'CONFIG FILEPATH'!");
			} else throw new Error("Missing or invalid arguments for option 'CONFIG FILEPATH'!");
		else return "";
	}
}

module.exports.ConfigHandler = ConfigHandler;
