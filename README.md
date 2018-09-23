## Welcome to pg-diff documentation

Essentially this CLI tool help you during your project development based on postgresql database engine to collect objects changes, create a patch sql script and keep versioned together with your application code.

### A brief on why use it

If you adopt any DevOps best practice during software development, and if you work in a team, of course you found yourself fighting on how better care about database objects changes. Generally speaking you can work in 2 different situation:
1. you use a kind of ORM that will integrate probably a migration strategy, this approch is called code-first; in this case this library is not for you :smiley:.
2. you handle database objects directly usually with a GUI tool like pgAdmin or DBeaver, this approch is called database-first; if this is your case then this library is absolutely a good companion for you.

In our long experience, passing thru many way to handle database objects changes (not just on PostgreSQL :smiley:), we understood that for both code versioning as also for software releases, code changes should stay close to database objects changes.  
In this way it will be easy to apply database objects changes when software will be updated.

Another issue we resolved is about keep a numeric version of sql scripts, that in a team not works because team members should not aware about "next incremental number" and also to avoid any conflicts.  
For this reason our strategy is to create a numeric version of sql scripts generated based on date and time related to NOW in UTC timezone; this helps also on working together with remote teams (image Italian team that work on same project with an Indian team).

Of course this library produce good sql code quality for just postgresql, but it is not enought, the aren't tools that we tried (and we tried a lot :smiley:) that can assure you about correctness of sql scripts generated, because there are a plenty of situation for which a snippet of sql code cannot be executed (e.g.: Add a new column not nullable to a table without specify a default value, or change grants pivileges to a user that not exists on destination database); then it is mandatory to **review sql scripts** before commit changes or release it.  
For this reason the library add an hint (all hints starts with "WARN:" or "ERROR:") as comment close to the involved sql script line, in this way it will be easier to find out potential problematic sql commands.  
This is of course our **MAIN IMPORTANT FEATURE** missing on any tried libraries that can speed up a lot when developer check if sql script is compliant to its requirements.

Finally this library is **A GREAT HELP ON DETECTING DATABASE CHANGES**, and in our case it speed up us over 50% of time spent on keep databases synchronized.

### Prepare your environment

In our DevOps, to better work with this library, to avoid any issues during development process and to keep things simple, smart and easy, we configured on each dev machine two databases: Of course one is our application database that we name ```TARGET``` and another one is our database where we make changes that we name ```SOURCE```.  
For any changes made on ```SOURCE``` database the library will generate a patch sql script for the ```TARGET``` database.

Of course when a team member checkout latest code changes from versioning (we love GIT and GITFLOW but you can use any like SVN, etc.) it should run\execute sql script patches on ```SOURCE``` database before starts on make changes; in this way all team members (also remote teams) can stay up-to-date with also latest version of the database.

### How this library works

Actually this library is just a CLI tool (because we love nodejs but also we works with other languages\frameworks) to stay decoupled from your IDE of choice; in this way you can use this library even if you don't work with NodeJS.

As a CLI tool and to keep things simple (easier to integrate with your custom devops) all you need to do is:
1. having a json config file named ```"pg-diff-config.json"``` where you will specify everything the library need to know
2. run from command line ```"pg-diff"``` specifying which ```configuration to use``` and a ```name``` to give to the generated script file

That's all, take your time for a coffee :smiley:!

### Getting Started

Install the library with:  
```bash
npm install -g pg-diff-cli
```

Create a config file in your project folder like the below example:  
```javascript
{
    "development": { //At least one configuration must exists, but you can have many
        "source": { //Specify here connection to the source database
            "host": "localhost", //Ip address or hostname
            "port": 5432, //Server port
            "database": "my-source-db", //Database name
            "user": "postgres", //Username to access to database, better to have admin rights to access to pg_catalog schema
            "password": "put-password-here" //Password to access to database
        },
        "target": { //Specify here connection to the target database
            "host": "localhost",
            "port": 5432,
            "database": "my-target-db",
            "user": "postgres",
            "password": "put-password-here"
        },
        "options": { //This section is mandatory
            "author": "your-name-or-nickname-or-anything-else", //This option is mandatory but the string can be empty
            "outputDirectory": "sqlscripts", //Folder relative to the position of the configuration file where to save sql scripts 
            "schemaNamespace": {
                "namespaces": ["public", "other-namespace"], //List of comma-separated schema names for which retrieve objects to be compared
                "idempotentScript": true //When true will create safe pgsql code in order to not throw exceptions in case of re-execution of the script, when false will create standard sql code but in case for any reason the script fail during execution it could be hard to rollback changes and re-execution probably will throw exceptions
            },
            "dataCompare": { //This option is mandatory
                "enable": true, //False to disable record comparing
                "tables": { //This option is mandatory in case the above "enable" is true
                    "my-table-name": { //The name of the table without schema
                        "keyFields": ["list-of-key-fields-name"], //The comma-separated list of fields name that can be used to identify rows uniquely
                        "schema": "public or any-other-namespace" //The name of the schema where table exists, if not specified "public" will be used instead
                    },
                    "my-table-2-name": {
                        "keyFields": ["list-of-key-fields-name"]
                    }
                }
            },
            "migration": { //This section is mandatory only if you want to use our migration strategy
                "tableSchema": "public", //This is the schema name where to create a "migrations history" table
                "tableName": "migrations" //This is the table name where to save "migrations history"
            }            
        }
    }
}
```

Run the tool typing on a shell:  
```bash
pg-diff -c development initial-script
```
It will generate a file like: **20180828103045123_initial-script.sql** under the **{outputDirectory}** folder.  

If you need help types:  
```bash
pg-diff -h
```

### Command line options
Since version ```1.1.0``` a lot of improvements and new features has been added to this library; following a complete list and example:

##### Creating a patch
Call library with options **-c** passing the **configuration name** and a **name for patch**.  
It will create the sql patch file under configured output folder.  
```bash
pg-diff -c development my-first-patch
```

##### Migrating a patch
Call library with options **-m** ( or **-mr** to re-execute ignoring latest execution status) passing the **configuration name**, automatically all not yet applied script will be executed.  
Migration strategy in any case will **ignore any succesfully script executed, even with -mr option**.  
```bash
pg-diff -m development
```

##### Registering patch without execute it
Call library with option **-s** passing the **configuration name** and the **patch file name**.  
It will register the patch in status DONE on migration history table.  
```bash
pg-diff -s development 20180923221043142_my-patch.sql
```

### Team workflow
Of course this library can be used by your-self only, but it has been created with TEAM WORK needs in mind.  
The suggested workflow is:
1. Create two local database  
    a. first db where make changes on both schema and data; suppose that db name is **appdb_dev**  
    b. second db which is the application database where to apply our created patches; suppose that db name is **appdb**  
2. Change the config file to having two configuration  
    a. the first one is used to compare and migrate from **SOURCE**, in our case it is **appdb_dev**, to **TARGET**, in our case it is **appdb**  
    b. the second one is used to just migrate and keep updated our **TARGET** db, that is the opposite from above configuration, in our case it is **appdb_dev**  
3. Make changes on **appdb_dev** and run comparison using **first configuration**  
4. Check and review the generated sql script patch file  
5. Migrate the generated patch script to db **appdb** using again the **first configuration**  
6. Register the generated patch script to db **appdb_dev**, this time using the **second configuration**; it is needed to avoid execution of created patch files on db **appdb_dev** generated by you at point *3.* It will be usefull when later we will try to keep updated our "db for changes"  
7. Commit (and push if you use GIT) your patch file within your code changes  
8. Checkout latest changes from your code versioning repository  
9. Supposing that other team members made changes on db commiting their generated patches, we need to keep up-to-date our "db for changes":  
    a. Run a migration to db **appdb_dev** using the **second configuration**  
    b. Run again a migration to db **appdb** using the **first configuration**  
    
**WARNING:  
When your project is going to use also comparison feature for data records (not just schema), is possible that different team members are going to add new records in pretty same time.  
To avoid conflict or data-loss we suggest to inform team members about the changes before commiting; in this way other team members can still create their own new records using a different value for KEY FIELDS.**


### Problems or missing feature?

As any other software, this library can be improved, so please for any question don't exitate to open an issue on github [here](https://github.com/michaelsogos/pg-diff/issues).

