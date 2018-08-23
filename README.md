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

Of course this library produce good sql code quality for just postgresql, but it is not enought, the aren't tools that we tried (and we tried a lot :smiley:) that can assure you about correctness of sql scripts generated, because there are a plenty of situation for which a snippet of sql code cannot be executed (e.g.: Add a new column not nullable to a table without specify a default value, or change grants pivileges to a user that not exists on destination database); then it is mandatory to review sql scripts before commit changes or release it.  
For this reason the library add an hint (all hints starts with "WARN:") as comment close to the involved sql script line, in this way it will be easier to find out potential problematic sql commands.  
This is of course our **MAIN IMPORTANT FEATURE** missing on any tried libraries that can speed up a lot when developer check if sql script is compliant to its requirements.

Finally this library is **A GREAT HELP ON DETECTING DATABASE CHANGES**, and in our case it speed up us over 50% of time spent on keep databases synchronized.

### Prepare your environment

In our DevOps, to better work with this library, to avoid any issues during development process and to keep things simple, smart and easy, we configured on each dev machine two databases: Of course one is our application database that we name ```TARGET``` and another one is our database where we make changes that we name ```SOURCE```.  
For any changes made on ```SOURCE``` database the library will generate a patch sql script for the ```TARGET``` database.

Of course when a team member checkout latest code changes from versioning (we love GIT and GITFLOW but you can use any like SVN, etc.) it should run\execute sql script patches on ```SOURCE``` database before starts on make changes; in this way all team members (also remote teams) can stay up-to-date with also latest version of the database.

### How this library works

Actually this library is just a CLI TOOL (because we love nodejs but also we works with other languages\frameworks) to stay decoupled from your IDE of choice; in this way you can use this library even if you don't work with NodeJS.

As a CLI tool and to keep things simple (easier to integrate with your custom devops) all you need to do is:
1. having a json config file named ```"pg-diff-config.json"``` where you will specify everything the library need to know
2. run from command line ```"pg-diff"``` specifying which ```configuration to use``` and a ```name``` to give to the generated script file

That's all, take your time for a coffee :smiley:!

### Getting Started

Install the library with ```npm install -g pg-diff-cli```

Create a config file in your project folder (don't forget to run ```pg-diff``` command from same folder where config file exists).
``` JSON
{
    "development": {
        "source": {
            "host": "localhost",
            "port": 5432,
            "database": "my-source-db",
            "user": "postgres",
            "password": "put-password-here"
        },
        "target": {
            "host": "localhost",
            "port": 5432,
            "database": "my-target-db",
            "user": "postgres",
            "password": "put-password-here"
        },
        "options": {
            "outputDirectory": "sqlscripts",
            "schemaNamespace": ["public", "other-namespace"],
            "author": "your-name-or-nickname-or-anything-else"
        }
    },
    "quality": {
        "source": {
            "host": "localhost",
            "port": 5432,
            "database": "my-source-db",
            "user": "postgres",
            "password": "put-password-here"
        },
        "target": {
            "host": "localhost",
            "port": 5432,
            "database": "my-target-db",
            "user": "postgres",
            "password": "put-password-here"
        },
        "options": {
            "outputDirectory": "sqlscripts",
            "schemaNamespace": ["public"],
            "author": "as-you-prefer"
        }
    }
}
```

Run the tool typing on a shell ```pg-diff development initial-script```

If you need help types ```pg-diff -h```

