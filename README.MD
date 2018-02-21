# Sync to AIO script
A convenient little script to let me kick off a hive-frontend build on a local feature branch
and deploy it to an aio. preferably without any manual intervention.

pass the -h flag to get a full list of options.
```bash
node sync -h
```

## Requirements
this script is packaged as a submodule to limit dependency bloat on the parent project.
go to the root of the script(this directory). to run the script from the package directory itself do:
```bash
npm install
node sync -h
```
the script can also be run from the parent project root as well, but you'll have to install the dependencies manually. to
do that you can do:
```bash
npm install cli-spinner commander maven node-notifier pom-parser promise-sftp ssh2  
node hm-webapp/src/main/scripts/sync-to-aio/sync.js -s
```
Please, do not include the --save or --save-dev options when doing the dependency install above.

## Usage:
build/transfer/backup/xplode using settings specified in deployment-config.json
```bash
node sync
```
skip build if tar.gz already present
```bash
node sync -s
```
build and deploy to .277
```bash
node sync -i 10.16.139.277
```
build and deploy using alternate auth details.
```bash
node sync -u mickeyMouse -p mickyspass -i 10.16.139.277
```

## Authentication

### Configuration File
A json file can be created in the root of the project directory,
which contains the necessary options so you dont have to specify host/user/pass each time.
this is necessary for one-click deployment.. yknow, if thats like a thing you want.

see: https://atom.io/packages/sftp-deployment

### Command line
The username and password can be specified at run time via the -u and -p flags.
see: last example above.
