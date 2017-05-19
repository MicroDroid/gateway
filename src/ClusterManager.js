const WebSocket = require('ws');
const Logger = require('./Logger');
const uuid = require('./util/uuid.js');
const OPCODES = require('./constants/OPCODES.js');

class ClusterManager {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(config);
    this.started = false;
    this.wss = new WebSocket.Server({
      host: this.config.host || '0.0.0.0',
      port: this.config.port || 7894
    });
    this.startTimeout = null;

    this.logger.log('Started!');

    this.wss.on('connection', this.onConnection.bind(this));
    this.connections = {};
    this.clusters = {};
  }

  onConnection(ws) {
    let id = uuid();
    this.connections[id] = {
      ws,
      id,
      authenticated: false,
      connected: true
    };
    ws.on('message', msg => {
      msg = JSON.parse(msg);
      this.onMessage(this.connections[id], msg);
    });
    ws.on('close', () => {
      this.onClose(this.connections[id]);
    });

    ws.send(JSON.stringify({ op: OPCODES.identify }));
  }

  getNewCluster() {
    for(let cluster of Object.values(this.clusters)) {
      if(!cluster.connection.connected) {
        return {
          id: cluster.id,
          range: cluster.range
        };
      }
    }
    return {
      id: Object.keys(this.clusters).length + 1,
      range: this.getNewRange()
    };
  }

  getNewRange() {
    const lastCluster = Object.values(this.clusters)[Object.values(this.clusters).length - 1];
    if(!lastCluster) return [0, this.config.shardsPerCluster - 1];
    return [lastCluster.range[1] + 1, lastCluster.range[1] + this.config.shardsPerCluster];
  }

  addNewCluster(connection, clusterInfo = this.getNewCluster()) {
    this.clusters[clusterInfo.id] = {
      range: clusterInfo.range,
      connection,
      id: clusterInfo.id
    };

    return this.clusters[clusterInfo.id];
  }

  startClusters() {
    this.started = true;
    this.logger.log(`${this.started ? 'Started' : 'Resharding'} all ${Object.values(this.clusters).length} clusters.`);
    for(let cluster of Object.values(this.clusters)) {
      if(!cluster.connection.connected) continue;
      cluster.connection.ws.send(JSON.stringify({
        op: OPCODES.ready,
        range: cluster.range,
        id: cluster.id
      }));
    }
  }

  onMessage(connection, msg) {
    switch (msg.op) {
      case OPCODES.identify: {
        if(msg.secret !== this.config.secret) {
          return connection.ws.close(4000, 'Bad Secret');
        }

        connection.authenticated = true;
        connection.cluster = this.addNewCluster(connection);
        clearTimeout(this.startTimeout);
        this.startTimeout = setTimeout(() => {
          this.startClusters();
        }, 10000);
      }
    }
  }

  onClose(connection) {
    connection.connected = false;
    this.logger.log(`Cluster ${connection.cluster.id} Offline`);
  }
}

module.exports = ClusterManager;
