var util = require('util');
var stream = require('stream');

var nest = require('unofficial-nest-api');

util.inherits(Driver,stream);

function Driver(opts, app) {
  var self = this;

  this.devices = {};

  this.log = app.log;

  this.opts = opts;

  opts.lastSeen = opts.lastSeen || {};
  opts.pollInterval = opts.pollInterval || 120000; // 2min default poll

  app.once('client::up',function(){
    self.save();
    if (opts.username && opts.password) {
      self.login(opts.username, opts.password);
    }
  });

}

Driver.prototype.config = function(rpc,cb) {

  var self = this;

  if (!rpc) {
    return cb(null, {
        "contents":[
          { "type": "input_field_text", "field_name": "username", "value": self.opts.username || '', "label": "Nest Username", "placeholder": "", "required": true},
          { "type": "input_field_password", "field_name": "password", "value": "", "label": "Nest Password", "placeholder": "", "required": true},
          { "type": "submit", "name": "Add", "rpc_method": "setCredentials" }
        ]
      });
  }

  switch (rpc.method) {
    case 'setCredentials':
        self.login(rpc.params.username, rpc.params.password, function(err, data) {
            if (err) {
                cb(null, {
                    "contents": [
                      { "type":"paragraph", "text":"There was an error logging into your nest account : " + err},
                      { "type":"close", "text":"Close"}
                    ]
                });
                return;
            }

            self.opts.username = rpc.params.username;
            self.opts.password = rpc.params.password;

            self.save();

             cb(null, {
                "contents": [
                  { "type":"paragraph", "text":"Successfully logged in. (User id: " + data.userid + ')'},
                  { "type":"close", "text":"Close"}
                ]
            });

        });

        break;
    default:
      log('Unknown rpc method', rpc.method, rpc);
  }
};

Driver.prototype.login = function(username, password, cb) {

    nest.login(username, password, function (err, data) {
        this.log.info('Nest - Logged in ' + JSON.stringify(data));
        if (cb) {
            cb(err, data);
        }
        if (err) {
            this.log.info('Nest - Failed to log in - ', err.message);
            return;
        }

        // Start continuous polling..
        setInterval(this.fetchStatus.bind(this), this.opts.pollInterval);

        // and do one now too.
        this.fetchStatus();

    }.bind(this));
};

Driver.prototype.fetchStatus = function() {

    nest.fetchStatus(function (data) {

        for (var deviceId in data.shared) {
            var deviceData = data.shared[deviceId];

            if (!this.opts.lastSeen[deviceId] || this.opts.lastSeen[deviceId] < deviceData['$timestamp']) {

                var topic = 'data.' + deviceId;
                if (!this.listeners(topic).length) {
                    this.log.info('Nest - Creating Ninja devices for device: ' + deviceId);

                    this.createDevices(deviceId, deviceData, topic);
                }

                this.opts.lastSeen[deviceId] = deviceData['$timestamp'];
                this.save();

                this.emit(topic, deviceData);
            }
        }

    }.bind(this));
};

Driver.prototype.createDevices = function(id, deviceData, topic) {

    var self = this;

    function CurrentTemp() {
        this.writable = false;
        this.readable = true;
        this.V = 0;
        this.D = 9;
        this.G = 'nestcurrent' + id;
        this.name = 'Nest - ' + (deviceData.name||id) + ' Current Temperature';

        self.on(topic, function(deviceData) {
            self.log.debug('Nest - Device ' + id + ' - Current temperature:' + deviceData.current_temperature);
            if (typeof deviceData.current_temperature == 'undefined') {
                self.log.error('Nest - Device ' + id + '- ERROR: No Current Temperature!');
            } else {
                this.emit('data', deviceData.current_temperature);
            }
        }.bind(this));
    }

    util.inherits(CurrentTemp,stream);

    var current = new CurrentTemp();
    this.emit('register', current);

    function TargetTemp() {
        this.writable = true;
        this.readable = true;
        this.V = 0;
        this.D = 9;
        this.G = 'nesttarget' + id;
        this.name = 'Nest - ' + (deviceData.name||id) + ' Target Temperature';

        self.on(topic, function(deviceData) {
            self.log.debug('Nest - Device ' + id + ' - Target temperature:' + deviceData.target_temperature);
             if (typeof deviceData.target_temperature == 'undefined') {
                self.log.error('Nest - Device ' + id + '- ERROR: No Target Temperature!');
            } else {
                this.emit('data', deviceData.target_temperature);
            }
        }.bind(this));

        this.write = function(data) {

            if (typeof data == 'string') {
                try {
                    data = parseFloat(data);
                } catch(e) {}
            }

            if (typeof data != 'number' || isNaN(data) ) {
                self.log.error('Nest - Device ' + id + ' - Tried to set target temperature with a non-number : ' + data);
                return;
            }

            self.log.info('Nest - Device ' + id + ' - Setting target temperature to :' + data);
            nest.setTemperature(id, data, function(response) {
                console.log('response', response);
                self.fetchStatus();
            });
        };
    }

    util.inherits(TargetTemp,stream);

    var target = new TargetTemp();
    this.emit('register', target);

};

module.exports = Driver;
