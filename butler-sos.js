// Add dependencies
var request = require('request');

// Dependencies for REST server
var express = require('express');
var bodyParser = require('body-parser');
var _ = require('lodash');
var app = express();

app.use(bodyParser.json());



// Load code from sub modules
var globals = require('./globals');


// Set specific log level (if/when needed)
// Possible values are { error: 0, warn: 1, info: 2, verbose: 3, debug: 4, silly: 5 }
// globals.logger.transports.console.level = 'info';
globals.logger.transports.console.level = 'verbose';
// globals.logger.transports.console.level = 'debug';

globals.logger.info('Starting Butler SOS');




function postToInfluxdb(host, serverName, body) {

    // Calculate server uptime

    var dateTime = Date.now();
    var timestamp = Math.floor(dateTime);

    var str = body.started;
    var year = str.substring(0, 4);
    var month = str.substring(4, 6);
    var day = str.substring(6, 8);
    var hour = str.substring(9, 11);
    var minute = str.substring(11, 13);
    var second = str.substring(13, 15);
    var dateTimeStarted = new Date(year, month - 1, day, hour, minute, second);
    var timestampStarted = Math.floor(dateTimeStarted);

    var diff = timestamp - timestampStarted;


    // Create a new JavaScript Date object based on the timestamp
    // multiplied by 1000 so that the argument is in milliseconds, not seconds.
    var date = new Date(diff);

    var days = Math.trunc((diff) / (1000 * 60 * 60 * 24))

    // Hours part from the timestamp
    var hours = date.getHours();

    // Minutes part from the timestamp
    var minutes = "0" + date.getMinutes();

    // Seconds part from the timestamp
    var seconds = "0" + date.getSeconds();

    // Will display time in 10:30:23 format
    var formattedTime = days + ' days, ' + hours + 'h ' + minutes.substr(-2) + 'm ' + seconds.substr(-2) + 's';


    // Write the whole reading to Influxdb
    globals.influx.writePoints([{
                measurement: 'sense_server',
                tags: {
                    host: serverName
                },
                fields: {
                    version: body.version,
                    started: body.started,
                    uptime: formattedTime
                }
            },
            {
                measurement: 'mem',
                tags: {
                    host: serverName
                },
                fields: {
                    comitted: body.mem.comitted,
                    allocated: body.mem.allocated,
                    free: body.mem.free
                }
            },
            {
                measurement: 'apps',
                tags: {
                    host: serverName
                },
                fields: {
                    active_docs_count: body.apps.active_docs.length,
                    loaded_docs_count: body.apps.loaded_docs.length,
                    calls: body.apps.calls,
                    selections: body.apps.selections
                }
            },
            {
                measurement: 'cpu',
                tags: {
                    host: serverName
                },
                fields: {
                    total: body.cpu.total
                }
            },
            {
                measurement: 'session',
                tags: {
                    host: serverName
                },
                fields: {
                    active: body.session.active,
                    total: body.session.total
                }
            },
            {
                measurement: 'users',
                tags: {
                    host: serverName
                },
                fields: {
                    active: body.users.active,
                    total: body.users.total
                }
            },
            {
                measurement: 'cache',
                tags: {
                    host: serverName
                },
                fields: {
                    hits: body.cache.hits,
                    lookups: body.cache.lookups,
                    added: body.cache.added,
                    replaced: body.cache.replaced,
                    bytes_added: body.cache.bytes_added
                }
            }

        ])
        .then(err => {
            globals.logger.verbose('Sent data to Influxdb');
        })

        .catch(err => {
            console.error(`Error saving data to InfluxDB! ${err.stack}`)
        })

}


function postToMQTT(host, serverName, body) {

    // Get base MQT topic
    var baseTopic = globals.config.get('Butler-SOS.mqttConfig.baseTopic');

    // Send to MQTT
    globals.mqttClient.publish(baseTopic + serverName + '/version', body.version);
    globals.mqttClient.publish(baseTopic + serverName + '/started', body.started);
    globals.mqttClient.publish(baseTopic + serverName + '/mem/comitted', body.mem.comitted.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/mem/allocated', body.mem.allocated.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/mem/free', body.mem.free.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/cpu/total', body.cpu.total.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/session/active', body.session.active.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/session/total', body.session.total.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/apps/active_docs', body.apps.active_docs.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/apps/loaded_docs', body.apps.loaded_docs.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/apps/calls', body.apps.calls.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/apps/selections', body.apps.selections.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/users/active', body.users.active.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/users/total', body.users.total.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/cache/hits', body.cache.hits.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/cache/lookups', body.cache.lookups.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/cache/added', body.cache.added.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/cache/replaced', body.cache.replaced.toString());
    globals.mqttClient.publish(baseTopic + serverName + '/cache/bytes_added', body.cache.bytes_added.toString());

    if (body.cache.lookups > 0) {
        globals.mqttClient.publish(baseTopic + serverName + '/cache/hit_ratio', Math.floor(body.cache.hits / body.cache.lookups * 100).toString());
        // console.log(Math.floor(body.cache.hits / body.cache.lookups * 100).toString());
    }
}




function getStatsFromSense(host, serverName) {
    request({
        followAllRedirects: true,
        url: 'https://' + host + '/healthcheck/engine/healthcheck/',
        headers: {
            'Cache-Control': 'no-cache'
        },
        json: true
    }, function (error, response, body) {

        // Check for error
        if (error) {
            return globals.logger.error('Error:', error);
        }

        if (!error && response.statusCode === 200) {
            globals.logger.verbose('Received ok response from ' + serverName);
            globals.logger.debug(body);

            // globals.logger.info(body.apps.loaded_docs.length);

            // Post to MQTT
            postToMQTT(host, serverName, body);

            // Post to Influxdb
            postToInfluxdb(host, serverName, body);
        }
    })
}





var restServer = restify.createServer({
    name: 'Butler SOS Loaded apps REST API',
    version: '1.0.0',
    certificate: fs.readFileSync(config.get('Butler-SOS.restServer.sslCertPath')),
    key: fs.readFileSync(config.get('Butler-SOS.restServer.sslCertKeyPath'))
});


// Set up endpoints for REST server
restServer.get('/loadedAppNames', respondAppName);
restServer.get('/loadedAppNames/search', respondAppName_Search);
restServer.get('/loadedAppNames/query', respondAppName_Query);
restServer.get('/loadedAppNames/annotations', respondAppName_Annotation);


function setCORSHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST");
  res.setHeader("Access-Control-Allow-Headers", "accept, content-type");  
}






// Handler for REST endpoint /loadedAppNames
// URL parameters
//   -- None --
app.all('/loadedAppNames', function(req, res) {
  setCORSHeaders(res);
  res.send('Butler SOS reporting for duty.');
  res.end();
});




// Handler for REST endpoint /loadedAppNames/search
// URL parameters
//   -- None --
app.all('/loadedAppNames/search', function(req, res){
  setCORSHeaders(res);
  var result = [];
  _.each(timeserie, function(ts) {
    result.push(ts.target);
  });

  res.json(result);
  res.end();
});





// Handler for REST endpoint /loadedAppNames/query
// URL parameters
//   -- None --
app.all('/loadedAppNames/query', function(req, res){
  setCORSHeaders(res);
  console.log(req.url);
  console.log(req.body);

  var tsResult = [];
  _.each(req.body.targets, function(target) {
    if (target.type === 'table') {
      tsResult.push(table);
    } else {
      var k = _.filter(timeserie, function(t) {
        return t.target === target.target;
      });

      _.each(k, function(kk) {
        tsResult.push(kk)
      });
    }
  });

  res.json(tsResult);
  res.end();
});




// Handler for REST endpoint /loadedAppNames/annotations
// URL parameters
//   -- None --

app.all('/loadedAppNames/annotations', function(req, res) {
  setCORSHeaders(res);
  console.log(req.url);
  console.log(req.body);

  res.json(annotations);
  res.end();
})


app.listen(3333);




setInterval(function () {
    globals.logger.verbose('Event started: Statistics collection');

    var serverList = globals.config.get('Butler-SOS.serversToMonitor.servers');
    serverList.forEach(function (server) {
        globals.logger.verbose('Getting stats for server: ' + server.serverName);


        getStatsFromSense(server.host, server.serverName);
    });

}, globals.config.get('Butler-SOS.pollingInterval'));




