let fs = require('fs');
let resolve = require('path').resolve;
let AdmZip = require('adm-zip');
let path = require('path');
let rimraf = require('rimraf');

module.exports = {
    fleetConfigFilePath: './fleet.json',
    routesFolderPath: './routes',
    websitesFolderPath: './websites',

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

    showLog: function(text) {
        //simple 1-param logger that adds prefix information
        let dt = new Date();
        let lts = dt.toLocaleString();
        console.log(`${lts}: ${text}`);
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