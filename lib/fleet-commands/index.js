let util = require('../utilities');
let awsInterface = require('../aws-interface');

exports.init = function(appName, region) {
    //use fs to create .fleet file
    if (util.isFleetConfigCreated()) {
        return util.showLog(`fleet.json configuration file already exists.`);
    } else {
        let fleetConfig = {};
        fleetConfig.appName = appName || null;
        fleetConfig.region = region;
        util.updateFleetConfigFileData(fleetConfig);
        util.createRoutesFolder();

        util.showLog(`fleet.json configuration file created.`);
        util.showLog('Your fleet project is ready!');
        util.showLog('Try running `fleet-cli new-route` to create an endpoint.');
    }
};

exports.deployRoute = async function(routeName) {
    let fleetConfigData = util.getFleetConfigFileData();
    let route = fleetConfigData.routes[routeName];
    util.showLog(`Using route found at ${route.path}.`);
    util.showLog(`Deploying ${routeName}...`);

    await awsInterface.createOrUpdateLambda(fleetConfigData, routeName);
    await awsInterface.createOrUpdateAPIG(fleetConfigData, route, routeName);
};

exports.undeployRoute = async function(routeName) {
    let fleetConfigData = util.getFleetConfigFileData();

    if (!util.isRouteDeployed(fleetConfigData, routeName)) {
        util.showLog(`${routeName} is not deployed.`);
        return false;
    } else {
        await awsInterface.ensureLambdaUndeployed(fleetConfigData, routeName);

        if (!util.isAnyRouteDeployed(fleetConfigData)) {
            //clean up if all routes undeployed
            await awsInterface.removeUnusedResources(fleetConfigData);
        }

        util.showLog(`Completed undeploying ${routeName}.`);
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

        //ensure this endpoint doesn't already exist, warn if so?
        if (fleetConfigData.routes[routeName]) {
            util.showLog(`${routeName} already exists, updating your route.`);
        }

        fleetConfigData.routes[routeName] = fleetConfigData.routes[routeName] || {};
        fleetConfigData.routes[routeName].type = routeType;
        fleetConfigData.routes[routeName].apiPath = routeDefinition;

        //parse directory structure from routeName
        //let routeDirName = routeName.toString();
        //routeDirName = routeDirName.split(':').join('_');
        //routeDirName = `${util.routesFolderPath}/${routeDirName}`;
        fleetConfigData.routes[routeName].path = `${util.routesFolderPath}/${routeName}`;

        //create route folder `./routes/routeName`
        util.createRouteFolder(routeName);

        //save config
        util.updateFleetConfigFileData(fleetConfigData);
        util.showLog(`fleet configuration updated with ${routeName}.`);
        util.showLog(`See the code at ${util.routesFolderPath}/${routeName} and deploy with 'fleet-cli deploy-route ${routeName}'`);
    }
};

let inspectModule = require('../inspect');
exports.inspectRoute = inspectModule.inspectRoute;
exports.inspectRoutes = inspectModule.inspectRoutes;