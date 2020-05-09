const sql = require("./sqlScriptGenerator");
const path = require("path");
const textReader = require("line-by-line");
const fs = require("fs");
const chalk = require("chalk");

var helper = {
	__status: {
		TO_APPLY: "TODO",
		IN_PROGRESS: "WIP",
		DONE: "DONE",
		ERROR: "ERROR",
	},
	__migrationsHistoryTableExists: false,
	__fullMigrationsHistoryTableName: `"${global.config.options.migration.tableSchema}"."${global.config.options.migration.tableName}"`,
	__migrationsHistoryTableConstraintName: `"${global.config.options.migration.tableName}_pkey"`,
	__migrationsHistoryTableSchema: {
		columns: {
			version: {
				nullable: false,
				datatype: "varchar",
				dataTypeID: 1043,
				default: "",
				precision: 17,
				scale: null,
			},
			name: {
				nullable: false,
				datatype: "varchar",
				dataTypeID: 1043,
				default: null,
				precision: null,
				scale: null,
			},
			status: {
				nullable: false,
				datatype: "varchar",
				dataTypeID: 1043,
				default: "''",
				precision: 5,
				scale: null,
			},
			last_message: {
				nullable: true,
				datatype: "varchar",
				dataTypeID: 1043,
				default: null,
				precision: null,
				scale: null,
			},
			script: {
				nullable: false,
				datatype: "varchar",
				dataTypeID: 1043,
				default: "''",
				precision: null,
				scale: null,
			},
			applied_on: {
				nullable: true,
				datatype: "timestamp",
				dataTypeID: 1114,
				default: null,
				precision: null,
				scale: null,
			},
		},
		constraints: {},
		// options: {
		//     withOids: false,
		// },
		indexes: {},
		privileges: {},
		owner: global.config.target.user,
	},
	applyPatch: async function (patchFileInfo) {
		await helper.__applyPatchFile(patchFileInfo);
	},
	getLatestPatchApplied: async function () {
		let sql = `SELECT "version" FROM ${helper.__fullMigrationsHistoryTableName} ORDER BY "version" DESC LIMIT 1;`;
		let result = await global.targetClient.query(sql);
		let lastVersionApplied = 0;

		if (result.rows.length > 0) lastVersionApplied = result.rows[0].version;

		return bigInt(lastVersionApplied);
	},
	savePatch: async function () {
		await helper.__prepareMigrationsHistoryTable();

		let scriptsFolder = path.resolve(process.cwd(), global.config.options.outputDirectory);
		let scriptFile = path.resolve(scriptsFolder, global.scriptName);

		if (!fs.existsSync(scriptFile)) throw new Error(`The patch file ${scriptFile} does not exists!`);

		let patchFileInfo = helper.__getPatchFileInfo(global.scriptName, scriptsFolder);
		await helper.__addRecordToHistoryTable(patchFileInfo.version, patchFileInfo.name);
		console.log(chalk.green(`The patch version={${patchFileInfo.version}} and name={${patchFileInfo.name}} has been registered.`));

		await helper.__updateRecordToHistoryTable(helper.__status.DONE, "", "", patchFileInfo.version);
		console.log(chalk.green(`The patch version={${patchFileInfo.version}} and name={${patchFileInfo.name}} has been saved in status 'DONE'.`));
	},
	migrate: async function () {
		await helper.__prepareMigrationsHistoryTable();

		let scriptsFolder = path.resolve(process.cwd(), global.config.options.outputDirectory);
		let scriptFiles = fs
			.readdirSync(scriptsFolder)
			.sort()
			.filter((file) => {
				return file.match(/.*\.(sql)/gi);
			});

		for (let index in scriptFiles) {
			let patchFileInfo = helper.__getPatchFileInfo(scriptFiles[index], scriptsFolder);
			let patchStatus = await helper.__checkPatchStatus(patchFileInfo);

			switch (patchStatus) {
				case helper.__status.IN_PROGRESS:
					{
						if (!global.replayMigration)
							throw new Error(
								`The patch version={${patchFileInfo.version}} and name={${patchFileInfo.name}} is still in progress! Use command argument "-mr" to replay this script.`
							);

						await helper.applyPatch(patchFileInfo);
					}
					break;
				case helper.__status.ERROR:
					{
						if (!global.replayMigration)
							throw new Error(
								`The patch version={${patchFileInfo.version}} and name={${patchFileInfo.name}} encountered an error! Use command argument "-mr" to replay this script.`
							);

						await helper.applyPatch(patchFileInfo);
					}
					break;
				case helper.__status.DONE:
					console.log(
						chalk.yellow(
							`The patch version={${patchFileInfo.version}} and name={${patchFileInfo.name}} has been already applied, it will be skipped.`
						)
					);
					break;
				case helper.__status.TO_APPLY:
					await helper.applyPatch(patchFileInfo);
					console.log(chalk.green(`The patch version={${patchFileInfo.version}} and name={${patchFileInfo.name}} has been applied.`));
					break;
				default:
					throw new Error(
						`The status "${args[0]}" not recognized! Impossible to apply patch version={${patchFileInfo.version}} and name={${patchFileInfo.name}}.`
					);
			}
		}
	},
	async __checkPatchStatus(patchFileInfo) {
		let sql = `SELECT "status" FROM ${helper.__fullMigrationsHistoryTableName} WHERE "version" = '${patchFileInfo.version}' AND "name" = '${patchFileInfo.name}'`;
		let response = await global.targetClient.query(sql);

		if (response.rows.length > 1)
			throw new Error(
				`Too many patches found on migrations history table "${helper.__fullMigrationsHistoryTableName}" for patch version=${patchFileInfo.version} and name=${patchFileInfo.name}!`
			);

		if (response.rows.length < 1) return helper.__status.TO_APPLY;
		else return response.rows[0].status;
	},
	__getPatchFileInfo(filename, filepath) {
		let indexOfSeparator = filename.indexOf("_");
		let version = filename.substring(0, indexOfSeparator);
		let name = filename.substring(indexOfSeparator + 1).replace(".sql", "");

		if (indexOfSeparator < 0 || !/^\d+$/.test(version))
			throw new Error(`The path file name ${filename} is not compatible with conventioned pattern {version}_{path name}.sql !`);

		let patchInfo = {
			version: version,
			name: name,
			fileName: filename,
			filePath: filepath,
		};

		return patchInfo;
	},
	__applyPatchFile: function (patchFileInfo) {
		return new Promise(async (resolve, reject) => {
			try {
				let scriptPatch = patchFileInfo;
				scriptPatch.command = "";
				scriptPatch.message = "";

				await helper.__addRecordToHistoryTable(scriptPatch.version, scriptPatch.name);

				let reader = new textReader(path.resolve(scriptPatch.filePath, scriptPatch.fileName));

				reader.on("error", (err) => {
					reject(err);
				});

				let readingBlock = false;
				let patchError = null;

				reader.on("line", function (line) {
					if (readingBlock) {
						if (line.startsWith("--- END")) {
							readingBlock = false;
							reader.pause();
							helper
								.__executePatchScript(scriptPatch)
								.then(() => {
									reader.resume();
								})
								.catch((err) => {
									patchError = err;
									reader.close();
									reader.resume();
								});
						} else {
							//TODO: Here we must use same line ending of the file, else a STRING will change eventually from CRLF into LF and subsequent compare will detect as different!
							//E.g.: If i compare an XML string which contains CRLF, it will be "migrated" with LF only; next time a compare of same field will check it as different because the line ending.
							scriptPatch.command += `${line}\n`;
						}
					}

					if (!readingBlock && line.startsWith("--- BEGIN")) {
						readingBlock = true;
						scriptPatch.command = "";
						scriptPatch.message = line;
					}
				});

				reader.on("end", function () {
					if (patchError)
						helper
							.__updateRecordToHistoryTable(helper.__status.ERROR, patchError.toString(), scriptPatch.command, scriptPatch.version)
							.then(() => {
								reject(patchError);
							})
							.catch((err) => {
								reject(err);
							});
					else
						helper
							.__updateRecordToHistoryTable(helper.__status.DONE, "", "", scriptPatch.version)
							.then(() => {
								resolve();
							})
							.catch((err) => {
								reject(err);
							});
				});
			} catch (e) {
				reject(e);
			}
		});
	},
	__executePatchScript: async function (scriptPatch) {
		await helper.__updateRecordToHistoryTable(helper.__status.IN_PROGRESS, scriptPatch.message, scriptPatch.command, scriptPatch.version);
		await global.targetClient.query(scriptPatch.command);
	},
	__updateRecordToHistoryTable: async function (status, message, script, patchVersion) {
		let changes = {
			status: status,
			last_message: message,
			script: script,
			applied_on: new Date(),
		};

		let filterConditions = {
			version: patchVersion,
		};

		let command = sql.generateUpdateTableRecordScript(
			helper.__fullMigrationsHistoryTableName,
			helper.__getFieldDataTypeIDs(),
			filterConditions,
			changes
		);
		await global.targetClient.query(command);
	},
	__addRecordToHistoryTable: async function (patchVersion, patchName) {
		let changes = {
			version: patchVersion,
			name: patchName,
			status: helper.__status.TO_APPLY,
			last_message: "",
			script: "",
			applied_on: null,
		};

		let options = {
			constraintName: helper.__migrationsHistoryTableConstraintName,
		};

		let command = sql.generateMergeTableRecord(helper.__fullMigrationsHistoryTableName, helper.__getFieldDataTypeIDs(), changes, options);
		await global.targetClient.query(command);
	},
	__getFieldDataTypeIDs: function () {
		let fields = [];
		for (let column in helper.__migrationsHistoryTableSchema.columns) {
			fields.push({
				name: column,
				dataTypeID: helper.__migrationsHistoryTableSchema.columns[column].dataTypeID,
			});
		}
		return fields;
	},
	__prepareMigrationsHistoryTable: async function () {
		if (!helper.__migrationsHistoryTableExists) {
			helper.__migrationsHistoryTableSchema.constraints[helper.__migrationsHistoryTableConstraintName] = {
				type: "p",
				definition: 'PRIMARY KEY ("version")',
			};

			helper.__migrationsHistoryTableSchema.privileges[global.config.target.user] = {
				select: true,
				insert: true,
				update: true,
				delete: true,
				truncate: true,
				references: true,
				trigger: true,
			};

			let saveIdempotentSetting = global.config.options.schemaCompare.idempotentScript;
			global.config.options.schemaCompare.idempotentScript = true;

			let sqlScript = sql.generateCreateTableScript(helper.__fullMigrationsHistoryTableName, helper.__migrationsHistoryTableSchema);
			await global.targetClient.query(sqlScript);

			helper.__migrationsHistoryTableExists = true;
			global.config.options.schemaCompare.idempotentScript = saveIdempotentSetting;
		}
	},
};

module.exports = helper;
