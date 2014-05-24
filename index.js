var util = require('util');
var stream = require('stream');

var nest = require('unofficial-nest-api');

util.inherits(Driver,stream);

function Driver(opts, app) {
  var self = this;

  this.devices = {};

  this.log = app.log;

  this.opts = opts;

  this.app = app;
  
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
        //this.log.info('Nest - Logged in ' + JSON.stringify(data));
		this.log.info('(Nest) Logged in');
        if (cb) {
            cb(err, data);
        }
        if (err) {
            this.log.info('(Nest) Failed to log in - ', err.message);
            return;
        }

        // Start continuous polling..
		//setTimeout(this.fetchStatus.bind(this), 1);
        setInterval(this.fetchStatus.bind(this), this.opts.pollInterval);

        // and do one now too.
        this.fetchStatus();

    }.bind(this));
};

Driver.prototype.fetchStatus = function() {
	this.log.info("(Nest) Fetching Status");
	
    nest.fetchStatus(function (data) {
		
        for (var deviceId in data.device) {
			var deviceData = data.shared[deviceId];
			
            if (data.device.hasOwnProperty(deviceId)) {
				var topic = 'data.' + deviceId;
				if (!this.listeners(topic).length) {
					this.log.info('Nest - Creating Ninja devices for device: ' + deviceId);

					this.createDevices(this.app, deviceId, data, topic);
				}

				this.save();

				this.log.info("(Nest) Fetching Status - Emitting Topic");
				this.emit(topic, data);
			}
        }
		
    }.bind(this));
};

Driver.prototype.createDevices = function(app, id, data, topic) {
	app.log.info("(Nest) Creating Devices");

    var self = this;

	var deviceData = data.shared[id];
	var extraDeviceData = data.device[id];
	
    function CurrentTemp() {
        this.writable = false;
        this.readable = true;
        this.V = 0;
        this.D = 9;
        this.G = 'nestcurrent' + id;
        this.name = 'Nest - ' + (deviceData.name||id) + ' Current Temperature';

        self.on(topic, function(data) {
			var deviceData = data.shared[id];
			
            self.log.debug('Nest - Device ' + id + ' - Current temperature:' + deviceData.current_temperature);
            if (typeof deviceData.current_temperature == 'undefined') {
                self.log.error('Nest - Device ' + id + '- ERROR: No Current Temperature!');
            } else {
				self.log.info("(Nest) CurrentTemp - " + deviceData.current_temperature);
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

        self.on(topic, function(data) {
			var deviceData = data.shared[id];
            self.log.debug('Nest - Device ' + id + ' - Target temperature:' + deviceData.target_temperature);
             if (typeof deviceData.target_temperature == 'undefined') {
                self.log.error('Nest - Device ' + id + '- ERROR: No Target Temperature!');
            } else {
				self.log.info("(Nest) TargetTemp - " + deviceData.target_temperature);
                this.emit('data', deviceData.target_temperature);
            }
        }.bind(this));

        this.write = function(wdata) {

            if (typeof wdata == 'string') {
                try {
                    wdata = parseFloat(wdata);
                } catch(e) {}
            }

            if (typeof wdata != 'number' || isNaN(wdata) ) {
                self.log.error('Nest - Device ' + id + ' - Tried to set target temperature with a non-number : ' + wdata);
                return;
            }

            self.log.info('Nest - Device ' + id + ' - Setting target temperature to :' + wdata);
            nest.setTemperature(id, wdata, function(response) {
                console.log('response', response);
                self.fetchStatus();
            });
        };
    }

    util.inherits(TargetTemp,stream);

    var target = new TargetTemp();
    this.emit('register', target);
	
    function CurrentHumidity() {
        this.writable = false;
        this.readable = true;
        this.V = 0;
        this.D = 8;
        this.G = 'nestcurrent' + id;
        this.name = 'Nest - ' + (deviceData.name||id) + ' Current Humidity';

        self.on(topic, function(data) {
			var extraDeviceData = data.device[id];
			
            self.log.debug('Nest - Device ' + id + ' - Current humidity:' + extraDeviceData.current_humidity);
            if (typeof extraDeviceData.current_humidity == 'undefined') {
                self.log.error('Nest - Device ' + id + '- ERROR: No Current Humidity!');
            } else {
				self.log.info("(Nest) CurrentHumidity - " + extraDeviceData.current_humidity);
                this.emit('data', extraDeviceData.current_humidity);
            }
        }.bind(this));
    }

    util.inherits(CurrentHumidity,stream);

    var humidity = new CurrentHumidity();
    this.emit('register', humidity);
	
	function HeaterState() {
        this.writable = false;
        this.readable = true;
        this.V = 0;
        this.D = 238;
        this.G = 'nestheaterstate' + id;
        this.name = 'Nest - ' + (deviceData.name||id) + ' Heater State';

        self.on(topic, function(data) {
			var deviceData = data.shared[id];
			
            self.log.debug('Nest - Device ' + id + ' - Heater State:' + deviceData.hvac_heater_state);
            if (typeof deviceData.hvac_heater_state == 'undefined') {
                self.log.error('Nest - Device ' + id + '- ERROR: No Current Heater State!');
            } else {
				self.log.info("(Nest) Heater State - " + deviceData.hvac_heater_state);
				this.emit('data', deviceData.hvac_heater_state);
				//if(deviceData.hvac_heater_state){
				//	this.emit('data', '1');
				//}else{
				//	this.emit('data', '0');
				//}
			}
        }.bind(this));
    }

    util.inherits(HeaterState,stream);

    var heater = new HeaterState();
	this.emit('register', heater);
	
	function ACState() {
        this.writable = false;
        this.readable = true;
        this.V = 0;
        this.D = 238;
        this.G = 'nestacstate' + id;
        this.name = 'Nest - ' + (deviceData.name||id) + ' A/C State';

        self.on(topic, function(data) {
			var deviceData = data.shared[id];
			
            self.log.debug('Nest - Device ' + id + ' - A/C State:' + deviceData.hvac_ac_state);
            if (typeof deviceData.hvac_ac_state == 'undefined') {
                self.log.error('Nest - Device ' + id + '- ERROR: No Current A/C State!');
            } else {
				self.log.info("(Nest) A/C State - " + deviceData.hvac_ac_state);
				this.emit('data', deviceData.hvac_ac_state);
				//if(deviceData.hvac_ac_state){
				//	this.emit('data', '1');
				//}else{
				//	this.emit('data', '0');
				//}
			}
        }.bind(this));
    }

    util.inherits(ACState,stream);

    var ac = new ACState();
	this.emit('register', ac);
	
	function FanState() {
        this.writable = true;
        this.readable = true;
        this.V = 0;
        this.D = 238;
        this.G = 'nestfanstate' + id;
        this.name = 'Nest - ' + (deviceData.name||id) + ' Fan State';

        self.on(topic, function(data) {
			var deviceData = data.shared[id];
			
            self.log.debug('Nest - Device ' + id + ' - Fan State:' + deviceData.hvac_fan_state);
            if (typeof deviceData.hvac_fan_state == 'undefined') {
                self.log.error('Nest - Device ' + id + '- ERROR: No Current Fan State!');
            } else {
				self.log.info("(Nest) Fan State - " + deviceData.hvac_fan_state);
				this.emit('data', deviceData.hvac_fan_state);
				//if(deviceData.hvac_ac_state){
				//	this.emit('data', '1');
				//}else{
				//	this.emit('data', '0');
				//}
			}
        }.bind(this));
        this.write = function(wdata) {
			
			if(wdata == true){
				nest.setFanModeOn();
			}else{
				nest.setFanModeAuto();
			}
			
            self.log.info('Nest - Device ' + id + ' - Setting fan state to :' + wdata);
        };
    }

    util.inherits(FanState,stream);

    var fan = new FanState();
	this.emit('register', fan);
};

module.exports = Driver;
