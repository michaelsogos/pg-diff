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

		return config;
	}

	/**
	 * Validate the configuration schema
	 *
	 * @param {Object} config
	 */
	static ValidateCompareConfig(config) {
		if (!config.compareOptions) throw new Error('The configuration doesn\'t contains the section "compareOptions {object}" !');

		if (!config.compareOptions.outputDirectory)
			throw new Error('The configuration section "compareOptions" must contains property "outputDirectory {string}" !');

		if (!config.compareOptions.schemaCompare)
			throw new Error('The configuration section "compareOptions" must contains property "schemaCompare {object}" !');

		if (
			!config.compareOptions.schemaCompare.namespaces ||
			!Array.isArray(config.compareOptions.schemaCompare.namespaces) ||
			config.compareOptions.schemaCompare.namespaces.length <= 0
		)
			throw new Error('The configuration section "compareOptions.schemaCompare" must contains property "namespaces (array of strings}" !');

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
	 * @param {Object} config
	 */
	static ValidateMigrationConfig(config) {
		if (!config.migrationOptions) throw new Error('The configuration doesn\'t contains the section "migrationOptions {object}" !');

		if (!config.migrationOptions.historyTableSchema)
			throw new Error('The configuration section "migrationOptions" must contains property "historyTableSchema {string}" !');

		if (!config.migrationOptions.historyTableName)
			throw new Error('The configuration section "migrationOptions" must contains property "historyTableName {string}" !');

		if (!config.migrationOptions.patchesDirectory)
			throw new Error('The configuration section "migrationOptions" must contains property "patchesDirectory {string}" !');
	}
}

module.exports.ConfigHandler = ConfigHandler;
