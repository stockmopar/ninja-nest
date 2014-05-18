
##Ninja Blocks Nest Driver

###Overview
Exports any Nest Thermostats as NinjaBlocks devices.

Currently each Nest Thermometer will create the following devices:
- Current Temperature
- Current Humidity
- Target Temperature
- Heater State
- A/C State

The Target device can be actuated with a Celsius temperature.

This device currently does not work in range mode.  I plan to read which mode it is in and output the following devices if it is in this mode
- Low Target Temperature
- Hight Target Temperature

The Target Temperature device would then be hidden.
 
###Installation

```sh

sudo stop ninjablock

cd /opt/ninja/drivers

sudo rm -rf ninja-nest
git clone https://github.com/stockmopar/ninja-nest.git
cd ninja-nest
sudo npm install

sudo start ninjablock

```

###History

v0.0.1

- Added Current Humidity
- Added Heater State
- Added A/C State

v0.0.0

- Very early version.

We have a nest device, but as none of us have a thermostat ... we can't *actually* test it!
It *should* work though :trollface:
