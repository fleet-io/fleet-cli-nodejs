let fs = require('fs');
let resolve = require('path').resolve;
let AdmZip = require('adm-zip');
let path = require('path');
let rimraf = require('rimraf');

module.exports = {
    fleetConfigFilePath: 'fleet.json',
    routesFolderPath: 'routes',
    websitesFolderPath: 'websites',
    logsFolderPath: 'logs',

    getFleetConfigFileData: function(fleetPath) {
        return JSON.parse(fs.readFileSync(`${fleetPath}/${this.fleetConfigFilePath}`, 'utf8'));
    },

    updateFleetConfigFileData: function(data, fleetPath) {
        data.lastUpdated = Date.now();
        fs.writeFileSync(`${fleetPath}/${this.fleetConfigFilePath}`, JSON.stringify(data, null, 4));
    },

    updateFleetStatus: function(state, fleetPath) {
        let fleetConfigData = {};
        if(this.isFleetConfigCreated(fleetPath)) {
            fleetConfigData = this.getFleetConfigFileData(fleetPath);
        }
    
        fleetConfigData.status = {state: state};
        if(arguments[2])
            fleetConfigData.status.eventData = arguments[2];

        this.updateFleetConfigFileData(fleetConfigData, fleetPath);
    },

    deleteFleetConfigFile: function(fleetPath) {
        if(this.isFleetConfigCreated(fleetPath))
            fs.unlinkSync(`${fleetPath}/${this.fleetConfigFilePath}`);
    },

    isFleetConfigCreated: function(fleetPath) {
        return fs.existsSync(`${fleetPath}/${this.fleetConfigFilePath}`);
    },

    websitesFolderExists: function(fleetPath) {
        return fs.existsSync(`${fleetPath}/${this.websitesFolderPath}`);
    },

    websiteFolderExists: function(websiteName, fleetPath) {
        if (this.websitesFolderExists(fleetPath)) {
            return fs.existsSync(`${fleetPath}/${this.websitesFolderPath}/${websiteName}`);
        }
    },

    createWebsitesFolder: function(fleetPath) {
        if (!this.websitesFolderExists(fleetPath)) {
            fs.mkdirSync(`${fleetPath}/${this.websitesFolderPath}`);
        }
    },

    createWebsiteFolder: function(websiteName, fleetPath) {
        if (!this.websiteFolderExists(websiteName, fleetPath)) {
            fs.mkdirSync(`${fleetPath}/${this.websitesFolderPath}/${websiteName}`);
            fs.copyFileSync(resolve(__dirname, "../websiteStubs/index.html"),
                `${fleetPath}/${this.websitesFolderPath}/${websiteName}/index.html`);
            fs.copyFileSync(resolve(__dirname, "../websiteStubs/style.css"),
                `${fleetPath}/${this.websitesFolderPath}/${websiteName}/style.css`);
        }
    },

    routesFolderExists: function(fleetPath) {
        return fs.existsSync(`${fleetPath}/${this.routesFolderPath}`);
    },

    websitesFolderExists: function(fleetPath) {
        return fs.existsSync(`${fleetPath}/${this.websitesFolderPath}`);
    },

    websiteFolderExists: function(websiteName, fleetPath) {
        if (this.websitesFolderExists(fleetPath)) {
            return fs.existsSync(`${fleetPath}/${this.websitesFolderPath}/${websiteName}`);
        }
    },

    createWebsitesFolder: function(fleetPath) {
        if (!this.websitesFolderExists(fleetPath)) {
            fs.mkdirSync(`${fleetPath}/${this.websitesFolderPath}`);
        }
    },

    createLogsFolder: function(fleetPath) {
        if (!this.logsFolderExists(fleetPath)) {
            fs.mkdirSync(`${fleetPath}/${this.logsFolderPath}`);
        }
    },

    logsFolderExists: function(fleetPath) {
        return fs.existsSync(`${fleetPath}/${this.logsFolderPath}`);
    },

    createWebsiteFolder: function(websiteName, fleetPath) {
        if (!this.websiteFolderExists(websiteName, fleetPath)) {
            fs.mkdirSync(`${fleetPath}/${this.websitesFolderPath}/${websiteName}`);
            fs.copyFileSync(resolve(__dirname, "../websiteStubs/index.html"),
                `${fleetPath}/${this.websitesFolderPath}/${websiteName}/index.html`);
            fs.copyFileSync(resolve(__dirname, "../websiteStubs/style.css"),
                `${fleetPath}/${this.websitesFolderPath}/${websiteName}/style.css`);
        }
    },

    createRoutesFolder: function(fleetPath) {
        if (!this.routesFolderExists(fleetPath)) {
            fs.mkdirSync(`${fleetPath}/${this.routesFolderPath}`);
        }
    },

    deleteRoutesFolder: function(fleetPath) {
        if(this.routesFolderExists(fleetPath))
            rimraf.sync(`${fleetPath}/${this.routesFolderPath}`);
    },

    deleteWebsitesFolder: function(fleetPath) {
        if(this.websitesFolderExists(fleetPath))
            rimraf.sync(`${fleetPath}/${this.websitesFolderPath}`);
    },

    deleteRouteFolder: function(routeName, fleetPath) {
        if(this.routeFolderExists(routeName, fleetPath)) {
            rimraf.sync(`${fleetPath}/${this.routesFolderPath}/${routeName}`)
        }
    },

    deleteWebsiteFolder: function(websiteName, fleetPath) {
        if(this.websiteFolderExists(websiteName, fleetPath)) {
            rimraf.sync(`${fleetPath}/${this.websitesFolderPath}/${websiteName}`);
        }
    },

    routeFolderExists: function(routeName, fleetPath) {
        if (this.routesFolderExists(fleetPath)) {
            return fs.existsSync(`${fleetPath}/${this.routesFolderPath}/${routeName}`);
        }
    },

    createRouteFolder: function(routeName, fleetPath) {
        if (!this.routeFolderExists(routeName, fleetPath)) {
            fs.mkdirSync(`${fleetPath}/${this.routesFolderPath}/${routeName}`);
            let routeStubNodePath = resolve(__dirname, "../routeStubs/routeStubNode.js");
            let packagejsonPath = resolve(__dirname, "../routeStubs/package.json");

            //NOTE: fs.copyFileSync does not exist in older Node versions
            //Check if exists and throw error or fallback
            fs.copyFileSync(routeStubNodePath, `${fleetPath}/${this.routesFolderPath}/${routeName}/index.js`);
            fs.copyFileSync(packagejsonPath, `${fleetPath}/${this.routesFolderPath}/${routeName}/package.json`);
        }
    },

    getRoutePathParts: function(routeDefinition) {
        let routeParts = routeDefinition.split('/');
        let routePath = [];
        routeParts.forEach(rp => {
            if (rp.indexOf(':') === 0) {
                routePath.push({
                    type: 'param',
                    value: rp.replace(':', '')
                });
            } else {
                routePath.push({
                    type: 'resource',
                    value: rp
                });
            }
        });

        return routePath;
    },

    isRouteDefinitionValid: function(routeDefinition) {
        return true;
    },

    showLog: function(text, fleetPath, correlationData) {
        //simple 1-param logger that adds prefix information
        let dt = new Date();
        let lts = dt.toLocaleString();
        let formattedLog = `${lts}: ${text}`;
        console.log(formattedLog);

        //TODO: Consider doing this only if a condition set during create-fleet? (--log-events|default=true)
        if(!correlationData) correlationData = { time: 0 };
        if(!correlationData.id) correlationData.id = correlationData.time;
        this.writeLog(formattedLog, fleetPath, correlationData);
    },

    writeLog: function(text, fleetPath, correlationData) {
        let dt = new Date().toJSON().split('T')[0];
        let logPath = `${fleetPath}/${this.logsFolderPath}/logs_${dt}.json`;
        let logJson = {};
        if(fs.existsSync(logPath)) {
            logJson = JSON.parse(fs.readFileSync(logPath,'utf8'));
        } else {
            logJson.events = {};
        }

        if(!logJson.events[correlationData.id]) {
            logJson.events[correlationData.id] = { 
                logs: []
            };

            for(data in correlationData) {
                logJson.events[correlationData.id][data] = correlationData[data];
            }
        }
            
        logJson.events[correlationData.id].logs.push(text);
        fs.writeFileSync(logPath, JSON.stringify(logJson, null, 4));
    },

    getBufferZip: (folderPath) => {
        let zip = new AdmZip();
        zip.addLocalFolder(folderPath);
        return zip.toBuffer();
    },

    timeout: function(ms) {
        if(isNaN(ms)) ms = 0;
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    isRouteDeployed: function(fleetConfigData, routeName, region) {
        return fleetConfigData.routes[routeName].url && fleetConfigData.routes[routeName].url[region] ? true : false
    },

    isAnyRouteDeployed: function(fleetConfigData) {
        for (var route in fleetConfigData.routes) {
            if (this.isRouteDeployed(fleetConfigData, route))
                return true;
        }

        return false;
    }
};