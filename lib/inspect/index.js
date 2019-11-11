let util = require('../utilities');
let table = require('table').table;

exports.inspectRoute = function(routeName, property) {
    let fleetConfigData = util.getFleetConfigFileData();
    if (fleetConfigData) {
        if (fleetConfigData.routes) {
            if (fleetConfigData.routes[routeName]) {
                if (property) {
                    let formattedProperty = property.toString();
                    if (fleetConfigData.routes[routeName][formattedProperty]) {
                        return util.showLog(`{'${formattedProperty}': '${fleetConfigData.routes[routeName][formattedProperty]}'}`, correlationData);
                    } else {
                        return util.showLog('Invalid Property.', correlationData);
                    }
                } else {
                    util.showLog(fleetConfigData.routes[routeName], correlationData)
                }
            } else {
                return util.showLog(`No route found named ${routeName} in this app.`, correlationData);
            }
        } else {
            return util.showLog('No routes found in this app.', correlationData);
        }
    } else {
        return util.showLog('No fleet configuration found. Use `fleet init` to start.', correlationData);
    }
};

exports.inspectRoutes = function(specificRouteName) {
    let data,
        output;
    data = [];
    data.push(["NAME", "API PATH", "FILE PATH", "TYPE", "DEPLOYED"]);

    let fleetConfigData = util.getFleetConfigFileData();
    if (fleetConfigData) {
        if (fleetConfigData.routes) {
            for (var routeName in fleetConfigData.routes) {
                if (specificRouteName && specificRouteName !== routeName)
                    continue;

                let routeObject = fleetConfigData.routes[routeName];
                let deployed = routeObject.url ? true : false;
                data.push([routeName, routeObject.apiPath, routeObject.path, routeObject.type, deployed]);
            }
        } else {
            return util.showLog(`No routes defined for ${fleetConfigData.appName}.`, correlationData);
        }
    } else {
        return util.showLog('No fleet configuration found. Use `fleet init` to start.', correlationData);
    }

    let options = {
        drawHorizontalLine: (index, size) => {
            return index === 0 || index === 1 || index === size;
        }
    };

    output = table(data, options);
    console.log(output);
};