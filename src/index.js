const ClusterManager = require('./ClusterManager.js');
const fs = require('fs');
const Raven = require('raven');

let config;

if(process.env.secret_name) {
  config = JSON.parse(fs.readfileSync(`/run/secrets/${process.env.secret_name}`));
} else {
  config = require('../config.json');
}

if(config.sentryDSN) {
  Raven.config(config.sentryDSN).install();
  Raven.setContext({ tags: { enviroment: config.identifier } });

  process.on('unhandledRejection', reason => {
    if(!reason) return;
    Raven.captureException(reason);
  });
}

const clusterManager = new ClusterManager(config);

// clusterManager.start();
