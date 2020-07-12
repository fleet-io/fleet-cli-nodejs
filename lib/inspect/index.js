let util = require('../utilities');
let table = require('table').table;

//TODO: inspectRoute does not consider region'd routes
exports.inspectRoute = async function(routeName, property, fleetPath, correlationData) {
    let fleetConfigData = await util.getFleetConfigFileData(fleetPath);

    if(!fleetConfigData) return util.showLog('No fleet configuration found. Use `fleet init` to start.', fleetPath, correlationData);
    if(!fleetConfigData.routes) return util.showLog('No routes found in this app.', fleetPath, correlationData);
    if(!fleetConfigData.routes[routeName]) return util.showLog(`No route found named ${routeName} in this app.`, fleetPath, correlationData);

    if (property) {
        let formattedProperty = property.toString();
        if (fleetConfigData.routes[routeName][formattedProperty]) {
            return util.showLog(`{'${formattedProperty}': '${fleetConfigData.routes[routeName][formattedProperty]}'}`, 
            fleetPath,
            correlationData);
        } else {
            return util.showLog('Invalid Property.', fleetPath, correlationData);
        }
    } else {
        util.showLog(fleetConfigData.routes[routeName], fleetPath, correlationData)
    }          
};

exports.inspectRoutes = async function(specificRouteName, fleetPath, correlationData) {
    let fleetConfigData = await util.getFleetConfigFileData(fleetPath);

    if(!fleetConfigData) return util.showLog('No fleet configuration found. Use `fleet init` to start.', fleetPath, correlationData);
    if(!fleetConfigData.routes) return util.showLog('No routes found in this app.', fleetPath, correlationData);

    let data, output;
    data = [];
    data.push(["NAME", "API PATH", "FILE PATH", "TYPE", "DEPLOYED"]);

    if (fleetConfigData.routes) {
        for (var routeName in fleetConfigData.routes) {
            if (specificRouteName && specificRouteName !== routeName)
                continue;

            let routeObject = fleetConfigData.routes[routeName];
            let deployed = routeObject.url ? true : false;
            data.push([routeName, routeObject.apiPath, routeObject.path, routeObject.type, deployed]);
        }
    }

    let options = {
        drawHorizontalLine: (index, size) => {
            return index === 0 || index === 1 || index === size;
        }
    };

    output = table(data, options);
    console.log(output);
};