## Welcome to pg-diff documentation

Essentially this CLI tool help you during your project development based on postgresql database engine to collect objects changes, create a patch sql script and keep versioned together with your application code.

### A brief on why use it

If you adopt any DevOps best practice during software development, and if you work in a team, of course you found yourself fighting on how better care about database objects changes. Generally speaking you can work in 2 different situation:
1. you use a kind of ORM that will integrate probably a migration strategy, this approch is called code-first; in this case this library is not for you :smiley: .
2. you handle database objects directly usually with a GUI tool like pgAdmin or DBeaver, this approch is called database-first; if this is your case then this library is absolutely a good companion for you.

In our long experience, passing thru many way to handle database objects changes (not just on PostgreSQL :smiley:), we understood that for both code versioning as also for software releases, code changes should stay close to database objects changes.
In this way it will be easy to apply database objects changes when software will be updated.

Another issue we resolved is about keep a numeric version of sql scripts, that in a team not works because team members should not aware about "next incremental number" and also to avoid any conflicts.
For this reason our strategy is to create a numeric version of sql scripts generated based on date and time related to NOW in UTC timezone; this helps also on working together with remote teams (image Italian team that work on same project with an Indian team).

Of course this library produce good sql code quality for just postgresql, but it is not enought, the aren't tools that we tried (and we tried a lot :smiley:) that can assure you about correctness of sql scripts generated, because there are a plenty of situation for which a snippet of sql code cannot be executed (e.g.: Add a new column not nullable to a table without specify a default value, or change grants pivileges to a user that not exists on destination database), for this reason the library add an hint (all hints starts with "WARN:") as comment close to the involved sql script line.
This is of course our **MAIN IMPORTANT FEATURE** missing on any tried libraries that can speed up a lot when developer check if sql script is compliant to its requirements.

Finally this library is **A GREAT HELP ON DETECTING DATABASE CHANGES**, and in our case it speed up us over 50% of time spent on keep databases synchronized.

### Prepare your environment

In our DevOps, to better work with this library, to avoid any issues during development process and to keep things simple, smart and easy, we configured on each dev machine two databases: Of course one is our application database that we name *TARGET* and another one is our database where we make changes that we name *SOURCE*.
For any changes made on *SOURCE* database the library will generate a patch sql script for the *TARGET* database.

Of course when a team member checkout latest code changes from versioning (we love GIT and GITFLOW but you can use any like SVN, etc.) it should run\execute sql script patches on *SOURCE* database before starts on make changes; in this way all team members (also remote teams) can stay up-to-date with also latest version of the database.

### How this library works

Actually this library is just a CLI TOOL (because we love nodejs but also we works with other languages\frameworks) to stay decoupled from your IDE of choice; in this way you can use this library even if you don't work with NodeJS.

As a CLI tool and to keep things simple (easier to integrate with your custom devops) all you need to do is:
1. having a json config file named *"pg-diff-config.json"* where you will specify everything the library need to know
2. run from command line *"pg-diff"* specifying which *configuration to use* and a *name* to give to the generated script file

That's all, take your time for a coffee :smiley:!

### Getting Started

Install library with ```npm install -g pg-diff```

You can use the [editor on GitHub](https://github.com/michaelsogos/pg-diff/edit/gh-pages/README.md) to maintain and preview the content for your website in Markdown files.

Whenever you commit to this repository, GitHub Pages will run [Jekyll](https://jekyllrb.com/) to rebuild the pages in your site, from the content in your Markdown files.

### Markdown

Markdown is a lightweight and easy-to-use syntax for styling your writing. It includes conventions for

```markdown
Syntax highlighted code block

# Header 1
## Header 2
### Header 3

- Bulleted
- List

1. Numbered
2. List

**Bold** and _Italic_ and `Code` text

[Link](url) and ![Image](src)
```

For more details see [GitHub Flavored Markdown](https://guides.github.com/features/mastering-markdown/).

### Jekyll Themes

Your Pages site will use the layout and styles from the Jekyll theme you have selected in your [repository settings](https://github.com/michaelsogos/pg-diff/settings). The name of this theme is saved in the Jekyll `_config.yml` configuration file.

### Support or Contact

Having trouble with Pages? Check out our [documentation](https://help.github.com/categories/github-pages-basics/) or [contact support](https://github.com/contact) and we’ll help you sort it out.
