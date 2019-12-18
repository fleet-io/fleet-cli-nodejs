let util = require('../utilities');
let awsInterface = require('../aws-interface');

let createFleet = async function(appName, region, global, fleetPath, correlationData) {
    let fleetConfigData = util.getFleetConfigFileData(fleetPath);
    fleetConfigData.appName = appName || null;
    fleetConfigData.id = Date.now();
    
    util.createRoutesFolder(fleetPath);
    util.createWebsitesFolder(fleetPath);
    util.createLogsFolder(fleetPath);

    if(global) {
        util.showLog(`Retrieving list of available regions for global fleet creation...`, fleetPath, correlationData);
        region = await awsInterface.describeRegions(fleetConfigData, fleetPath, correlationData).catch(e => {throw e});
    }
    
    fleetConfigData.region = region;

    for(region in fleetConfigData.region) {
        await awsInterface.createAPIG(fleetConfigData, fleetConfigData.region[region], fleetPath, correlationData).catch(e => {throw e});
    }

    await awsInterface.createLambdaRole(fleetConfigData, fleetPath, correlationData).catch(e => {throw e});
    await awsInterface.createLambdaRoleInlinePolicy(fleetConfigData, fleetPath, correlationData).catch(e => {throw e});

    util.showLog(`fleet.json configuration file created.`, fleetPath, correlationData);
    util.showLog('Your fleet project is ready!', fleetPath, correlationData);
    util.showLog('Try running `fleet-cli new-route` to create an endpoint.', fleetPath, correlationData);

    fleetConfigData.created = Date.now();
    util.updateFleetConfigFileData(fleetConfigData, fleetPath);
};

let deleteFleet = async function(fleetPath, correlationData) {
    //Remove aws resources
    let fleetConfigData = util.getFleetConfigFileData(fleetPath);

    await awsInterface.removeUnusedResources(fleetConfigData, fleetPath, correlationData).catch(e => {throw e});

    //Remove routes folder
    util.deleteRoutesFolder(fleetPath);

    //Remove websites folder
    util.deleteWebsitesFolder(fleetPath);

    //Remove fleet.json
    util.deleteFleetConfigFile(fleetPath);

    util.showLog(`Completed removing resources for ${fleetConfigData.appName}.`, fleetPath, correlationData);
};

let deployRoute = async function(routeName, memorySize, timeout, fleetPath, correlationData) {
    let fleetConfigData = util.getFleetConfigFileData(fleetPath);
    let route = fleetConfigData.routes[routeName];
    util.showLog(`Using route found at ${route.path}.`, fleetPath, correlationData);

    //Verify memory size
    if(memorySize < 128 || memorySize > 3008 || memorySize % 64 !== 0) {        
        util.showLog(`Memory Size of ${memorySize} for ${routeName} is invalid, setting to default of 128.`, fleetPath, correlationData);
        memorySize = 128;
    }

    //Verify timeout
    if(timeout < 1 || timeout > 900) {
        util.showLog(`Timeout of ${timeout} for ${routeName} is invalid, setting to default of 3.`, fleetPath, correlationData);
        timeout = 3;
    }

    util.showLog(`Deploying ${routeName}...`, fleetPath, correlationData);

    for(region in fleetConfigData.region) {
        await awsInterface
            .createOrUpdateLambda(fleetConfigData, routeName, memorySize, timeout, fleetConfigData.region[region], fleetPath, correlationData)
            .catch(e => {throw e});
        await awsInterface
            .updateAPIG(fleetConfigData, route, routeName, fleetConfigData.region[region], fleetPath, correlationData)
            .catch(e => {throw e});
    }
};

let undeployRoute = async function(routeName, fleetPath, correlationData) {
    let fleetConfigData = util.getFleetConfigFileData(fleetPath);

    for(region in fleetConfigData.region) {
        if (!util.isRouteDeployed(fleetConfigData, routeName, fleetConfigData.region[region])) {
            util.showLog(`${routeName} is not deployed in ${fleetConfigData.region[region]}.`, fleetPath, correlationData);
            return false;
        } else {
            await awsInterface.ensureLambdaUndeployed(fleetConfigData, routeName, fleetConfigData.region[region], fleetPath, correlationData)
                    .catch(e => {throw e});

            util.showLog(`Completed undeploying ${routeName} in ${fleetConfigData.region[region]}.`, fleetPath, correlationData);
        }
    }
}

let deleteRoute = async function(routeName, fleetPath, correlationData) {
    let fleetConfigData = util.getFleetConfigFileData(fleetPath);

    for(region in fleetConfigData.region) {
        if (!util.isRouteDeployed(fleetConfigData, routeName, fleetConfigData.region[region])) {
            util.showLog(`${routeName} is not deployed in ${fleetConfigData.region[region]}.`, fleetPath, correlationData);
            continue;
        } else {
            await awsInterface.ensureLambdaUndeployed(fleetConfigData, routeName, fleetConfigData.region[region], fleetPath, correlationData)
                    .catch(e => {throw e});

            util.showLog(`Completed undeploying ${routeName} in ${fleetConfigData.region[region]}.`, fleetPath, correlationData);
        }

    }

    util.deleteRouteFolder(routeName, fleetPath);
    
    delete fleetConfigData.routes[routeName];
    util.updateFleetConfigFileData(fleetConfigData, fleetPath);

    util.showLog(`Completed deleting ${routeName}.`, fleetPath, correlationData);
}

let runRoute = async function(routeName, fleetPath, correlationData) {
    let fleetConfigData = util.getFleetConfigFileData(fleetPath);
    let route = fleetConfigData.routes[routeName];
    util.showLog(`Running route found at ${route.path}.`, fleetPath, correlationData);

    let fullRoutePath = `${fleetPath}\\routes\\${routeName}\\index.js`;
    let routeObj = require(fullRoutePath);
    routeObj.handler(null, null, (cbargs, body) => util.showLog(body.body, fleetPath, correlationData));
}

let newRoute = async function(routeName, routeDefinition, routeType, fleetPath, correlationData) {
    if (!util.isFleetConfigCreated(fleetPath)) {
        return util.showLog('No fleet config found, try running `create-fleet`.', fleetPath, correlationData);
    } else {
        //check if exists, add to config, setup folder
        let fleetConfigData = util.getFleetConfigFileData(fleetPath);
        fleetConfigData.routes = fleetConfigData.routes || {};

        //ensure this endpoint doesn't already exist, warn if so
        if (fleetConfigData.routes[routeName]) {
            util.showLog(`${routeName} already exists, updating your route.`, fleetPath, correlationData);
        }

        fleetConfigData.routes[routeName] = fleetConfigData.routes[routeName] || {};
        fleetConfigData.routes[routeName].type = routeType;
        fleetConfigData.routes[routeName].apiPath = routeDefinition;
        fleetConfigData.routes[routeName].path = `${util.routesFolderPath}/${routeName}`;

        //create route folder `./routes/routeName`
        util.createRouteFolder(routeName, fleetPath);

        //save config
        util.updateFleetConfigFileData(fleetConfigData, fleetPath);
        util.showLog(`fleet configuration updated with ${routeName}.`, fleetPath, correlationData);
        util.showLog(`See the code at ${util.routesFolderPath}/${routeName} and deploy with 'fleet-cli deploy-route ${routeName}'`, fleetPath, 
            correlationData);
    }
};

let newWebsite = async function(websiteName, fleetPath, correlationData) {
    if (!util.isFleetConfigCreated(fleetPath)) {
        return util.showLog('No fleet config found, try running `create-fleet`.', fleetPath, correlationData);
    } else {
        //check if exists, add to config, setup folder
        let fleetConfigData = util.getFleetConfigFileData(fleetPath);
        fleetConfigData.websites = fleetConfigData.websites || {};

        //ensure this website doesn't already exist, warn if so?
        if (fleetConfigData.websites[websiteName]) {
            util.showLog(`${websiteName} already exists, updating your website.`, fleetPath, correlationData);
        }

        fleetConfigData.websites[websiteName] = fleetConfigData.websites[websiteName] || {};

        //parse directory structure from websiteName
        fleetConfigData.websites[websiteName].path = `${util.websitesFolderPath}/${websiteName}`;

        //create folder `./websites/websiteName`
        util.createWebsiteFolder(websiteName, fleetPath);

        //save config
        util.updateFleetConfigFileData(fleetConfigData, fleetPath);
        util.showLog(`fleet configuration updated with ${websiteName}.`, fleetPath, correlationData);
        util.showLog(`See the code at ${util.websitesFolderPath}/${websiteName} and deploy with 'fleet-cli deploy-website ${websiteName}'`, 
            fleetPath,
            correlationData);
    }
}

let deployWebsite = async function(websiteName, fleetPath, correlationData) {
    let fleetConfigData = util.getFleetConfigFileData(fleetPath);
    util.showLog(`Using website found at ${fleetConfigData.websites[websiteName].path}.`, fleetPath, correlationData);
    
    for(region in fleetConfigData.region) {
        util.showLog(`Deploying ${websiteName} in ${fleetConfigData.region[region]}...`, fleetPath, correlationData);

        await awsInterface.createOrUpdateWebsiteBucket(fleetConfigData, websiteName, fleetConfigData.region[region], fleetPath, correlationData)
                .catch(e => {throw e});

        util.showLog(`Website fully deployed in ${fleetConfigData.region[region]}!`, fleetPath, correlationData);
        util.showLog(
            `View website at ${fleetConfigData.websites[websiteName].url[fleetConfigData.region[region]]}`, 
            fleetPath,
            correlationData);
    }
}

let deleteWebsite = async function(websiteName, fleetPath, correlationData) {
    let fleetConfigData = util.getFleetConfigFileData(fleetPath);
    util.showLog(`Using website found at ${fleetConfigData.websites[websiteName].path}.`, fleetPath, correlationData);
    
    for(region in fleetConfigData.region) {
        util.showLog(`Deleting ${websiteName} in ${fleetConfigData.region[region]}...`, fleetPath, correlationData);
        await awsInterface.ensureWebsiteUndeployed(fleetConfigData, websiteName, fleetConfigData.region[region], fleetPath, correlationData)
            .catch(e => {throw e});
    }
    
    //Remove websites folder
    util.deleteWebsiteFolder(websiteName, fleetPath);

    //Delete website from fleet.json    
    delete fleetConfigData.websites[websiteName];
    util.updateFleetConfigFileData(fleetConfigData, fleetPath);

    util.showLog(`Completed deleting ${websiteName}.`, fleetPath, correlationData);
}

let catchCommandPromiseError = function(fleetPath, correlationData, error) {
    util.showLog(`Error in command execution: ${error}`, fleetPath, correlationData);
    throw error;
}

exports.createFleet = async function(appName, region, global, fleetPath, correlationData) {
    if (util.isFleetConfigCreated()) {
        util.showLog(`fleet.json configuration file already exists.`, fleetPath, correlationData);
    } else {
        util.updateFleetStatus(`creating-fleet`, fleetPath);
        await createFleet.apply(null, arguments).catch(catchCommandPromiseError.bind(this, fleetPath, correlationData));
    }
    
    util.updateFleetStatus(`ready`, fleetPath);
}

exports.deleteFleet = async function(fleetPath, correlationData) {
    util.updateFleetStatus(`deleting-fleet`, fleetPath);
    await deleteFleet.apply(null, arguments).catch(catchCommandPromiseError.bind(this, fleetPath, correlationData));
}

exports.newRoute = async function(routeName, routeDefinition, routeType, fleetPath, correlationData) {
    util.updateFleetStatus(`new-route`, fleetPath, routeName);
    await newRoute.apply(null, arguments).catch(catchCommandPromiseError.bind(this, fleetPath, correlationData));
    util.updateFleetStatus(`ready`, fleetPath);
}

exports.runRoute = async function(routeName, fleetPath, correlationData) {
    util.updateFleetStatus(`run-route`, fleetPath, routeName);
    await runRoute.apply(null, arguments).catch(catchCommandPromiseError.bind(this, fleetPath, correlationData));
    util.updateFleetStatus(`ready`, fleetPath);
}

exports.deployRoute = async function(routeName, memorySize, timeout, fleetPath, correlationData) {
    util.updateFleetStatus(`deploying-route`, fleetPath, routeName);
    await deployRoute.apply(null, arguments).catch(catchCommandPromiseError.bind(this, fleetPath, correlationData));
    util.updateFleetStatus(`ready`, fleetPath);
}

exports.undeployRoute = async function(routeName, fleetPath, correlationData) {
    util.updateFleetStatus(`undeploying-route`, fleetPath, routeName);
    await undeployRoute.apply(null, arguments).catch(catchCommandPromiseError.bind(this, fleetPath, correlationData));
    util.updateFleetStatus(`ready`, fleetPath);
}

exports.deleteRoute = async function(routeName, fleetPath, correlationData) {
    util.updateFleetStatus(`deleting-route`, fleetPath, routeName);
    await deleteRoute.apply(null, arguments).catch(catchCommandPromiseError.bind(this, fleetPath, correlationData));
    util.updateFleetStatus(`ready`, fleetPath);
}

exports.newWebsite = async function(websiteName, fleetPath, correlationData) {
    util.updateFleetStatus(`new-website`, fleetPath, websiteName);
    await newWebsite.apply(null, arguments).catch(catchCommandPromiseError.bind(this, fleetPath, correlationData));
    util.updateFleetStatus(`ready`, fleetPath);
}

exports.deployWebsite = async function(websiteName, fleetPath, correlationData) {
    util.updateFleetStatus(`deploy-website`, fleetPath, websiteName);
    await deployWebsite.apply(null, arguments).catch(catchCommandPromiseError.bind(this, fleetPath, correlationData));
    util.updateFleetStatus(`ready`, fleetPath);
}

exports.deleteWebsite = async function(websiteName, fleetPath, correlationData) {
    util.updateFleetStatus(`delete-website`, fleetPath, websiteName);
    await deleteWebsite.apply(null, arguments).catch(catchCommandPromiseError.bind(this, fleetPath, correlationData));
    util.updateFleetStatus(`ready`, fleetPath);
}

let inspectModule = require('../inspect');
exports.inspectRoute = inspectModule.inspectRoute;
exports.inspectRoutes = inspectModule.inspectRoutes;