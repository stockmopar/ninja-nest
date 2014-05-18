
##Ninja Blocks Nest Driver

###Overview
Exports any Nest Thermostats as NinjaBlocks devices.

Currently each Nest Thermometer will appear as two temperature devices, Current and Target. Humidity device is also present now. The Target device can be actuated with a Celsius temperature.

###Installation

```sh

sudo stop ninjablock

cd /opt/ninja/drivers

rm -rf ninja-nest
git clone https://github.com/stockmopar/ninja-nest.git
cd ninja-nest
sudo npm install

sudo start ninjablock

```

###History

v0.0.1

- Added Humidity

v0.0.0

- Very early version.

We have a nest device, but as none of us have a thermostat ... we can't *actually* test it!
It *should* work though :trollface:
