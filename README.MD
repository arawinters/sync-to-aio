# Sync to AIO script
A convenient little script to let me kick off a maven based build on a local feature branch
and deploy it to an remote environment. preferably without any manual intervention.

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
By default, this script is located some five levels deep inside the parent project(from where maven is executed). You'll most likely have to change that if this is being used on something other than what it was originally written for. Might be a good starting point, or code snippet so I'm gonna leave this here.

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
