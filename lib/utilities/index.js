let fs = require('fs');
let resolve = require('path').resolve;
let AdmZip = require('adm-zip');
let path = require('path');
let rimraf = require('rimraf');

module.exports = {
    fleetConfigFilePath: './fleet.json',
    routesFolderPath: './routes',
    websitesFolderPath: './websites',
    logsFolderPath: './logs',

    getFleetConfigFileData: function() {
        return JSON.parse(fs.readFileSync(this.fleetConfigFilePath, 'utf8'));
    },

    updateFleetConfigFileData: function(data) {
        fs.writeFileSync(this.fleetConfigFilePath, JSON.stringify(data, null, 4));
    },

    deleteFleetConfigFile: function() {
        if(this.isFleetConfigCreated())
            fs.unlinkSync(this.fleetConfigFilePath);
    },

    isFleetConfigCreated: function() {
        return fs.existsSync(this.fleetConfigFilePath);
    },

    websitesFolderExists: function() {
        return fs.existsSync(`${this.websitesFolderPath}`);
    },

    websiteFolderExists: function(websiteName) {
        if (this.websitesFolderExists()) {
            return fs.existsSync(`${this.websitesFolderPath}/${websiteName}`);
        }
    },

    createWebsitesFolder: function() {
        if (!this.websitesFolderExists()) {
            fs.mkdirSync(this.websitesFolderPath);
        }
    },

    createWebsiteFolder: function(websiteName) {
        if (!this.websiteFolderExists(websiteName)) {
            fs.mkdirSync(`${this.websitesFolderPath}/${websiteName}`);
            fs.copyFileSync(resolve(__dirname, "../websiteStubs/index.html"),
                `${this.websitesFolderPath}/${websiteName}/index.html`);
            fs.copyFileSync(resolve(__dirname, "../websiteStubs/style.css"),
                `${this.websitesFolderPath}/${websiteName}/style.css`);
        }
    },

    routesFolderExists: function() {
        return fs.existsSync(`${this.routesFolderPath}`);
    },

    websitesFolderExists: function() {
        return fs.existsSync(`${this.websitesFolderPath}`);
    },

    websiteFolderExists: function(websiteName) {
        if (this.websitesFolderExists()) {
            return fs.existsSync(`${this.websitesFolderPath}/${websiteName}`);
        }
    },

    createWebsitesFolder: function() {
        if (!this.websitesFolderExists()) {
            fs.mkdirSync(this.websitesFolderPath);
        }
    },

    createLogsFolder: function() {
        if (!this.logsFolderExists()) {
            fs.mkdirSync(this.logsFolderPath);
        }
    },

    logsFolderExists: function() {
        return fs.existsSync(`${this.logsFolderPath}`);
    },

    createWebsiteFolder: function(websiteName) {
        if (!this.websiteFolderExists(websiteName)) {
            fs.mkdirSync(`${this.websitesFolderPath}/${websiteName}`);
            fs.copyFileSync(resolve(__dirname, "../websiteStubs/index.html"),
                `${this.websitesFolderPath}/${websiteName}/index.html`);
            fs.copyFileSync(resolve(__dirname, "../websiteStubs/style.css"),
                `${this.websitesFolderPath}/${websiteName}/style.css`);
        }
    },

    createRoutesFolder: function() {
        if (!this.routesFolderExists()) {
            fs.mkdirSync(this.routesFolderPath);
        }
    },

    deleteRoutesFolder: function() {
        if(this.routesFolderExists())
            rimraf(this.routesFolderPath, (e) => { if(e) console.log(e); });
    },

    deleteWebsitesFolder: function() {
        if(this.websitesFolderExists())
            rimraf(this.websitesFolderPath, (e) => { if(e) console.log(e); });
    },

    routeFolderExists: function(routeName) {
        if (this.routesFolderExists()) {
            return fs.existsSync(`${this.routesFolderPath}/${routeName}`);
        }
    },

    createRouteFolder: function(routeName) {
        if (!this.routeFolderExists(routeName)) {
            fs.mkdirSync(`${this.routesFolderPath}/${routeName}`);
            let routeStubNodePath = resolve(__dirname, "../routeStubs/routeStubNode.js");
            let packagejsonPath = resolve(__dirname, "../routeStubs/package.json");

            //NOTE: fs.copyFileSync does not exist in older Node versions
            //Check if exists and throw error or fallback
            fs.copyFileSync(routeStubNodePath, `${this.routesFolderPath}/${routeName}/index.js`);
            fs.copyFileSync(packagejsonPath, `${this.routesFolderPath}/${routeName}/package.json`);
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

    showLog: function(text, correlationData) {
        //simple 1-param logger that adds prefix information
        let dt = new Date();
        let lts = dt.toLocaleString();
        let formattedLog = `${lts}: ${text}`;
        console.log(formattedLog);

        //TODO: Consider doing this only if a condition set during create-fleet? (--log-events|default=true)
        if(!correlationData) correlationData = { time: 0 };
        this.writeLog(formattedLog, correlationData);
    },

    writeLog: function(text, correlationData) {
        let dt = new Date().toJSON().split('T')[0];
        let logPath = `${this.logsFolderPath}/logs_${dt}.json`;
        let logJson = {};
        if(fs.existsSync(logPath)) {
            logJson = JSON.parse(fs.readFileSync(logPath,'utf8'));
        } else {
            logJson.events = {};
        }

        if(!logJson.events[correlationData.time]) {
            logJson.events[correlationData.time] = { 
                logs: []
            };

            for(data in correlationData) {
                logJson.events[correlationData.time][data] = correlationData[data];
            }
        }
            
        logJson.events[correlationData.time].logs.push(text);
        fs.writeFileSync(logPath, JSON.stringify(logJson, null, 4));
    },

    getBufferZip: (folderPath) => {
        let zip = new AdmZip();
        zip.addLocalFolder(folderPath);
        return zip.toBuffer();
    },

    timeout: function(ms) {
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