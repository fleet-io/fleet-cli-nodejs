let util = require('../utilities');
let awsInterface = require('../aws-interface');

exports.createFleet = async function(appName, region, global, correlationData) {
    //use fs to create .fleet file
    if (util.isFleetConfigCreated()) {
        return util.showLog(`fleet.json configuration file already exists.`, correlationData);
    } else {
        let fleetConfig = {};
        fleetConfig.appName = appName || null;

        if(global) {
            util.showLog(`Retrieving list of available regions for global fleet creation...`, correlationData);
            region = await awsInterface.describeRegions(fleetConfig, correlationData).catch(e => util.showLog(e, correlationData));
        }
        
        fleetConfig.region = region;

        util.updateFleetConfigFileData(fleetConfig);
        util.createRoutesFolder();
        util.createWebsitesFolder();
        util.createLogsFolder();

        for(region in fleetConfig.region) {
            await awsInterface.createAPIG(fleetConfig, fleetConfig.region[region], correlationData).catch(e => util.showLog(e, correlationData));
        }

        await awsInterface.createLambdaRole(fleetConfig, correlationData).catch(e => util.showLog(e, correlationData));
        await awsInterface.createLambdaRoleInlinePolicy(fleetConfig, correlationData).catch(e => util.showLog(e, correlationData));

        util.showLog(`fleet.json configuration file created.`, correlationData);
        util.showLog('Your fleet project is ready!', correlationData);
        util.showLog('Try running `fleet-cli new-route` to create an endpoint.', correlationData);
    }
};

exports.deleteFleet = async function(correlationData) {
    //Remove aws resources
    let fleetConfigData = util.getFleetConfigFileData();
    await awsInterface.removeUnusedResources(fleetConfigData, correlationData).catch(e => util.showLog(e, correlationData));

    //Remove routes folder
    util.deleteRoutesFolder();

    //Remove websites folder
    util.deleteWebsitesFolder();

    //Remove fleet.json
    util.deleteFleetConfigFile();

    util.showLog(`Completed removing resources.`, correlationData);
};

exports.deployRoute = async function(routeName, correlationData) {
    let fleetConfigData = util.getFleetConfigFileData();
    let route = fleetConfigData.routes[routeName];
    util.showLog(`Using route found at ${route.path}.`, correlationData);
    util.showLog(`Deploying ${routeName}...`, correlationData);

    for(region in fleetConfigData.region) {
        await awsInterface.createOrUpdateLambda(fleetConfigData, routeName, fleetConfigData.region[region], correlationData)
                            .catch(e => util.showLog(e, correlationData));
        await awsInterface.updateAPIG(fleetConfigData, route, routeName, fleetConfigData.region[region], correlationData)
                            .catch(e => util.showLog(e, correlationData));
    }
};

exports.undeployRoute = async function(routeName, correlationData) {
    let fleetConfigData = util.getFleetConfigFileData();

    for(region in fleetConfigData.region) {
        if (!util.isRouteDeployed(fleetConfigData, routeName, fleetConfigData.region[region])) {
            util.showLog(`${routeName} is not deployed in ${fleetConfigData.region[region]}.`, correlationData);
            return false;
        } else {
            await awsInterface.ensureLambdaUndeployed(fleetConfigData, routeName, fleetConfigData.region[region], correlationData)
                                .catch(e => util.showLog(e, correlationData));

            util.showLog(`Completed undeploying ${routeName} in ${fleetConfigData.region[region]}.`, correlationData);
        }
    }
}

exports.runRoute = function(routeName, correlationData) {
    let fleetConfigData = util.getFleetConfigFileData();
    let route = fleetConfigData.routes[routeName];
    util.showLog(`Running route found at ${route.path}.`, correlationData);

    let fullRoutePath = `${process.cwd()}\\routes\\${routeName}\\index.js`; //resolve(__dirname, `../../routes/${routeName}/index.js`);
    let routeObj = require(fullRoutePath);
    routeObj.handler(null, null, (cbargs, body) => util.showLog(body.body, correlationData));
}

exports.newRoute = function(routeName, routeDefinition, routeType, correlationData) {
    if (!util.isFleetConfigCreated()) {
        return util.showLog('No fleet config found, try running `fleet init`.', correlationData);
    } else {
        //check if exists, add to config, setup folder
        let fleetConfigData = util.getFleetConfigFileData();
        fleetConfigData.routes = fleetConfigData.routes || {};

        //ensure this endpoint doesn't already exist, warn if so
        if (fleetConfigData.routes[routeName]) {
            util.showLog(`${routeName} already exists, updating your route.`, correlationData);
        }

        fleetConfigData.routes[routeName] = fleetConfigData.routes[routeName] || {};
        fleetConfigData.routes[routeName].type = routeType;
        fleetConfigData.routes[routeName].apiPath = routeDefinition;
        fleetConfigData.routes[routeName].path = `${util.routesFolderPath}/${routeName}`;

        //create route folder `./routes/routeName`
        util.createRouteFolder(routeName);

        //save config
        util.updateFleetConfigFileData(fleetConfigData);
        util.showLog(`fleet configuration updated with ${routeName}.`, correlationData);
        util.showLog(`See the code at ${util.routesFolderPath}/${routeName} and deploy with 'fleet-cli deploy-route ${routeName}'`, correlationData);
    }
};

exports.newWebsite = function(websiteName, correlationData) {
    if (!util.isFleetConfigCreated()) {
        return util.showLog('No fleet config found, try running `fleet init`.', correlationData);
    } else {
        //check if exists, add to config, setup folder
        let fleetConfigData = util.getFleetConfigFileData();
        fleetConfigData.websites = fleetConfigData.websites || {};

        //ensure this website doesn't already exist, warn if so?
        if (fleetConfigData.websites[websiteName]) {
            util.showLog(`${websiteName} already exists, updating your website.`, correlationData);
        }

        fleetConfigData.websites[websiteName] = fleetConfigData.websites[websiteName] || {};

        //parse directory structure from websiteName
        fleetConfigData.websites[websiteName].path = `${util.websitesFolderPath}/${websiteName}`;

        //create folder `./websites/websiteName`
        util.createWebsiteFolder(websiteName);

        //save config
        util.updateFleetConfigFileData(fleetConfigData);
        util.showLog(`fleet configuration updated with ${websiteName}.`, correlationData);
        util.showLog(`See the code at ${util.websitesFolderPath}/${websiteName} and deploy with 'fleet-cli deploy-website ${websiteName}'`, 
            correlationData);
    }
}

exports.deployWebsite = async function(websiteName, correlationData) {
    let fleetConfigData = util.getFleetConfigFileData();
    let website = fleetConfigData.websites[websiteName];
    util.showLog(`Using website found at ${fleetConfigData.websites[websiteName].path}.`, correlationData);
    util.showLog(`Deploying ${websiteName}...`, correlationData);

    await awsInterface.createOrUpdateWebsiteBucket(fleetConfigData, websiteName, correlationData)
                        .catch(e => util.showLog(e, correlationData));

    util.showLog(`Website fully deployed!`, correlationData);
    util.showLog(`View website at http:/${fleetConfigData.websites[websiteName].url}.s3-website-${fleetConfigData.region}.amazonaws.com`, 
            correlationData);
}

let inspectModule = require('../inspect');
exports.inspectRoute = inspectModule.inspectRoute;
exports.inspectRoutes = inspectModule.inspectRoutes;