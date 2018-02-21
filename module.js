/*jshint esversion: 6 */
const PomParser = require("pom-parser");
const PromiseSftp = require('promise-sftp');
var SshClient = require('ssh2').Client;
var Spinner = require('cli-spinner').Spinner;

module.exports = {
  /**
   * execute maven build.
   * @param  {Object} projCfg configuration options for project.
   * @return {Promise}        promise to resolve on build completion.
   */
  doMavenBuild: function(projCfg){
    if(projCfg && projCfg.projectRoot){
      let mvn = require('maven').create({
        cwd: projCfg.projectRoot
      });
      return mvn.execute(['clean', 'install']);
    }else{
      let mvn = require('maven').create(); // try from current context ??? this almost certainly wont work
      return mvn.execute(['clean', 'install']);
    }
  },
  /**
   * stub method that resolves immediately
   * @return {Promise}
   */
  skipMavenBuild: function(){
    return new Promise((resolve, reject)=>{
      resolve();
    });
  },
  /**
   * Transfer hm-webapp.tar.gz to remote host. archive existing snapshot dir.
   * @param  {Object} connCfg connection options for ssh2
   * @param  {Object} projCfg project options
   * @return {Promise}        promise to resolve or reject.
   */
  doScpTransfer: function(connCfg, projCfg){
    var _retPromise = new Promise(function(resolve, reject) {
      var sftp = new PromiseSftp();
      process.stdout.write('\n');
      var spnnr1 = new Spinner('Uploading to '+ connCfg.host +'.. %s');
      spnnr1.setSpinnerString(20);
      spnnr1.start();

      sftp.connect(connCfg)
      .then(function (serverMessage) {
        spnnr1.stop();
        return sftp.put(projCfg.localTarget, projCfg.remoteTarget);
      }, function(err){ console.error(err); spnnr1.stop(); reject(err); })
      .then(function(list){
        return sftp.list(projCfg.remotePath);
      }, function(err){ reject(err); })
      .then(function (list) {
        var hmWebApp = list.find((fObj) => {
          return fObj.name == 'hm-webapp'
        });
        if(hmWebApp){
          var _newName = projCfg.remotePath+'hm-webapp.bak.'+ [hmWebApp.date.getHours(), hmWebApp.date.getMinutes()].join('-') +'.' +[hmWebApp.date.getMonth()+1, hmWebApp.date.getDate(), hmWebApp.date.getFullYear()].join('-');
          console.log('\nrenaming existing snapshot: '+_newName);
          return sftp.rename(projCfg.remotePath+'hm-webapp', _newName);
        }
        return list
      }, function(err){ reject(err); })
      .then(function(list){
        return sftp.list(projCfg.remoteDir);
      }, function(err){ reject(err); })
      .then(function (list) {
        //process.stdout.write('\n');
        sftp.end();
        resolve(list);
      })
    });
    return _retPromise;
  },
  /**
   * Unpack tar.gz on remote host. then create symbolic link pointing to static snapshot directory(for isDev=true).
   * @param  {Object} connCfg connection options for ssh2
   * @param  {Object} projCfg project options
   * @return {Promise}        promise to resolve or reject.
   */
  postScpTransfer: function(connCfg, projCfg){
    var _retPromise = new Promise(function(resolve, reject) {
      // open up ssh and unzip tar.gz
      var conn = new SshClient();
      var remDir = (projCfg.remotePath) ? projCfg.remotePath : projCfg.remotePath;
      var cmdStr = 'tar -xvf '+projCfg.remoteTarget +' -C '+remDir;

      conn.on('ready', function() {
        console.log('\ncmd: ', cmdStr);
        var spnnr2 = new Spinner('Unpacking '+projCfg.remoteTarget+'.. %s');

        spnnr2.setSpinnerString(20);
        spnnr2.start();

        conn.exec(cmdStr, function(err, stream) {

          if (err) { console.log('!! Error !!! ',err); throw err; }
          stream.on('close', function(code, signal) {
            //console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
            spnnr2.stop();

            PomParser.parse({filePath: projCfg.projectRoot+'pom.xml'}, function(err, pomResponse) {
              if (err) {
                console.error('could not read snapshot version from pom.xml: ',err);
              }else{
                var snapshotVersion = pomResponse.pomObject.project.version;
                var cmdStr2 = 'ln -s '+ projCfg.remoteTarget.replace('.tar.gz','') +'/'+ snapshotVersion +'/resources '+ projCfg.remoteTarget.replace('.tar.gz','') +'/resources';

                conn.exec(cmdStr2, function(err, stream) {
                  if(err){
                    // reject
                  }else{
                    //resolve
                    console.log('\ncreated resources symlink. \n'+cmdStr2);
                    conn.end();
                    resolve(true);
                  }
                });
              }
            });

          }).on('data', function(data) {
            //console.log('STDOUT: ' + data);
          }).stderr.on('data', function(data) {
            //console.log('STDERR: ' + data);
          });

        });
      }).connect(connCfg);
    });

    return _retPromise;
  }
}
