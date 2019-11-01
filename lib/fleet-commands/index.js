let util = require('../utilities');
let awsInterface = require('../aws-interface');

exports.createFleet = async function(appName, region) {
    //use fs to create .fleet file
    if (util.isFleetConfigCreated()) {
        return util.showLog(`fleet.json configuration file already exists.`);
    } else {
        let fleetConfig = {};
        fleetConfig.appName = appName || null;
        fleetConfig.region = region;
        util.updateFleetConfigFileData(fleetConfig);
        util.createRoutesFolder();
        util.createWebsitesFolder();

        //TODO: Create fleet-specific components (APIG, Role/Policy) per region
        for(region in fleetConfig.region)
            await awsInterface.createAPIG(fleetConfig, fleetConfig.region[region]);

        await awsInterface.createLambdaRole(fleetConfig);
        await awsInterface.createLambdaRoleInlinePolicy(fleetConfig);

        util.showLog(`fleet.json configuration file created.`);
        util.showLog('Your fleet project is ready!');
        util.showLog('Try running `fleet-cli new-route` to create an endpoint.');
    }
};

exports.deleteFleet = async function() {
    //Remove aws resources
    let fleetConfigData = util.getFleetConfigFileData();
    await awsInterface.removeUnusedResources(fleetConfigData);

    //Remove routes folder
    util.deleteRoutesFolder();

    //Remove fleet.json
    util.deleteFleetConfigFile();
};

exports.deployRoute = async function(routeName) {
    let fleetConfigData = util.getFleetConfigFileData();
    let route = fleetConfigData.routes[routeName];
    util.showLog(`Using route found at ${route.path}.`);
    util.showLog(`Deploying ${routeName}...`);

    for(region in fleetConfigData.region) {
        await awsInterface.createOrUpdateLambda(fleetConfigData, routeName, fleetConfigData.region[region]);
        await awsInterface.updateAPIG(fleetConfigData, route, routeName, fleetConfigData.region[region]);
    }
};

exports.undeployRoute = async function(routeName) {
    let fleetConfigData = util.getFleetConfigFileData();

    for(region in fleetConfigData.region) {
        if (!util.isRouteDeployed(fleetConfigData, routeName, fleetConfigData.region[region])) {
            util.showLog(`${routeName} is not deployed in ${fleetConfigData.region[region]}.`);
            return false;
        } else {
            await awsInterface.ensureLambdaUndeployed(fleetConfigData, routeName, fleetConfigData.region[region]);

            util.showLog(`Completed undeploying ${routeName} in ${fleetConfigData.region[region]}.`);
        }
    }
}

exports.runRoute = function(routeName) {
    let fleetConfigData = util.getFleetConfigFileData();
    let route = fleetConfigData.routes[routeName];
    util.showLog(`Running route found at ${route.path}.`);

    let fullRoutePath = `${process.cwd()}\\routes\\${routeName}\\index.js`; //resolve(__dirname, `../../routes/${routeName}/index.js`);
    let routeObj = require(fullRoutePath);
    routeObj.handler(null, null, (cbargs, body) => console.log(body.body));
}

exports.newRoute = function(routeName, routeDefinition, routeType) {
    if (!util.isFleetConfigCreated()) {
        return util.showLog('No fleet config found, try running `fleet init`.');
    } else {
        //check if exists, add to config, setup folder
        let fleetConfigData = util.getFleetConfigFileData();
        fleetConfigData.routes = fleetConfigData.routes || {};

        //ensure this endpoint doesn't already exist, warn if so
        if (fleetConfigData.routes[routeName]) {
            util.showLog(`${routeName} already exists, updating your route.`);
        }

        fleetConfigData.routes[routeName] = fleetConfigData.routes[routeName] || {};
        fleetConfigData.routes[routeName].type = routeType;
        fleetConfigData.routes[routeName].apiPath = routeDefinition;
        fleetConfigData.routes[routeName].path = `${util.routesFolderPath}/${routeName}`;

        //create route folder `./routes/routeName`
        util.createRouteFolder(routeName);

        //save config
        util.updateFleetConfigFileData(fleetConfigData);
        util.showLog(`fleet configuration updated with ${routeName}.`);
        util.showLog(`See the code at ${util.routesFolderPath}/${routeName} and deploy with 'fleet-cli deploy-route ${routeName}'`);
    }
};

exports.newWebsite = function(websiteName) {
    if (!util.isFleetConfigCreated()) {
        return util.showLog('No fleet config found, try running `fleet init`.');
    } else {
        //check if exists, add to config, setup folder
        let fleetConfigData = util.getFleetConfigFileData();
        fleetConfigData.websites = fleetConfigData.websites || {};

        //ensure this website doesn't already exist, warn if so?
        if (fleetConfigData.websites[websiteName]) {
            util.showLog(`${websiteName} already exists, updating your website.`);
        }

        fleetConfigData.websites[websiteName] = fleetConfigData.websites[websiteName] || {};

        //parse directory structure from websiteName
        fleetConfigData.websites[websiteName].path = `${util.websitesFolderPath}/${websiteName}`;

        //create folder `./websites/websiteName`
        util.createWebsiteFolder(websiteName);

        //save config
        util.updateFleetConfigFileData(fleetConfigData);
        util.showLog(`fleet configuration updated with ${websiteName}.`);
        util.showLog(`See the code at ${util.websitesFolderPath}/${websiteName} and deploy with 'fleet-cli deploy-website ${websiteName}'`);
    }
}

exports.deployWebsite = async function(websiteName) {
    let fleetConfigData = util.getFleetConfigFileData();
    let website = fleetConfigData.websites[websiteName];
    util.showLog(`Using website found at ${fleetConfigData.websites[websiteName].path}.`);
    util.showLog(`Deploying ${websiteName}...`);

    await awsInterface.createOrUpdateWebsiteBucket(fleetConfigData, websiteName);

    util.showLog(`Website fully deployed!`);
    util.showLog(`View website at http:/${fleetConfigData.websites[websiteName].url}.s3-website-${fleetConfigData.region}.amazonaws.com`);
}

let inspectModule = require('../inspect');
exports.inspectRoute = inspectModule.inspectRoute;
exports.inspectRoutes = inspectModule.inspectRoutes;