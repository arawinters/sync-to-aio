/*jshint esversion: 6 */
const fs = require('fs');
const notifier = require('node-notifier');
var Spinner = require('cli-spinner').Spinner;
var FEAioHelper = require('./module');
var cmdLineArgs = require('commander');

/* start project specific deployment config options */
var projectCfg = {
  scriptRoot: __dirname,
  projectRoot: __dirname +'/../../../../../',
  remoteTarget:  '/var/data/www/hm-webapp.tar.gz',
  buildGzipFileFirst: true
}
// where result of local build puts generated tar.gz
projectCfg.localTarget  = projectCfg.projectRoot + 'hm-webapp/target/hm-webapp.tar.gz';
// optional deployment config file (see https://atom.io/packages/sftp-deployment)
// this is necessary for one-click, otherwise enter interactive mode
projectCfg.deploymentConfigPath = projectCfg.projectRoot+'deployment-config.json';

/* -------------------  first try and grab necessary parameters from command line ------------------- */
var cmdArgs = process.argv.slice(2);
cmdLineArgs
  .version('0.0.4')
  .option('-i, --ip <ip>', 'ip address of remote host to connect to.')
  .option('-u, -user, --user <username>','user account to use.','root')
  .option('-p, -pass, --pass <password>','password for user account.','aerohive')
  .option('-port, --port <port>','port to connect to.',22)
  .option('-path, --path <path>','remote path upload and explode in.',"/var/data/www/")
  .option('-s, --skipBuild','will skip the maven build and just try to upload existing tar.gz to aio.', false)
  // additional help
  cmdLineArgs.on('--help', function(){
    console.log('\n\n  Examples:\n');
    console.log('   node sync -i 10.16.139.277');
    console.log('   node sync -i 10.16.139.277 -u systemuser -p pa55w0rd');
    console.log('   node sync -i 10.16.139.277 -s');

    console.log('\n\n  Configuration File:\n');
    console.log('   A json file can be created in the root of the project directory, ');
    console.log('   which contains the necessary options so you dont have to specify host/user/pass each time.\n');
    console.log('   this is necessary for one-click deployment.. yknow, if thats like a thing you want. =P');

    console.log('   see: https://atom.io/packages/sftp-deployment\n');
  });
  // parse options
  cmdLineArgs.parse(process.argv);

//console.log('cmdArgs: ',JSON.stringify(cmdLineArgs, null, 2));
if(cmdLineArgs.user || cmdLineArgs.User){
  projectCfg.remoteUser = cmdLineArgs.user || cmdLineArgs.User;
}
if(cmdLineArgs.pass || cmdLineArgs.Pass){
  projectCfg.remotePassword = cmdLineArgs.pass || cmdLineArgs.Pass;
}
if(cmdLineArgs.ip || cmdLineArgs.Ip){
  projectCfg.remoteHost = cmdLineArgs.ip || cmdLineArgs.Ip;
}
if(cmdLineArgs.path || cmdLineArgs.Path){
  projectCfg.remotePath = cmdLineArgs.path || cmdLineArgs.Path;
  projectCfg.remotePath = (projectCfg.remotePath && projectCfg.remotePath.substr(-1) != '/') ? projectCfg.remotePath+'/' : projectCfg.remotePath; // append trailing slash if not already there
}
if(cmdLineArgs.port || cmdLineArgs.Port){
  projectCfg.remotePort = cmdLineArgs.port || cmdLineArgs.Port;
}
if(cmdLineArgs.skipBuild || cmdLineArgs.SkipBuild){
  projectCfg.buildGzipFileFirst = false;
}
// double check that tar.gz files exists in destination, otherwise force compilation
if(!fs.existsSync(projectCfg.localTarget)){
  console.warn(projectCfg.localTarget+ 'does not exist. forcing compilation step.');
  projectCfg.buildGzipFileFirst = true;
}

let buildAndSync = function(projectCfg){
  return new Promise(function(resolve, reject){
    var buildMethod = projectCfg.buildGzipFileFirst ? 'doMavenBuild' : 'skipMavenBuild';

    if(buildMethod == 'doMavenBuild'){
      notifier.notify({
        title: 'FE Build',
        message: 'hive-frontend build started',
        /* icon: path.join(__dirname, 'coulson.jpg'), */
        sound: false,
        wait: true
      });
    }
    // kick process off
    FEAioHelper[buildMethod](projectCfg).then(()=>{
      if(buildMethod == 'doMavenBuild'){
        notifier.notify({
          title: 'FE Build',
          message: 'hive-frontend build finished',
          /* icon: path.join(__dirname, 'coulson.jpg'), */
          sound: false,
          wait: true
        });
      }

      // ----- now kick off sync of tar.gz
      FEAioHelper.doScpTransfer({
        host: projectCfg.remoteHost,
        user: projectCfg.remoteUser,
        password: projectCfg.remotePassword,
        port: projectCfg.remotePort,
        remotePath: projectCfg.remotePath
      }, projectCfg).then((result) => {
          FEAioHelper.postScpTransfer({
            host: projectCfg.remoteHost,
            username: projectCfg.remoteUser,
            password: projectCfg.remotePassword,
            port: projectCfg.remotePort,
            remotePath: projectCfg.remotePath
          }, projectCfg).then((flag) => {
            resolve(flag);
          });
      }, (err)=>{
        var _errMsg = 'There was a problem connecting to remote host('+projectCfg.remoteHost+'). double check that ip/user/pass are correct.';
        reject(_errMsg);
      });

    }, (err)=>{
      if(buildMethod == 'doMavenBuild'){
        reject('Build Failed!');
      }else{
        reject('Syncronization Failed!');
      }
    });
  });

}


/* ------------  next see if a deployment config exists, if so, use those parameters  ------------ */
if(projectCfg.remoteUser && projectCfg.remoteHost && projectCfg.remotePassword){
  // we have enough to "try" to sync
  buildAndSync(projectCfg).then((success)=>{
    // build/sync succeeded
    notifier.notify({
      title: 'AIO SYNCED',
      message: 'hive-frontend synced with '+projectCfg.remoteHost,
      /* icon: path.join(__dirname, 'coulson.jpg'), */
      sound: true,
      wait: true
    });
  },(err)=>{
    //build-sync enountered issues
    console.log('\n');
    console.error(err);
    notifier.notify({
      title: 'Error',
      message: err,
      /* icon: path.join(__dirname, 'coulson.jpg'), */
      sound: true
    });
  });
}else if(fs.existsSync(projectCfg.deploymentConfigPath)){
  // we have a deployment config json, try that
  var deploymentConfig = require(projectCfg.deploymentConfigPath);
  if(deploymentConfig){
    if(deploymentConfig.host){ projectCfg.remoteHost = deploymentConfig.host; }
    if(deploymentConfig.username){ projectCfg.remoteUser = deploymentConfig.username; }
    if(deploymentConfig.password){ projectCfg.remotePassword = deploymentConfig.password; }
    if(deploymentConfig.port){ projectCfg.remotePort = deploymentConfig.port; }
    if(deploymentConfig.remotePath){
      projectCfg.remotePath = deploymentConfig.remotePath;
      projectCfg.remotePath = (projectCfg.remotePath && projectCfg.remotePath.substr(-1) != '/') ? projectCfg.remotePath+'/' : projectCfg.remotePath;
    }
  }

  buildAndSync(projectCfg).then((success)=>{
    // build/sync succeeded
    notifier.notify({
      title: 'AIO SYNCED',
      message: 'hive-frontend synced with '+projectCfg.remoteHost,
      /* icon: path.join(__dirname, 'coulson.jpg'), */
      sound: true,
      wait: true
    });
  },(err)=>{
    //build-sync enountered issues
    console.log('\n');
    console.error(err);
    notifier.notify({
      title: 'Error',
      message: err,
      /* icon: path.join(__dirname, 'coulson.jpg'), */
      sound: true
    });
  });

}else{
  // we dont have the required options to even try to sync to host
  console.warn('username, password, and host are requited for trying to syncronize. check options with -h option.');

}
