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
		if (!configFile[configName]) throw new Error(`Not able to find the configuration with name ${configName} !`);

		let config = configFile[configName];

		if (!config.sourceClient) throw new Error('The configuration doesn\'t contain the section "sourceClient {object}" !');

		if (!config.targetClient) throw new Error('The configuration doesn\'t contain the section "targetClient {object}" !');

		return config;
	}

	/**
	 * Validate the configuration schema
	 *
	 * @param {Object} config
	 */
	static ValidateCompareConfig(config) {
		if (!config.compareOptions) throw new Error('The configuration doesn\'t contain the section "compareOptions {object}" !');

		if (!config.compareOptions.outputDirectory)
			throw new Error('The configuration section "compareOptions" must contain property "outputDirectory {string}" !');

		if (!config.compareOptions.schemaCompare)
			throw new Error('The configuration section "compareOptions" must contain property "schemaCompare {object}" !');

		if (!config.compareOptions.schemaCompare.namespaces)
			throw new Error('The configuration section "compareOptions.schemaCompare" must contain property "namespaces (array of strings}" !');

		if (!config.compareOptions.dataCompare)
			throw new Error('The configuration section "optcompareOptionsions" must contain property "dataCompare (object}" !');

		if (!config.compareOptions.dataCompare.enable && config.compareOptions.dataCompare.enable != false)
			throw new Error('The configuration section "compareOptions.dataCompare" must contain property "enable (boolean}" !');
	}

	/**
	 * Validate the migration configuration schema
	 *
	 * @param {Object} config
	 */
	static ValidateMigrationConfig(config) {
		if (!config.migrationOptions) throw new Error('The configuration doesn\'t contain the section "migrationOptions {object}" !');

		if (!config.migrationOptions.historyTableSchema)
			throw new Error('The configuration section "migrationOptions" must contain property "historyTableSchema {string}" !');

		if (!config.migrationOptions.historyTableName)
			throw new Error('The configuration section "migrationOptions" must contain property "historyTableName {string}" !');

		if (!config.migrationOptions.patchesDirectory)
			throw new Error('The configuration section "migrationOptions" must contain property "patchesDirectory {string}" !');
	}
}

module.exports.ConfigHandler = ConfigHandler;
