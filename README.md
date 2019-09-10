# Function-Level Entrypoint and Endpoint Technology Command Line Interface for NodeJS
`fleet` is a platform that enables quick and easy management and provisioning of serverless applications.

`fleet-cli` for NodeJS allows you to quickly create, deploy, and manage serverless applications to cloud providers such as AWS. You can easily create an AWS Lambda function, create an AWS S3 static hosted website for a front-end, and centrally manage these resources.

[View Roadmap Notes](Roadmap.md)

[View Release Notes](Releases.md)

### Pre-requisites
- Your environment will need access to your AWS account in order to deploy
- NodeJS (8.5+)

### Installation
- npm i -g fleet-cli

### Usage
Calling `fleet-cli init <appName>` in your terminal will initialize your local `fleet` environment. This environment will come with a `fleet.json` configuration file and will create your application's routes directory.
```
# fleet-cli init <appName>
$ fleet-cli init myFleetApp
```
Once your environment has been created, you can make a new route using the CLI. A route is a serverless application that runs your code and can be triggered by various services, such as an API Gateway. Call the `new-route` command and supply the unique route name, definition of the route, and the type of route (e.g. GET, POST). The route definition provides your API with a URL structure (e.g. http://example.com/admin/users/1 would be `admin/users/:id` and would define a route for getting users by their ID). The unique route name will provide an identifier for this route and will be used to create your route's local code folder.
```
# fleet-cli new-route <routeName> <routeDefinition> <type>
$ fleet-cli new-route getFleetCount fleetcount GET
```
This will create a new folder in your local environment called `routes/getFleetCount` with a route stub ready for editing and deployment.
```
# Within routes/getFleetCount directory
$ index.js package.json
```
At this point you can modify the code within this route's index.js to your liking. If you want to add node modules, you can `cd` into the directory and `npm install`.
You can deploy this route to your remote `fleet` application using the `fleet` CLI. This will setup various services such as API Gateway, Lambda, IAM Roles/Policies, etc.
```
# fleet-cli deploy-route <routeName>
$ fleet-cli deploy-route getFleetCount
$ getFleetCount route has been deployed to your application at http://example.com/fleetcount
```
You can update your remote route at anytime by using the same `fleet-cli deploy-route <routeName>` command.

You can run a route locally using the `fleet-cli run-route <routeName>` command.
```
$ fleet-cli run getFleetCount
Hello new Route!
```

### Undeploy
To remove a deployed route, simply call the undeploy-route command. This will remove the specified route and any unused resources.
```
$ fleet-cli undeploy-route getFleetCount
```

### Inspect
To get information about your current fleet application's routes, you can use the following commands:
```
$ fleet-cli inspect-routes
╔═══════════════╤════════════╤════════════════════════╤══════╤══════════╗
║ NAME          │ API PATH   │ FILE PATH              │ TYPE │ DEPLOYED ║
╟───────────────┼────────────┼────────────────────────┼──────┼──────────╢
║ getFleetCount │ fleetcount │ ./routes/getFleetCount │ GET  │ true     ║
╚═══════════════╧════════════╧════════════════════════╧══════╧══════════╝
```
```
$ fleet-cli inspect-route getFleetCount --property url
http://example.com/fleetcount
```
Using `fleet`'s inspect commands will help you manage your application, allowing you to track deployment information, versioning, and more.

### Build fleet-cli-nodejs Locally
To build fleet-cli from source and run locally, run the following commands:
```
# clone the repo
$ git clone https://github.com/fleet-io/fleet-cli-nodejs.git

# cd into the cloned directory
$ cd fleet-cli-nodejs

# install npm modules
$ npm install

# run fleet-cli using node
$ node .\bin\fleet-cli --version
```