let util = require('../utilities');
let apiRunning = [];
let apiMethod = [];

let apiExecutorRun = async (apiName, args) => {    
    //execute api
    let promise = await apiMethod[apiName].method.apply(null, args)
        .catch(e => 
        {
            apiRunning[apiName] = false;
            throw e;
        });

    //wait if api has time limit
    await util.timeout(apiMethod[apiName].timeLimit);
    apiRunning[apiName] = false;
    return promise;
}

module.exports = {
    registerMethod: (apiName, method, timeLimit) => {
        apiMethod[apiName] = {method: method, timeLimit: timeLimit};
    },

    addCall: async (apiName, args, fleetPath, correlationData) => {
        //only run if not currently running, otherwise wait
        if(!apiRunning[apiName]) {
            apiRunning[apiName] = true;
            return await apiExecutorRun(apiName, args).catch(e => {throw e});
        } else {
            //util.showLog(`${apiName} is waiting to execute...`, fleetPath, correlationData);
            await util.timeout(100);
            return await module.exports.addCall(apiName, args, fleetPath).catch(e => {throw e});
        }
    }
}
