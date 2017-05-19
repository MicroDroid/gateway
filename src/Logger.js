const snekfetch = require('snekfetch');
const pad = require('./util/pad.js');

class Logger {
  constructor(config) {
    this.config = config;
  }

  sendWebhook(embed = {}) {
    if(!this.config.webhookURL) return;
    snekfetch.post(this.config.webhookURL).send({
      embeds: [{
        title: embed.title || 'Master',
        description: embed.description,
        timestamp: embed.timestamp || new Date()
      }]
    }).end();
  }

  log(description, title = 'Master') {
    this.sendWebhook({
      title,
      description
    });

    console.log(`\u001B[32m${pad.right(title, 10)}\u001B[39m`, '::', description);
  }
}

module.exports = Logger;
