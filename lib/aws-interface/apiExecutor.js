let util = require('../utilities');
let apiRunning = [];
let apiMethod = [];

let apiExecutorRun = async (apiName, args) => {    
    //execute api
    let promise = await apiMethod[apiName].method.apply(null, args).catch(e => {throw e});

    //wait if api has time limit
    await util.timeout(apiMethod[apiName].timeLimit);
    apiRunning[apiName] = false;
    return promise;
}

module.exports = {
    registerMethod: (apiName, method, timeLimit) => {
        apiMethod[apiName] = {method: method, timeLimit: timeLimit};
    },

    addCall: async (apiName, args, fleetPath) => {
        //only run if not currently running, otherwise wait
        if(!apiRunning[apiName]) {
            apiRunning[apiName] = true;
            return await apiExecutorRun(apiName, args).catch(e => {throw e});
        } else {
            util.showLog(`${apiName} is waiting to execute...`, fleetPath, Date.now());
            await timeout(1000);
            return await addCall(apiName, args, fleetPath).catch(e => {throw e});
        }
    }
}
