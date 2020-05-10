const path = require("path");

class ConfigHandler {
	/**
	 * Load configurations
	 *
	 * @param {String} configName The configuration name
	 * @returns {Object} Return the specified configuration
	 */
	static LoadConfig(configName) {
		let configFile = require(path.resolve(process.cwd(), "pg-diff-config.json"));
		if (!configFile[configName]) throw new Error(`Impossible to find the configuration with name ${configName} !`);

		let config = configFile[configName];

		if (!config.sourceClient) throw new Error('The configuration doesn\'t contains the section "sourceClient {object}" !');

		if (!config.targetClient) throw new Error('The configuration doesn\'t contains the section "targetClient {object}" !');

		if (!config.compareOptions) throw new Error('The configuration section "options" must exists !');

		return config;
	}

	/**
	 * Validate the configuration schema
	 *
	 * @param {Object} config
	 */
	static ValidateCompareConfig(config) {
		if (!config.compareOptions.outputDirectory)
			throw new Error('The configuration section "options" must contains property "outputDirectory {string}" !');

		if (!config.compareOptions.schemaCompare)
			throw new Error('The configuration section "options" must contains property "schemaCompare {object}" !');

		if (!config.compareOptions.schemaCompare.hasOwnProperty("namespaces"))
			throw new Error('The configuration section "options.schemaCompare" must contains property "namespaces (array of strings}" !');

		if (!config.compareOptions.dataCompare)
			throw new Error('The configuration section "options" must contains property "dataCompare (object}" !');

		if (!config.compareOptions.dataCompare.hasOwnProperty("enable"))
			throw new Error('The configuration section "options.dataCompare" must contains property "enable (boolean}" !');
	}

	/**
	 * Validate the migration configuration schema
	 *
	 * @param {Object} config
	 */
	static ValidateMigrationConfig(config) {
		if (!config.compareOptions.migration) throw new Error('The configuration section "options" must contains property "migration {object}" !');

		if (!config.compareOptions.migration.hasOwnProperty("tableSchema"))
			throw new Error('The configuration section "options.migration" must contains property "tableSchema {string}" !');

		if (!config.compareOptions.migration.hasOwnProperty("tableName"))
			throw new Error('The configuration section "options.migration" must contains property "tableName {string}" !');
	}
}

module.exports.ConfigHandler = ConfigHandler;
