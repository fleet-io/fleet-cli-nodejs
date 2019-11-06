let util = require('../utilities');
let awsInterface = require('../aws-interface');

let createFleet = async function(appName, region, global, correlationData) {
    let fleetConfigData = util.getFleetConfigFileData();
    fleetConfigData.appName = appName || null;

    if(global) {
        util.showLog(`Retrieving list of available regions for global fleet creation...`, correlationData);
        region = await awsInterface.describeRegions(fleetConfigData, correlationData).catch(e => {throw e});
    }
    
    fleetConfigData.region = region;
    
    util.createRoutesFolder();
    util.createWebsitesFolder();
    util.createLogsFolder();

    for(region in fleetConfigData.region) {
        await awsInterface.createAPIG(fleetConfigData, fleetConfigData.region[region], correlationData).catch(e => {throw e});
    }

    await awsInterface.createLambdaRole(fleetConfigData, correlationData).catch(e => {throw e});
    await awsInterface.createLambdaRoleInlinePolicy(fleetConfigData, correlationData).catch(e => {throw e});

    util.showLog(`fleet.json configuration file created.`, correlationData);
    util.showLog('Your fleet project is ready!', correlationData);
    util.showLog('Try running `fleet-cli new-route` to create an endpoint.', correlationData);

    fleetConfigData.created = Date.now();
    util.updateFleetConfigFileData(fleetConfigData);
};

let deleteFleet = async function(correlationData) {
    //Remove aws resources
    let fleetConfigData = util.getFleetConfigFileData();

    await awsInterface.removeUnusedResources(fleetConfigData, correlationData).catch(e => {throw e});

    //Remove routes folder
    util.deleteRoutesFolder();

    //Remove websites folder
    util.deleteWebsitesFolder();

    //Remove fleet.json
    util.deleteFleetConfigFile();

    util.showLog(`Completed removing resources.`, correlationData);
};

let deployRoute = async function(routeName, correlationData) {
    let fleetConfigData = util.getFleetConfigFileData();
    let route = fleetConfigData.routes[routeName];
    util.showLog(`Using route found at ${route.path}.`, correlationData);
    util.showLog(`Deploying ${routeName}...`, correlationData);

    for(region in fleetConfigData.region) {
        await awsInterface.createOrUpdateLambda(fleetConfigData, routeName, fleetConfigData.region[region], correlationData).catch(e => {throw e});
        await awsInterface.updateAPIG(fleetConfigData, route, routeName, fleetConfigData.region[region], correlationData).catch(e => {throw e});
    }
};

let undeployRoute = async function(routeName, correlationData) {
    let fleetConfigData = util.getFleetConfigFileData();

    for(region in fleetConfigData.region) {
        if (!util.isRouteDeployed(fleetConfigData, routeName, fleetConfigData.region[region])) {
            util.showLog(`${routeName} is not deployed in ${fleetConfigData.region[region]}.`, correlationData);
            return false;
        } else {
            await awsInterface.ensureLambdaUndeployed(fleetConfigData, routeName, fleetConfigData.region[region], correlationData).catch(e => {throw e});

            util.showLog(`Completed undeploying ${routeName} in ${fleetConfigData.region[region]}.`, correlationData);
        }
    }
}

let runRoute = async function(routeName, correlationData) {
    let fleetConfigData = util.getFleetConfigFileData();
    let route = fleetConfigData.routes[routeName];
    util.showLog(`Running route found at ${route.path}.`, correlationData);

    let fullRoutePath = `${process.cwd()}\\routes\\${routeName}\\index.js`;
    let routeObj = require(fullRoutePath);
    routeObj.handler(null, null, (cbargs, body) => util.showLog(body.body, correlationData));
}

let newRoute = async function(routeName, routeDefinition, routeType, correlationData) {
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

let newWebsite = async function(websiteName, correlationData) {
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

let deployWebsite = async function(websiteName, correlationData) {
    let fleetConfigData = util.getFleetConfigFileData();
    let website = fleetConfigData.websites[websiteName];
    util.showLog(`Using website found at ${fleetConfigData.websites[websiteName].path}.`, correlationData);
    util.showLog(`Deploying ${websiteName}...`, correlationData);

    await awsInterface.createOrUpdateWebsiteBucket(fleetConfigData, websiteName, correlationData).catch(e => {throw e});

    util.showLog(`Website fully deployed!`, correlationData);
    util.showLog(`View website at http:/${fleetConfigData.websites[websiteName].url}.s3-website-${fleetConfigData.region}.amazonaws.com`, 
            correlationData);
}

let getCorrelationData = function(args) {
    return args[args.length - 1];
}

let catchCommandPromiseError = function(correlationData, error) {
    util.showLog(`Error in command execution: ${error}`, correlationData);
    throw error;
}

exports.createFleet = async function() {
    if (util.isFleetConfigCreated()) {
        util.showLog(`fleet.json configuration file already exists.`, getCorrelationData(arguments));
    } else {
        util.updateFleetStatus(`creating-fleet`);
        await createFleet.apply(null, arguments).catch(catchCommandPromiseError.bind(this, getCorrelationData(arguments)));
    }
    
    util.updateFleetStatus(`ready`);
}

exports.deleteFleet = async function() {
    util.updateFleetStatus(`deleting-fleet`);
    await deleteFleet.apply(null, arguments).catch(catchCommandPromiseError.bind(this, getCorrelationData(arguments)));
}

exports.newRoute = async function() {
    util.updateFleetStatus(`new-route`, {route: arguments[0]});
    await newRoute.apply(null, arguments).catch(catchCommandPromiseError.bind(this, getCorrelationData(arguments)));
    util.updateFleetStatus(`ready`);
}

exports.runRoute = async function() {
    util.updateFleetStatus(`run-route`, {route: arguments[0]});
    await runRoute.apply(null, arguments).catch(catchCommandPromiseError.bind(this, getCorrelationData(arguments)));
    util.updateFleetStatus(`ready`);
}

exports.deployRoute = async function() {
    util.updateFleetStatus(`deploying-route`, {route: arguments[0]});
    await deployRoute.apply(null, arguments).catch(catchCommandPromiseError.bind(this, getCorrelationData(arguments)));
    util.updateFleetStatus(`ready`);
}

exports.undeployRoute = async function() {
    util.updateFleetStatus(`undeploying-route`, {route: arguments[0]});
    await undeployRoute.apply(null, arguments).catch(catchCommandPromiseError.bind(this, getCorrelationData(arguments)));
    util.updateFleetStatus(`ready`);
}

exports.newWebsite = async function() {
    util.updateFleetStatus(`new-website`, {route: arguments[0]});
    await newWebsite.apply(null, arguments).catch(catchCommandPromiseError.bind(this, getCorrelationData(arguments)));
    util.updateFleetStatus(`ready`);
}

exports.deployWebsite = async function() {
    util.updateFleetStatus(`deploy-website`, {route: arguments[0]});
    await deployWebsite.apply(null, arguments).catch(catchCommandPromiseError.bind(this, getCorrelationData(arguments)));
    util.updateFleetStatus(`ready`);
}

let inspectModule = require('../inspect');
exports.inspectRoute = inspectModule.inspectRoute;
exports.inspectRoutes = inspectModule.inspectRoutes;