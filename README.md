
##Ninja Blocks Nest Driver

###Overview
Exports any Nest Thermostats as NinjaBlocks devices.

Currently each Nest Thermometer will appear as two temperature devices, Current and Target. The Target device can be actuated with a celsius temperature.

###Installation

Install this Driver with:

ninja_install -g git@github.com:elliots/ninja-nest.git (Requires ninja toolbelt)

####Manual Installation

1. cd into your drivers directory (/opt/ninja/drivers on your Ninja Block)
2. git clone git://github.com/elliots/ninja-nest.git
3. cd ninja-nest && npm install

###History

v0.0.0

Very early version.

We have a nest device, but as none of us have a thermostat ... we can't *actually* test it!
It *should* work though :trollface:
